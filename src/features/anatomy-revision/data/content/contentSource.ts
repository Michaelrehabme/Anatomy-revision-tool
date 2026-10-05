import type { AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { Area } from '../../types/region';
import type { DistractorVocabulary } from './vocabulary';
import type { AreaFacts } from './split';

/**
 * WHERE A BUILD GETS ITS FACTS FROM
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 6).
 *
 * Three answers, chosen when the app is BUILT and not while it runs:
 *
 *   bundled   every structure's facts are in the bundle. What production does
 *             today, and the default.
 *   server    no facts in the bundle at all. The index (names, pictures,
 *             areas) is bundled; facts are fetched per area from the content
 *             function for whoever is entitled, and kept on the device under
 *             a lease.
 *   fixture   the facts of two areas are in the bundle and there is nobody to
 *             ask for more. For the public demo, which has no accounts.
 *
 * CHOSEN BY AN ALIAS, NOT AN `if`. Everything imports
 * data/content/bundledContent, and vite.config.ts points that name at
 * bundledContent.ts, bundledContent.server.ts or bundledContent.fixture.ts
 * according to VITE_CONTENT_SOURCE. A runtime branch would leave the seed in
 * the module graph of a server build, where a bundler may or may not drop it;
 * with the alias the seed is simply never imported, and "are the facts in the
 * bundle" has a yes-or-no answer a build check can hold to
 * (src/scripts/checkBundleForFacts.ts). It is the same device the demo build
 * uses for its Firebase stand-ins, for the same reason.
 *
 * This file is the shape all three share.
 */
export type ContentSourceKind = 'bundled' | 'server' | 'fixture';

/** Why an area's facts are, or are not, in hand. */
export type AreaFactsStatus =
  /** In hand: bundled, read from this device's copy, or just fetched. */
  | 'loaded'
  /** Being fetched or read now. */
  | 'loading'
  /** Not in hand, and the device could not reach the server to get them. */
  | 'offline'
  /** Not in hand: the server was reached and did not answer usefully. */
  | 'error'
  /** The server said this account may not have this area. */
  | 'denied'
  /**
   * Not held and not asked for: an area this account may not reach (the lock
   * panels speak for those), or one outside the demo's fixture.
   */
  | 'absent';

/** One area's facts as they arrived, or the reason they did not. */
export interface AreaLoad {
  area: Area;
  status: Exclude<AreaFactsStatus, 'loading'>;
  /** Present exactly when status is 'loaded'. */
  facts?: AreaFacts;
  /** ISO. How long this copy may be shown without asking again. Server builds only. */
  leaseUntil?: string;
  /** Where a loaded area came from, for the log and the tests. */
  from?: 'bundle' | 'device' | 'server';
}

export interface AreaLoadRequest {
  /** The signed-in account. A guest has one too. */
  uid: string;
  /** Every area this account may reach, as far as the app knows. */
  areas: readonly Area[];
  /**
   * Whether `areas` was actually read from the account, rather than assumed
   * free because the read failed. Only a known answer may be used to DELETE
   * the saved copy of an area that is not in it.
   */
  known: boolean;
}

/** Fetches and keeps facts for a server build. The other two builds have none. */
export interface AreaFactsLoader {
  load(request: AreaLoadRequest): Promise<AreaLoad[]>;
  /** Fetch one area now whatever is saved, for the offline download. Resolves to its outcome. */
  prefetch(uid: string, area: Area): Promise<AreaLoad>;
  /** What this device holds for an account, without asking the server. */
  held(uid: string): Promise<{ area: Area; leaseUntil: string; version: string }[]>;
  /** Delete every saved area, for every account. Sign-out. */
  purgeAll(): Promise<void>;
}

/** What a build's `bundledContent` module exports. */
export interface BundledContent {
  kind: ContentSourceKind;
  /** Every structure, without facts unless this build bundles them. Pictures linked. */
  index: readonly StructureIndexEntry[];
  /** The structures whose facts are in the bundle: all, none, or the fixture's two areas. */
  structures: readonly AnatomyStructure[];
  /** The areas those structures cover completely. */
  areas: readonly Area[];
  /**
   * Wrong answers that belong to no structure, for a build that may hold only
   * some areas. Undefined when every fact is bundled: nothing is missing for
   * it to stand in for, and it would be bytes for nothing.
   */
  vocabulary: DistractorVocabulary | undefined;
  /** Server builds only. */
  loader: AreaFactsLoader | undefined;
}
