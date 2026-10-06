import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnatomyStructure } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
import type { AnatomyImageAsset } from '../types/image';
import { AREAS, type Area } from '../types/region';
import type { AnatomyRepository } from '../data/repository';
import { BUNDLED_CONTENT } from '../data/content/bundledContent';
import type { AreaFactsStatus, AreaLoad, ContentSourceKind } from '../data/content/contentSource';
import { joinLoadedAreas } from '../data/content/split';
import { leaseExpired, leaseNeedsRenewal } from '../data/content/lease';
import type { DistractorSources } from '../lib/questionGenerators/sources';
import { publishLoadedContent } from '../data/content/loadedContent';

/**
 * Everything the app knows about anatomy, in two layers
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 6):
 *
 *   index       EVERY structure: its name, kind, areas and pictures. Always
 *               complete, in every build. What a screen uses to name a
 *               structure, count an area, or work out a level.
 *   structures  the structures whose FACTS are in hand — origin, insertion,
 *               nerve, attachments, blood supply. What a question is built
 *               from and what a card prints.
 *
 * In a bundled build the two hold the same structures and nothing below
 * matters. In a build that fetches facts per area they differ whenever the
 * account does not hold every area: a free account has one, and a subscriber
 * who is offline has whichever were saved. Code that only needs a name must
 * read the index, or it will find a third of the body missing; code that
 * prints a fact must read `structures`, and cope with one not being there.
 * The two are different TYPES so the compiler says which is which.
 */
export interface AnatomyContent {
  /** Structures whose facts are in hand. Every structure, in a bundled build. */
  structures: AnatomyStructure[];
  /** The same, by id. A structure missing here may still be in `indexById`. */
  structuresById: Map<string, AnatomyStructure>;
  /** Every structure, without facts. */
  index: readonly StructureIndexEntry[];
  indexById: ReadonlyMap<string, StructureIndexEntry>;
  images: AnatomyImageAsset[];
  imagesById: Map<string, AnatomyImageAsset>;
  /**
   * What the question generators may draw on beyond `structures`: every name,
   * and wrong answers that belong to no structure. Undefined in a bundled
   * build, where `structures` is already everything — passing nothing is what
   * keeps those sessions exactly as they were.
   */
  sources: DistractorSources | undefined;
  /** Which areas' facts are in hand, and why the others are not. */
  facts: ContentFacts;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface ContentFacts {
  source: ContentSourceKind;
  /** Every area's state. */
  status: Record<Area, AreaFactsStatus>;
  /** Whether an area's facts are in hand. */
  has: (area: Area) => boolean;
  /** Of these areas, the ones whose facts are NOT in hand, in canonical order. */
  missing: (areas: readonly Area[]) => Area[];
  /** Ask again for whatever is not in hand. */
  retry: () => void;
}

/** What the content hook needs to know about the account. A subset of UseEntitlement. */
export interface ContentAccess {
  uid: string | null;
  /** Every area the account may reach. */
  areas: readonly Area[];
  /** The entitlement is still being read: nothing is fetched until it settles. */
  loading: boolean;
  /** The entitlement was read, not assumed. See AreaLoadRequest.known. */
  known: boolean;
  /**
   * Changes when what the SERVER would say about this account has changed
   * without `areas` changing — a free area that was shown from the device and
   * has now landed on the account. The areas are asked for again: one refused
   * while the write was in flight is granted now.
   */
  revision?: number;
}

const everyArea = (status: AreaFactsStatus) =>
  Object.fromEntries(AREAS.map((area) => [area, status])) as Record<Area, AreaFactsStatus>;

/** The state of each area in a build that fetches nothing: bundled, or not part of it. */
const STATIC_STATUS: Record<Area, AreaFactsStatus> = Object.fromEntries(
  AREAS.map((area) => [area, BUNDLED_CONTENT.areas.includes(area) ? 'loaded' : 'absent']),
) as Record<Area, AreaFactsStatus>;

function contentFacts(source: ContentSourceKind, status: Record<Area, AreaFactsStatus>, retry: () => void): ContentFacts {
  const has = (area: Area) => status[area] === 'loaded';
  return { source, status, has, missing: (areas) => AREAS.filter((a) => areas.includes(a) && !has(a)), retry };
}

/**
 * A complete AnatomyContent from plain lists, as a bundled build would hold
 * them: every structure given has its facts. For tests and for screens
 * outside the main app that are handed a fixed list.
 */
export function anatomyContentFrom(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  index: readonly StructureIndexEntry[] = structures,
): AnatomyContent {
  return {
    structures,
    structuresById: new Map(structures.map((s) => [s.id, s])),
    index,
    indexById: new Map(index.map((s) => [s.id, s])),
    images,
    imagesById: new Map(images.map((i) => [i.id, i])),
    sources: index.length > structures.length ? { index } : undefined,
    facts: contentFacts('bundled', everyArea('loaded'), () => {}),
    loading: false,
    error: null,
    retry: () => {},
  };
}

const INDEX_BY_ID: ReadonlyMap<string, StructureIndexEntry> = new Map(BUNDLED_CONTENT.index.map((s) => [s.id, s]));
/** In a build that bundles facts, the structures never change: one array, one map, for the life of the page. */
const BUNDLED_STRUCTURES = [...BUNDLED_CONTENT.structures];
const BUNDLED_BY_ID = new Map(BUNDLED_STRUCTURES.map((s) => [s.id, s]));
const SOURCES: DistractorSources | undefined =
  BUNDLED_CONTENT.kind === 'bundled' ? undefined : { index: BUNDLED_CONTENT.index, vocabulary: BUNDLED_CONTENT.vocabulary };

/** Coming back to the app checks the leases, but not more than once in this long. */
const LEASE_RECHECK_MS = 10 * 60_000;

/**
 * Loads the picture catalogue once the repository is ready and, in a build
 * that fetches facts, the facts of every area the account may reach.
 *
 * `access` is what the account may reach (hooks/useEntitlement.ts). A bundled
 * build ignores it: its facts are all there already. Left out, a server build
 * loads nothing and reports every area as not in hand — which is right for a
 * screen that only wanted the index.
 *
 * LOADING IS TRUE UNTIL THE FIRST ANSWER FOR EVERY AREA, and then never
 * again. The app holds its "Loading anatomy content…" screen for the first
 * settle so that nothing is drawn from half a dataset; after that a change —
 * a subscription bought, a lease renewed — updates the areas in place under
 * a screen that stays up, because tearing the app down mid-session to show a
 * spinner would lose the session.
 */
export function useAnatomyContent(repository: AnatomyRepository | null, access?: ContentAccess): AnatomyContent {
  const [images, setImages] = useState<AnatomyImageAsset[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    setImagesLoading(true);
    setError(null);

    repository
      .listImageAssets()
      .then((loaded) => {
        if (cancelled) return;
        setImages(loaded);
        setImagesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError('Could not load anatomy content. Check your connection and try again.');
        setImagesLoading(false);
        console.error('Failed to load anatomy content:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [repository, attempt]);

  // ---- Facts fetched per area. Inert unless this build has a loader. ----
  const loader = BUNDLED_CONTENT.loader;
  const uid = access?.uid ?? null;
  const areasKey = (access?.areas ?? []).join(',');
  const accessLoading = access?.loading ?? false;
  const known = access?.known ?? false;
  const revision = access?.revision ?? 0;

  const [loads, setLoads] = useState<{ uid: string | null; areas: AreaLoad[] }>({ uid: null, areas: [] });
  const [settled, setSettled] = useState(!loader || !access);
  const [factsAttempt, setFactsAttempt] = useState(0);
  const [pending, setPending] = useState<string>('');

  useEffect(() => {
    if (!loader || !access) return;
    if (!uid) {
      // No account yet (sign-in still settling) or none at all: nothing may
      // be shown from a previous one. Once sign-in has settled WITHOUT an
      // account — a first visit with no network — there is nobody to ask as,
      // so the wait ends and the areas read as not reachable.
      setLoads({ uid: null, areas: [] });
      if (!accessLoading) setSettled(true);
      return;
    }
    if (accessLoading) return;

    let cancelled = false;
    const areas = areasKey ? (areasKey.split(',') as Area[]) : [];
    setPending(areasKey);
    loader
      .load({ uid, areas, known })
      .then((result) => {
        if (cancelled) return;
        setLoads({ uid, areas: result });
      })
      .catch((err) => {
        // loadAreaFacts does not reject; this is a bug in it, not a network
        // failure, and the areas are reported as failed rather than loading
        // for ever.
        console.error('Failed to load area facts:', err);
        if (!cancelled) setLoads({ uid, areas: areas.map((area) => ({ area, status: 'error' as const })) });
      })
      .finally(() => {
        if (cancelled) return;
        setPending('');
        setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loader, access === undefined, uid, areasKey, accessLoading, known, revision, factsAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // A lease can run out, or come due for renewal, while the app sits in a
  // background tab for a week. Looked at when the student comes back to it.
  const loadsRef = useRef(loads);
  loadsRef.current = loads;
  useEffect(() => {
    if (!loader) return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < LEASE_RECHECK_MS) return;
      last = Date.now();
      const now = new Date();
      const due = loadsRef.current.areas.some(
        (a) => a.status !== 'loaded' || (a.leaseUntil && (leaseExpired(a.leaseUntil, now) || leaseNeedsRenewal(a.leaseUntil, now))),
      );
      if (due) setFactsAttempt((n) => n + 1);
    };
    const onOnline = () => {
      if (loadsRef.current.areas.some((a) => a.status !== 'loaded')) setFactsAttempt((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [loader]);

  const retryFacts = useCallback(() => setFactsAttempt((n) => n + 1), []);

  const fetched = useMemo(() => {
    if (!loader) return null;
    // Only ever this account's: a load that finished for the last one is not shown.
    const mine = loads.uid === uid ? loads.areas : [];
    const loaded = mine.filter((a) => a.status === 'loaded' && a.facts);
    const structures = joinLoadedAreas(BUNDLED_CONTENT.index, loaded.map((a) => a.facts!));
    const status = everyArea('absent');
    const asked = new Set(areasKey ? areasKey.split(',') : []);
    // Still finding out: the entitlement is being read, a load is running, or
    // the last load to finish was for a different account.
    const waiting = accessLoading || pending !== '' || (!!uid && loads.uid !== uid);
    for (const area of AREAS) {
      const load = mine.find((a) => a.area === area);
      // An area already in hand stays in hand while it is renewed.
      if (load?.status === 'loaded') status[area] = 'loaded';
      // Asked for and not in hand: on its way, or the reason it is not coming.
      // With no account at all there is nobody to ask as, which a screen can
      // only describe as not reachable.
      else if (asked.has(area)) status[area] = waiting ? 'loading' : (load?.status ?? 'offline');
    }
    return { structures, structuresById: new Map(structures.map((s) => [s.id, s])), status };
  }, [loader, loads, uid, areasKey, pending, accessLoading]);

  // For the one caller outside this tree: see data/content/loadedContent.ts.
  useEffect(() => {
    if (!fetched) return;
    publishLoadedContent({
      structures: fetched.structures,
      areas: AREAS.filter((area) => fetched.status[area] === 'loaded'),
      sources: SOURCES,
    });
  }, [fetched]);

  const imagesById = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const facts = useMemo(
    () => contentFacts(BUNDLED_CONTENT.kind, fetched ? fetched.status : STATIC_STATUS, retryFacts),
    [fetched, retryFacts],
  );

  return {
    structures: fetched ? fetched.structures : BUNDLED_STRUCTURES,
    structuresById: fetched ? fetched.structuresById : BUNDLED_BY_ID,
    index: BUNDLED_CONTENT.index,
    indexById: INDEX_BY_ID,
    images,
    imagesById,
    sources: SOURCES,
    facts,
    loading: imagesLoading || !settled,
    error,
    retry,
  };
}
