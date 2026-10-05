import type { Area } from '../types/region';
import type { StructureFacts } from '../types/structureIndex';

/**
 * The areas this device has been given, kept so they can be shown again
 * without asking — on a train, in a lecture theatre basement
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, "Offline").
 *
 * KEYED `uid:area:version`. By account, because the facts were granted to an
 * account and a second person signing in on the same device was not that
 * account. By version, because a copy is only current for the content it was
 * cut from. One copy per account and area is kept: writing a new version
 * deletes the old.
 *
 * EVERY COPY CARRIES ITS LEASE — the moment after which it must not be shown
 * without the server saying so again (data/content/lease.ts). The lease is
 * read and judged by areaFacts.ts; this file only stores it.
 *
 * INDEXEDDB, not localStorage and not Cache Storage. An area is tens of
 * kilobytes and nine of them would crowd localStorage's five megabytes, which
 * the app's own preferences share; and Cache Storage is what the service
 * worker serves from, where a keyed-by-URL copy of the paid content is one
 * routing mistake from being handed to any page that asks.
 *
 * NOTHING HERE THROWS. Private browsing, a full disk, a browser that has
 * evicted the database: each makes the cache behave as an empty one, and the
 * app goes to the network as if it had never held anything. A cache that can
 * fail a revision session is worse than no cache.
 *
 * WHAT IT DOES NOT DO: hide anything. IndexedDB is readable by the account
 * holder in devtools. That is content they were entitled to when it was
 * fetched; the design says so plainly, and so should this.
 */

export interface CachedArea {
  uid: string;
  area: Area;
  /** The content version the server stamped on these facts. */
  version: string;
  /**
   * The version this app's bundle asked with. Usually the same. When the
   * bundle is older than the server, the two differ — and without this the
   * app would see "not my version" on every start and fetch again every time.
   */
  askedWith: string;
  /** ISO. See data/content/lease.ts. */
  leaseUntil: string;
  /** ISO. When it was fetched, so a lease is not renewed more than once a day. */
  fetchedAt: string;
  structures: StructureFacts[];
}

export interface ContentCache {
  /** The copy held for this account and area, or null. */
  get(uid: string, area: Area): Promise<CachedArea | null>;
  /** Stores a copy, replacing any other version held for the same account and area. */
  put(entry: CachedArea): Promise<void>;
  remove(uid: string, area: Area): Promise<void>;
  /** Everything held for one account. */
  list(uid: string): Promise<CachedArea[]>;
  /** Deletes every copy belonging to any OTHER account. */
  keepOnly(uid: string): Promise<void>;
  /** Deletes everything. */
  clear(): Promise<void>;
}

export const CONTENT_DB_NAME = 'locusmsk-content';
const STORE = 'areas';

export const cacheKey = (uid: string, area: Area, version: string) => `${uid}:${area}:${version}`;

/** Is this something put() could have written? A database from a future build, or a hand edit, reads as nothing. */
function isCachedArea(value: unknown): value is CachedArea {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CachedArea>;
  return (
    typeof v.uid === 'string' &&
    typeof v.area === 'string' &&
    typeof v.version === 'string' &&
    typeof v.leaseUntil === 'string' &&
    typeof v.fetchedAt === 'string' &&
    Array.isArray(v.structures)
  );
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * The cache over a real IndexedDB. `factory` is the global by default; a test
 * or a browser without one passes nothing and gets a cache that holds nothing.
 */
export function createIndexedDbContentCache(factory: IDBFactory | undefined = globalThis.indexedDB): ContentCache {
  let opening: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new Error('IndexedDB is not available'));
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(CONTENT_DB_NAME, 1);
      req.onupgradeneeded = () => {
        // The key is the whole of `uid:area:version`; every lookup is a prefix of it.
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        // Another tab upgrading or deleting the database must not be blocked by this one.
        req.result.onversionchange = () => {
          req.result.close();
          opening = null;
        };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('The content database is blocked by another tab'));
    }).catch((error) => {
      opening = null;
      throw error;
    });
    return opening;
  };

  /** Every key starting with `prefix`. '￿' sorts after anything a uid, area or version contains. */
  const range = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}￿`);

  async function entries(prefix: string): Promise<{ key: IDBValidKey; value: CachedArea }[]> {
    const db = await open();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const [keys, values] = await Promise.all([request(store.getAllKeys(range(prefix))), request(store.getAll(range(prefix)))]);
    return keys.map((key, i) => ({ key, value: values[i] as CachedArea })).filter((e) => isCachedArea(e.value));
  }

  async function deleteWhere(keep: (key: string) => boolean): Promise<void> {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const key of await request(store.getAllKeys())) {
      if (!keep(String(key))) store.delete(key);
    }
    await done(tx);
  }

  return {
    async get(uid, area) {
      try {
        const found = await entries(`${uid}:${area}:`);
        // One is kept per account and area; if a crashed write left two, the latest fetch wins.
        return found.map((e) => e.value).sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0] ?? null;
      } catch {
        return null;
      }
    },
    async put(entry) {
      try {
        const db = await open();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const own = cacheKey(entry.uid, entry.area, entry.version);
        for (const key of await request(store.getAllKeys(range(`${entry.uid}:${entry.area}:`)))) {
          if (key !== own) store.delete(key);
        }
        store.put(entry, own);
        await done(tx);
      } catch {
        // Not saved. The facts are still in memory for this visit.
      }
    },
    async remove(uid, area) {
      try {
        const db = await open();
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(range(`${uid}:${area}:`));
        await done(tx);
      } catch {
        // Nothing to remove from a cache that cannot be opened.
      }
    },
    async list(uid) {
      try {
        return (await entries(`${uid}:`)).map((e) => e.value);
      } catch {
        return [];
      }
    },
    async keepOnly(uid) {
      try {
        await deleteWhere((key) => key.startsWith(`${uid}:`));
      } catch {
        // As above.
      }
    },
    async clear() {
      try {
        const db = await open();
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        await done(tx);
      } catch {
        // As above.
      }
    },
  };
}

/**
 * The same cache held in a Map. For the tests (jsdom has no IndexedDB) — the
 * rules of what is kept and replaced are the same code path either way, since
 * both are written against ContentCache and exercised by areaFacts.test.ts.
 */
export function createMemoryContentCache(seed: CachedArea[] = []): ContentCache & { entries(): CachedArea[] } {
  const held = new Map<string, CachedArea>(seed.map((e) => [cacheKey(e.uid, e.area, e.version), e]));
  const prefixed = (prefix: string) => [...held.entries()].filter(([key]) => key.startsWith(prefix));
  return {
    entries: () => [...held.values()],
    async get(uid, area) {
      return prefixed(`${uid}:${area}:`).map(([, v]) => v).sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0] ?? null;
    },
    async put(entry) {
      for (const [key] of prefixed(`${entry.uid}:${entry.area}:`)) held.delete(key);
      held.set(cacheKey(entry.uid, entry.area, entry.version), entry);
    },
    async remove(uid, area) {
      for (const [key] of prefixed(`${uid}:${area}:`)) held.delete(key);
    },
    async list(uid) {
      return prefixed(`${uid}:`).map(([, v]) => v);
    },
    async keepOnly(uid) {
      for (const key of [...held.keys()]) if (!key.startsWith(`${uid}:`)) held.delete(key);
    },
    async clear() {
      held.clear();
    },
  };
}
