/**
 * Cache Storage, as much of it as the offline downloads use, held in memory.
 * jsdom has no Cache API, and what these tests need to see is which URLs ended
 * up in which cache — not anything about how a browser stores them.
 */
class FakeCache {
  readonly entries = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(keyOf(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(keyOf(request), response);
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(keyOf(request));
  }
}

/** A cache is keyed by path here: the tests never mix origins. */
function keyOf(request: RequestInfo | URL): string {
  const raw = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  return raw.replace(/^https?:\/\/[^/]+/, '');
}

export class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async open(name: string): Promise<Cache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache as unknown as Cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  /** The picture URLs a cache holds — everything but the record. */
  pictures(name: string): string[] {
    return [...(this.caches.get(name)?.entries.keys() ?? [])].filter((url) => url.startsWith('/anatomy/')).sort();
  }
}

export const fakeStorage = () => {
  const fake = new FakeCacheStorage();
  return { storage: fake as unknown as CacheStorage, fake };
};
