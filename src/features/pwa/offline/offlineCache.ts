import { AREAS, type Area } from '../../anatomy-revision/types/region';
import type { HeldFiles } from './manifest';

/**
 * Where a downloaded area lives: one Cache Storage cache per area, and inside
 * it, beside the pictures, the record of what it holds.
 *
 * ONE CACHE PER AREA so that removing an area is `caches.delete` and nothing
 * else — no walking a shared cache working out which files another area still
 * needs. The price is that a file two areas share is stored twice; that is the
 * spine's three areas, about 20 MB each way, and it is paid in storage only
 * (the downloader copies from the other area instead of fetching again).
 *
 * THE NAME MUST NOT START WITH 'locusmsk-anatomy-images'. That prefix is the
 * runtime image cache, and purgeStaleAnatomyCaches deletes every cache
 * carrying it whenever the version is bumped — which would take a student's
 * downloads with it, silently, on the next deploy that redrew anything.
 *
 * THE RECORD IS IN THE CACHE, NOT IN localStorage, so the two cannot disagree.
 * A browser under storage pressure — Safari after a few weeks unused, most
 * famously — evicts Cache Storage without telling anyone. A record kept
 * somewhere else would go on saying "Downloaded" over an empty cache, and the
 * student would find out underground. Kept inside, it is evicted with the
 * pictures and the area simply reads as not downloaded.
 */
export const OFFLINE_CACHE_PREFIX = 'locusmsk-offline-';

/** The query parameter the downloader marks its fetches with; see isAnatomyImageRequest. */
export const OFFLINE_FETCH_PARAM = 'offline';

export const offlineCacheName = (area: Area) => `${OFFLINE_CACHE_PREFIX}${area}`;

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

/** Deletes an area's pictures and its record together. True if there was anything to delete. */
export function removeAreaCache(storage: CacheStorage, area: Area): Promise<boolean> {
  return storage.delete(offlineCacheName(area));
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
