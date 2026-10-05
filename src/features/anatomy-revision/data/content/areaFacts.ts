import { AREAS, type Area } from '../../types/region';
import type { StructureFacts } from '../../types/structureIndex';
import type { CachedArea, ContentCache } from '../contentCache';
import type { AreaLoad, AreaLoadRequest } from './contentSource';
import { leaseExpired, leaseNeedsRenewal } from './lease';

/**
 * GETTING AN AREA'S FACTS: from this device if it holds a copy it may still
 * show, from the server if not (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 6).
 *
 * The rules, in the order they are applied to each area:
 *
 *  1. A saved copy that is current and well inside its lease is used and the
 *     server is not asked. This is the common case, and the reason a student
 *     on a train sees no difference.
 *  2. Otherwise the server is asked. A grant is saved and used.
 *  3. A REFUSAL (403) deletes the saved copy. The server has said this account
 *     may not have this area; nothing kept from before outranks that.
 *  4. NO ANSWER — offline, a timeout, a 5xx, the hourly limit — falls back to
 *     the saved copy IF ITS LEASE STILL RUNS, even one cut from older content.
 *     Old facts shown inside a lease are what the lease is for.
 *  5. No answer and the lease has run out: the copy is deleted and the area is
 *     reported as not in hand. The screens then say "connect to load this
 *     area" — they do not show it, and they do not pretend it is loading.
 *
 * And across areas: a copy of an area this account is no longer entitled to
 * is deleted — but only when the entitlement was actually READ. A failed read
 * reports the account as free (hooks/useEntitlement.ts), and deleting a paying
 * student's downloads because they opened the app in a tunnel would be
 * exactly the wrong way round.
 *
 * Pure of the browser: the cache, the clock, the network and "am I online"
 * are all handed in, so every rule above has a test that does not need one.
 */

/** What asking the server for an area came to. */
export type AreaFetchResult =
  | { kind: 'granted'; version: string; leaseUntil: string; structures: StructureFacts[] }
  /** 403: the server knows who is asking and says no. */
  | { kind: 'denied' }
  /** No answer at all: offline, DNS, a dropped connection. */
  | { kind: 'unreachable' }
  /** An answer that is neither: 401, 429, 5xx, or a body that is not an area. */
  | { kind: 'failed'; status: number };

export interface AreaFactsDeps {
  cache: ContentCache;
  /** Asks the content function. Never throws. */
  fetchArea: (area: Area, version: string) => Promise<AreaFetchResult>;
  /** The content version this bundle was built with. */
  version: string;
  now: () => Date;
  /** navigator.onLine, where there is one. False means do not even try. */
  online: () => boolean;
}

/**
 * A lease is renewed when under half of it is left (lease.ts) — but not more
 * than once in this many hours. Without the second half a monthly subscriber
 * in the last week of their month, whose lease can never be longer than the
 * days they have left, would ask for all nine areas every time the app
 * opened.
 */
export const RENEW_AT_MOST_EVERY_HOURS = 24;

function fromCache(copy: CachedArea): AreaLoad {
  return {
    area: copy.area,
    status: 'loaded',
    facts: { area: copy.area, structures: copy.structures },
    leaseUntil: copy.leaseUntil,
    from: 'device',
  };
}

/** Whether a saved copy can be used without asking anyone. */
function goodAsItIs(copy: CachedArea, deps: AreaFactsDeps): boolean {
  const now = deps.now();
  if (leaseExpired(copy.leaseUntil, now)) return false;
  // Cut from this bundle's content — or handed to this bundle when it last
  // asked, which is as current as the server can make it (see CachedArea).
  if (copy.version !== deps.version && copy.askedWith !== deps.version) return false;
  if (!leaseNeedsRenewal(copy.leaseUntil, now)) return true;
  const fetched = Date.parse(copy.fetchedAt);
  const hoursSince = Number.isNaN(fetched) ? Infinity : (now.getTime() - fetched) / 3_600_000;
  // A clock that has gone backwards makes this negative; that is not "recent".
  return hoursSince >= 0 && hoursSince < RENEW_AT_MOST_EVERY_HOURS;
}

async function askServer(uid: string, area: Area, copy: CachedArea | null, deps: AreaFactsDeps): Promise<AreaLoad> {
  const result = deps.online() ? await deps.fetchArea(area, deps.version) : ({ kind: 'unreachable' } as const);

  if (result.kind === 'granted') {
    const saved: CachedArea = {
      uid,
      area,
      version: result.version,
      askedWith: deps.version,
      leaseUntil: result.leaseUntil,
      fetchedAt: deps.now().toISOString(),
      structures: result.structures,
    };
    await deps.cache.put(saved);
    return { ...fromCache(saved), from: 'server' };
  }

  if (result.kind === 'denied') {
    await deps.cache.remove(uid, area);
    return { area, status: 'denied' };
  }

  // No usable answer. The saved copy stands for as long as its lease does.
  if (copy && !leaseExpired(copy.leaseUntil, deps.now())) return fromCache(copy);
  if (copy) await deps.cache.remove(uid, area);
  return { area, status: result.kind === 'unreachable' ? 'offline' : 'error' };
}

async function loadOne(uid: string, area: Area, deps: AreaFactsDeps): Promise<AreaLoad> {
  const copy = await deps.cache.get(uid, area);
  if (copy && goodAsItIs(copy, deps)) return fromCache(copy);
  return askServer(uid, area, copy, deps);
}

/**
 * The facts of every area asked for, each with how it turned out. Never
 * rejects: an area that could not be had is an entry saying so.
 */
export async function loadAreaFacts(request: AreaLoadRequest, deps: AreaFactsDeps): Promise<AreaLoad[]> {
  const { uid, known } = request;
  const wanted = AREAS.filter((area) => request.areas.includes(area));

  // Another account's copies have no business on this one's screen, whoever
  // signed out or in to get here.
  await deps.cache.keepOnly(uid);

  if (known) {
    const held = await deps.cache.list(uid);
    await Promise.all(held.filter((copy) => !wanted.includes(copy.area)).map((copy) => deps.cache.remove(uid, copy.area)));
  }

  return Promise.all(wanted.map((area) => loadOne(uid, area, deps)));
}

/**
 * Fetch one area now, whatever is saved — for the offline download, where the
 * student has just asked for this area to be on the device and "you had a
 * copy from last week" is not what they asked for. Falls back exactly as a
 * load does.
 */
export async function prefetchAreaFacts(uid: string, area: Area, deps: AreaFactsDeps): Promise<AreaLoad> {
  return askServer(uid, area, await deps.cache.get(uid, area), deps);
}

/** Reads a response body as a grant, or null if it is not one for this area. */
export function parseGrant(body: unknown, area: Area): Extract<AreaFetchResult, { kind: 'granted' }> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { version?: unknown; area?: unknown; leaseUntil?: unknown; structures?: unknown };
  if (b.area !== area || typeof b.version !== 'string' || !b.version) return null;
  if (typeof b.leaseUntil !== 'string' || Number.isNaN(Date.parse(b.leaseUntil))) return null;
  if (!Array.isArray(b.structures)) return null;
  if (!b.structures.every((s) => s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string')) return null;
  return { kind: 'granted', version: b.version, leaseUntil: b.leaseUntil, structures: b.structures as StructureFacts[] };
}
