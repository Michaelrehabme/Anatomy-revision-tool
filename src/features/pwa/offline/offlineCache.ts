import { AREAS, type Area } from '../../anatomy-revision/types/region';
import type { HeldFiles } from './manifest';

/**
 * Where downloaded areas live: ONE Cache Storage cache for every area's
 * pictures, and beside it one small cache per area holding only the record of
 * what that area has.
 *
 * ONE PICTURE CACHE, NOT ONE PER AREA. Areas share plates — the three spine
 * areas most of all — and a cache per area stored each shared file once per
 * area that held it, about 20 MB a time on a phone. Shared, a file is stored
 * once however many areas list it. What that costs is that removing an area
 * can no longer be a bare `caches.delete`: the area's record goes at once, and
 * the pictures no remaining record lists are swept afterwards
 * (sweepUnreferenced), only while no download is running, because a download
 * stores a file a moment before its record says so.
 *
 * Sharing changes nothing about who may download what. A download is still of
 * one area's manifest, gated by that area's entitlement; the shared cache only
 * ever holds files some permitted area asked for.
 *
 * THE NAMES MUST NOT START WITH 'locusmsk-anatomy-images'. That prefix is the
 * runtime image cache, and purgeStaleAnatomyCaches deletes every cache
 * carrying it whenever the version is bumped — which would take a student's
 * downloads with it, silently, on the next deploy that redrew anything.
 *
 * THE RECORDS ARE IN CACHE STORAGE, NOT IN localStorage, so they and the
 * pictures cannot disagree. A browser under storage pressure — Safari after a
 * few weeks unused, most famously — evicts Cache Storage without telling
 * anyone, and it evicts a site's caches together. A record kept somewhere else
 * would go on saying "Downloaded" over an empty cache, and the student would
 * find out underground. Kept beside them, it is evicted with the pictures and
 * the area simply reads as not downloaded.
 */
export const OFFLINE_CACHE_PREFIX = 'locusmsk-offline-';

/** The query parameter the downloader marks its fetches with; see isAnatomyImageRequest. */
export const OFFLINE_FETCH_PARAM = 'offline';

/** An area's record. Before the picture cache was shared, its pictures too (migrateLegacyAreaCaches). */
export const offlineCacheName = (area: Area) => `${OFFLINE_CACHE_PREFIX}${area}`;

/** Every downloaded picture, whichever areas list it. Not an area name, so no record is ever looked for here. */
export const OFFLINE_FILES_CACHE = `${OFFLINE_CACHE_PREFIX}files`;

/**
 * The record's key within the cache. Outside /anatomy/ on purpose: the service
 * worker only ever looks pictures up, so it can never be served as one.
 */
const RECORD_URL = '/offline/__record.json';

export const OFFLINE_RECORD_VERSION = 1;

export interface AreaRecord {
  version: number;
  area: Area;
  /** Every picture in the cache that was verified, with the hash it was verified against. */
  files: HeldFiles;
  /** The size of those files, as their manifest gave it. */
  bytes: number;
  /**
   * Each file's size, so files two areas share are counted once in what the
   * device holds. Absent from records written before the cache was shared.
   */
  sizes?: Readonly<Record<string, number>>;
  /**
   * The manifest this area was last brought completely up to date with, or
   * null while a download has never finished. Comparing it to the index is the
   * whole update check.
   */
  manifestHash: string | null;
  /** ISO, when that happened. */
  completedAt: string | null;
}

export const emptyRecord = (area: Area): AreaRecord => ({
  version: OFFLINE_RECORD_VERSION,
  area,
  files: {},
  bytes: 0,
  manifestHash: null,
  completedAt: null,
});

function parseRecord(raw: unknown, area: Area): AreaRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<AreaRecord>;
  if (r.version !== OFFLINE_RECORD_VERSION || r.area !== area) return null;
  if (typeof r.files !== 'object' || r.files === null || typeof r.bytes !== 'number') return null;
  return {
    version: OFFLINE_RECORD_VERSION,
    area,
    files: r.files,
    bytes: r.bytes,
    ...(typeof r.sizes === 'object' && r.sizes !== null ? { sizes: r.sizes } : {}),
    manifestHash: typeof r.manifestHash === 'string' ? r.manifestHash : null,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : null,
  };
}

/**
 * What the device holds for an area, or null when it holds nothing. Never
 * creates the cache: `caches.open` would, and an empty cache per area would
 * appear on a device that had only ever looked at the list.
 */
export async function readRecord(storage: CacheStorage, area: Area): Promise<AreaRecord | null> {
  try {
    const name = offlineCacheName(area);
    if (!(await storage.has(name))) return null;
    const cache = await storage.open(name);
    const response = await cache.match(RECORD_URL);
    return response ? parseRecord(await response.json(), area) : null;
  } catch {
    return null;
  }
}

export async function writeRecord(storage: CacheStorage, record: AreaRecord): Promise<void> {
  const cache = await storage.open(offlineCacheName(record.area));
  await cache.put(
    RECORD_URL,
    new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }),
  );
}

/**
 * Deletes an area's record, so it reads as not downloaded at once. Its
 * pictures stay until sweepUnreferenced, which keeps the ones another area
 * still lists. True if there was anything to delete.
 */
export function removeAreaCache(storage: CacheStorage, area: Area): Promise<boolean> {
  return storage.delete(offlineCacheName(area));
}

/** Hex SHA-256. Here rather than imported from downloadArea, which imports this module. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pathOf = (request: Request) => new URL(request.url, 'https://offline.invalid').pathname;

/**
 * Deletes every downloaded picture no area's record lists: an area removed,
 * a plate an update retired, a file left over from a download that stopped.
 *
 * NEVER WHILE A DOWNLOAD RUNS. A download puts a file and records it a moment
 * later (the record is written every few files), so in between the file is
 * unreferenced and this would take it. The controller calls it only when it
 * has no download in flight, and holds new downloads until it is done.
 */
export async function sweepUnreferenced(storage: CacheStorage): Promise<void> {
  if (!(await storage.has(OFFLINE_FILES_CACHE))) return;
  const records = Object.values(await readAllRecords(storage));
  const wanted = new Set(records.flatMap((record) => Object.keys(record.files)));
  const cache = await storage.open(OFFLINE_FILES_CACHE);
  for (const request of await cache.keys()) {
    if (!wanted.has(pathOf(request))) await cache.delete(request);
  }
}

/**
 * Moves pictures out of the per-area caches an older version of the app kept
 * them in, into the shared one, so an update costs no download. Safe to run on
 * every start: an area cache holding only its record has nothing to move.
 *
 * Two areas downloaded on different days can hold different versions of one
 * file. Only one copy can stay, so the area whose version did NOT stay has the
 * file taken off its record and is marked incomplete, and its next download
 * fetches that one file again; a record never claims a hash it does not hold.
 */
export async function migrateLegacyAreaCaches(
  storage: CacheStorage,
  digest: (data: ArrayBuffer) => Promise<string> = sha256Hex,
): Promise<void> {
  // Opened only once there is something to move: `open` creates the cache,
  // and a device that never downloaded anything should not gain an empty one.
  let opened: Cache | null = null;
  const sharedCache = async () => (opened ??= await storage.open(OFFLINE_FILES_CACHE));
  /** url -> the hash of the copy now in the shared cache. */
  const kept = new Map<string, string>();
  for (const area of AREAS) {
    const record = await readRecord(storage, area);
    if (!record) continue;
    const cache = await storage.open(offlineCacheName(area));
    const files: Record<string, string> = { ...record.files };
    let bytes = record.bytes;
    let changed = false;
    for (const request of await cache.keys()) {
      const url = pathOf(request);
      if (url === RECORD_URL) continue;
      const response = await cache.match(request);
      const hash = record.files[url];
      if (response && hash !== undefined) {
        if (!kept.has(url)) {
          // Already there only if an earlier start was interrupted part way.
          const there = await (await sharedCache()).match(url);
          if (there) kept.set(url, (await digest(await there.arrayBuffer())).slice(0, hash.length));
        }
        const keptHash = kept.get(url);
        if (keptHash === undefined) {
          await (await sharedCache()).put(url, response);
          kept.set(url, hash);
        } else if (keptHash !== hash) {
          bytes -= Number(response.headers.get('Content-Length') ?? 0);
          delete files[url];
          changed = true;
        }
      }
      await cache.delete(request);
    }
    if (changed) {
      await writeRecord(storage, { ...record, files, bytes: Math.max(0, bytes), manifestHash: null, completedAt: null });
    }
  }
}

/**
 * What the device holds across every area, a file shared by several counted
 * once. A record from before the cache was shared has no sizes and is counted
 * whole.
 */
export function heldBytes(records: readonly AreaRecord[]): number {
  const counted = new Map<string, number>();
  let unsized = 0;
  for (const record of records) {
    const sizes = record.sizes;
    const urls = Object.keys(record.files);
    if (!sizes || urls.some((url) => sizes[url] === undefined)) {
      unsized += record.bytes;
      continue;
    }
    for (const url of urls) counted.set(url, sizes[url]);
  }
  let total = unsized;
  for (const size of counted.values()) total += size;
  return total;
}

/** Every area's record, for the areas that have one. */
export async function readAllRecords(storage: CacheStorage): Promise<Partial<Record<Area, AreaRecord>>> {
  const records: Partial<Record<Area, AreaRecord>> = {};
  await Promise.all(
    AREAS.map(async (area) => {
      const record = await readRecord(storage, area);
      if (record) records[area] = record;
    }),
  );
  return records;
}
