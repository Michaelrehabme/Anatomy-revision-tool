/**
 * THE TWO PIECES OF THE SERVICE WORKER THAT KNOW ABOUT OFFLINE DOWNLOADS.
 *
 * Both are handed to vite.config.ts and end up in the generated sw.js — and
 * the way they get there shapes how they must be written. generateSW does not
 * bundle them; it calls .toString() on each function and pastes the text into
 * the worker. So:
 *
 *   EVERYTHING A FUNCTION HERE USES MUST BE WRITTEN INSIDE IT. An imported
 *   constant, a helper declared above, a module-level variable — each is a
 *   name the worker has never heard of, and it fails at the first image
 *   request rather than at build time.
 *
 * That is why the cache prefix and the query parameter appear below as bare
 * string literals instead of the constants in offlineCache.ts.
 * swPlugin.test.ts holds the two in step, and checks the functions still
 * mention nothing from outside themselves.
 */

/**
 * Which requests the anatomy image route handles: every picture, EXCEPT the
 * downloader's own fetches.
 *
 * A download goes through the same service worker as everything else the page
 * asks for, and left to the image route it would be answered cache-first —
 * handing the downloader the very copy it is trying to replace — and then
 * written into the runtime cache, pushing four hundred pictures the student
 * had actually looked at out of it. The downloader marks its requests with
 * `?offline=`, this declines them, and with no route claiming the request the
 * browser fetches it from the network as if there were no worker at all.
 */
export const isAnatomyImageRequest = ({ url }: { url: URL }): boolean =>
  url.pathname.startsWith('/anatomy/') && !url.searchParams.has('offline');

/**
 * A downloaded area's copy of a picture is used ahead of everything else.
 *
 * It rides on the CacheFirst image route as a plugin rather than being a route
 * of its own, because a route has to decide SYNCHRONOUSLY whether a request is
 * its to answer, and "is this file in a downloaded area" is a question only
 * Cache Storage can answer, asynchronously. cachedResponseWillBeUsed is the one
 * hook the strategy awaits before it settles on a response, and it is called
 * whether or not the runtime cache had anything.
 *
 * So the order a picture is looked for is:
 *
 *   1. the precache — panels in the app shell never reach this route at all;
 *   2. a downloaded area (here);
 *   3. the runtime cache, the four hundred most recent;
 *   4. the network.
 *
 * THE DOWNLOAD WINS OVER THE RUNTIME CACHE, not the other way round, because
 * it is the only copy that was checked against a hash. The runtime cache holds
 * whatever the server said on the day, which is how a redrawn plate came to be
 * shown in its old form for a month (anatomyCache.ts).
 *
 * MUST COME AFTER `expiration` IN THE ROUTE'S OPTIONS. Workbox emits plugins
 * in the order the option keys are written, and each one's hook is handed the
 * previous one's answer. The expiration plugin stamps a last-used time against
 * the runtime cache for any response it is shown; fed a downloaded picture it
 * would record an entry that cache does not hold, count it towards the four
 * hundred, and evict real pictures to make room for it.
 *
 * A failure here returns what the runtime cache had. Storage that throws is
 * not a reason to break a picture that would otherwise have loaded.
 */
export const offlineAreaPlugin = {
  cachedResponseWillBeUsed: async ({
    request,
    cachedResponse,
  }: {
    request: Request;
    cachedResponse?: Response;
  }): Promise<Response | undefined> => {
    try {
      for (const name of await caches.keys()) {
        if (!name.startsWith('locusmsk-offline-')) continue;
        const cache = await caches.open(name);
        const held = await cache.match(request.url, { ignoreVary: true });
        if (held) return held;
      }
    } catch {
      // Fall through to whatever the runtime cache had.
    }
    return cachedResponse;
  },
};
