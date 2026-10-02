import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANATOMY_CACHE_NAME } from '../../anatomyCache';
import { OFFLINE_CACHE_PREFIX, OFFLINE_FETCH_PARAM, offlineCacheName } from '../offlineCache';
import { isAnatomyImageRequest, offlineAreaPlugin } from '../swPlugin';
import { fakeStorage } from './fakeCaches';

/**
 * These two functions are pasted into sw.js as TEXT (swPlugin.ts explains),
 * so half of what is worth testing is the text itself: that it carries the
 * same literals the app uses, and leans on nothing declared outside it.
 */
const pluginSource = offlineAreaPlugin.cachedResponseWillBeUsed.toString();
const matcherSource = isAnatomyImageRequest.toString();

describe('the service worker pieces, as text', () => {
  it('carry the same cache prefix and query parameter the app uses', () => {
    // Whichever quotes the compiler settled on.
    expect(pluginSource).toMatch(new RegExp(`startsWith\\(["']${OFFLINE_CACHE_PREFIX}["']\\)`));
    expect(matcherSource).toMatch(new RegExp(`has\\(["']${OFFLINE_FETCH_PARAM}["']\\)`));
  });

  it('use no name from outside themselves', () => {
    // Anything imported shows up in the compiled text as a module binding.
    for (const source of [pluginSource, matcherSource]) {
      expect(source).not.toMatch(/OFFLINE_|__vite|_import|offlineCache/);
    }
  });

  // purgeStaleAnatomyCaches deletes every cache with the runtime prefix on a
  // version bump. A download named like one would go with it.
  it('keeps downloads out of reach of the runtime cache purge', () => {
    expect(OFFLINE_CACHE_PREFIX.startsWith('locusmsk-anatomy-images')).toBe(false);
    expect(ANATOMY_CACHE_NAME.startsWith(OFFLINE_CACHE_PREFIX)).toBe(false);
  });
});

describe('isAnatomyImageRequest', () => {
  const at = (path: string) => ({ url: new URL(path, 'https://locusmsk.com') });

  it('takes pictures', () => {
    expect(isAnatomyImageRequest(at('/anatomy/joints/knee-a000-plate.webp'))).toBe(true);
  });

  it("leaves the downloader's own fetches to the network", () => {
    expect(isAnatomyImageRequest(at(`/anatomy/joints/knee-a000-plate.webp?${OFFLINE_FETCH_PARAM}=0123abcd`))).toBe(false);
  });

  it('leaves everything else alone', () => {
    expect(isAnatomyImageRequest(at('/offline/knee.json'))).toBe(false);
    expect(isAnatomyImageRequest(at('/assets/index.js'))).toBe(false);
  });
});

describe('offlineAreaPlugin', () => {
  const url = 'https://locusmsk.com/anatomy/joints/knee-a000-plate.webp';
  const request = new Request(url);
  const runtimeCopy = () => new Response('from the runtime cache');

  afterEach(() => vi.unstubAllGlobals());

  it('serves the downloaded copy ahead of the runtime cache', async () => {
    const { storage } = fakeStorage();
    await (await storage.open(offlineCacheName('knee'))).put(url, new Response('downloaded'));
    vi.stubGlobal('caches', storage);

    const used = await offlineAreaPlugin.cachedResponseWillBeUsed({ request, cachedResponse: runtimeCopy() });
    expect(await used!.text()).toBe('downloaded');
  });

  it('serves the downloaded copy when the runtime cache has nothing — the offline case', async () => {
    const { storage } = fakeStorage();
    await (await storage.open(offlineCacheName('knee'))).put(url, new Response('downloaded'));
    vi.stubGlobal('caches', storage);

    const used = await offlineAreaPlugin.cachedResponseWillBeUsed({ request });
    expect(await used!.text()).toBe('downloaded');
  });

  it('passes the runtime copy through for a picture no downloaded area holds', async () => {
    const { storage } = fakeStorage();
    await (await storage.open(offlineCacheName('elbow'))).put('/anatomy/joints/other.webp', new Response('x'));
    vi.stubGlobal('caches', storage);

    const used = await offlineAreaPlugin.cachedResponseWillBeUsed({ request, cachedResponse: runtimeCopy() });
    expect(await used!.text()).toBe('from the runtime cache');
    expect(await offlineAreaPlugin.cachedResponseWillBeUsed({ request })).toBeUndefined();
  });

  it('never looks in a cache that is not a download', async () => {
    const { storage } = fakeStorage();
    await (await storage.open('workbox-precache-v2')).put(url, new Response('precache'));
    await (await storage.open(ANATOMY_CACHE_NAME)).put(url, new Response('stale runtime'));
    vi.stubGlobal('caches', storage);

    expect(await offlineAreaPlugin.cachedResponseWillBeUsed({ request })).toBeUndefined();
  });

  it('falls back to the runtime copy when storage throws', async () => {
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new Error('storage blocked');
      },
    });
    const used = await offlineAreaPlugin.cachedResponseWillBeUsed({ request, cachedResponse: runtimeCopy() });
    expect(await used!.text()).toBe('from the runtime cache');
  });
});
