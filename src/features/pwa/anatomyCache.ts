/**
 * THE IMAGE CACHE HAS A VERSION, AND RE-RENDERS BUMP IT.
 *
 * Pictures are cached first, network second, for a month (vite.config.ts), and
 * a re-render REUSES THE FILENAME: the anterior cruciate ligament's anterior
 * plate is the same URL before and after it is redrawn. So a device that had
 * the old picture kept showing it for up to thirty days, and only for the
 * frames it happened to hold — which is why rotating a structure could walk
 * from a new render into an old one. Reported as "sometimes it reverts back to
 * the old images".
 *
 * The cache name carries this version, so a bump starts an empty cache and
 * every picture is fetched once more. Old caches are not orphaned: the app
 * deletes them on start, or a student would carry the dead copy about for as
 * long as the browser felt like keeping it.
 *
 * BUMP THIS whenever published renders change under existing filenames. It is
 * cheap — one re-download of what the student actually looks at — and the cost
 * of forgetting is a student revising from a picture that no longer matches
 * the answer.
 */
export const ANATOMY_CACHE_VERSION = '2026-09-23b';

export const ANATOMY_CACHE_NAME = `locusmsk-anatomy-images-${ANATOMY_CACHE_VERSION}`;

const PREFIX = 'locusmsk-anatomy-images';

/**
 * Deletes anatomy image caches from earlier versions. Safe to call on every
 * start: it never touches the current cache, and does nothing where the Cache
 * API is missing (older browsers, or a private window that blocks storage).
 */
export async function purgeStaleAnatomyCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const names = await caches.keys();
    const stale = names.filter((n) => n.startsWith(PREFIX) && n !== ANATOMY_CACHE_NAME);
    await Promise.all(stale.map((n) => caches.delete(n)));
    return stale;
  } catch {
    // Storage can be unavailable or blocked; a stale cache is not worth an error.
    return [];
  }
}
