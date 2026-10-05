import type { Area } from '../../types/region';
import { createIndexedDbContentCache, type ContentCache } from '../contentCache';
import { loadAreaFacts, parseGrant, prefetchAreaFacts, type AreaFactsDeps, type AreaFetchResult } from './areaFacts';
import type { AreaFactsLoader } from './contentSource';
import { CONTENT_VERSION } from './version';

/**
 * The loader a `server` build uses: areaFacts.ts with the real browser handed
 * in — IndexedDB, fetch, the signed-in account's ID token.
 *
 * Reached only from bundledContent.server.ts, so none of this is in a bundled
 * build or in the demo.
 */

export const CONTENT_AREA_URL = '/.netlify/functions/content-area';

/** A request that has not answered in this long is treated as no answer, and the saved copy is used. */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * The current account's ID token, or null.
 *
 * A dynamic import, like every other reach into the Firebase wrapper from
 * outside data/: the SDK must not be pulled into a chunk that does not need
 * it. Firebase refreshes the token itself when it is near expiry; offline,
 * with a token that has expired, this rejects and the caller falls back to
 * the saved copy.
 */
async function idToken(): Promise<string | null> {
  try {
    const { getFirebaseAuth } = await import('../firebase');
    return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

/** Asks the content function for one area. Resolves to what happened; never throws. */
export async function fetchAreaFromServer(
  area: Area,
  version: string,
  deps: { token: () => Promise<string | null>; fetch: typeof fetch } = { token: idToken, fetch: (...args) => fetch(...args) },
): Promise<AreaFetchResult> {
  const token = await deps.token();
  // No token is no way to ask, which for the copy on the device is the same
  // as no answer. (A build with no Firebase project has no token either.)
  if (!token) return { kind: 'unreachable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await deps.fetch(`${CONTENT_AREA_URL}?area=${encodeURIComponent(area)}&v=${encodeURIComponent(version)}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      // The function says no-store; this says it again from this side, so no
      // HTTP cache between here and there is ever asked.
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (response.status === 403) return { kind: 'denied' };
    if (!response.ok) return { kind: 'failed', status: response.status };
    const grant = parseGrant(await response.json().catch(() => null), area);
    // A 200 that is not an area — the SPA fallback answering for a function
    // that is not deployed, say — is a failure, not an empty area.
    return grant ?? { kind: 'failed', status: response.status };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

let cache: ContentCache | null = null;
const contentCache = () => (cache ??= createIndexedDbContentCache());

const deps = (): AreaFactsDeps => ({
  cache: contentCache(),
  fetchArea: (area, version) => fetchAreaFromServer(area, version),
  version: CONTENT_VERSION,
  now: () => new Date(),
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
});

export const serverAreaFactsLoader: AreaFactsLoader = {
  load: (request) => loadAreaFacts(request, deps()),
  prefetch: (uid, area) => prefetchAreaFacts(uid, area, deps()),
  held: async (uid) =>
    (await contentCache().list(uid)).map(({ area, leaseUntil, version }) => ({ area, leaseUntil, version })),
  purgeAll: () => contentCache().clear(),
};
