import { AREAS, type Area } from '../../anatomy-revision/types/region';

/**
 * The shape of an offline download, and the arithmetic over it. No browser
 * API and no file system in here: the build script writes these, the app
 * reads them, and both need to agree without either importing the other's
 * world.
 *
 * TWO FILES PER DEPLOY, under /offline/:
 *
 *   index.json      nine lines — each area's size, file count and hash. Small
 *                   enough to fetch on every start, which is the whole update
 *                   check: one request, nine string comparisons.
 *   <area>.json     every file the area needs, with its size and hash. Only
 *                   fetched when that area is downloaded or updated.
 *
 * NEITHER IS IMPORTED INTO THE BUNDLE. Together they are several hundred
 * kilobytes of paths, and the entry chunk is within a few percent of the 2 MiB
 * a service worker will precache.
 *
 * WHY A HASH PER FILE AND NOT JUST THE URL. A re-render reuses the filename —
 * the same fact anatomyCache.ts is built around — so the URL cannot say
 * whether the copy on a device is the current picture. The hash can, and it is
 * also what lets an update fetch the forty plates that changed rather than the
 * whole area again.
 */

export const OFFLINE_MANIFEST_VERSION = 1;

/** Where the manifests are served from. One constant: the script and the app both use it. */
export const OFFLINE_MANIFEST_DIR = '/offline';

export const manifestUrl = (area: Area) => `${OFFLINE_MANIFEST_DIR}/${area}.json`;
export const INDEX_URL = `${OFFLINE_MANIFEST_DIR}/index.json`;

/** How much of a file's SHA-256 is kept, in hex characters. 64 bits: ample for telling two renders apart. */
export const HASH_LENGTH = 16;

export interface ManifestFile {
  /** Site-absolute, exactly as the app requests it: "/anatomy/joints/….webp". */
  url: string;
  bytes: number;
  /** The first HASH_LENGTH hex characters of the file's SHA-256. */
  hash: string;
}

export interface AreaManifest {
  version: number;
  area: Area;
  /** A hash over every file's url and hash — changes when any file is added, removed or redrawn. */
  hash: string;
  bytes: number;
  files: ManifestFile[];
}

export interface AreaSummary {
  bytes: number;
  files: number;
  hash: string;
}

export interface OfflineIndex {
  version: number;
  areas: Record<Area, AreaSummary>;
}

/** The text an area's own hash is taken over. Sorted by url so seed order cannot change it. */
export function manifestHashInput(files: readonly ManifestFile[]): string {
  return [...files]
    .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
    .map((f) => `${f.url}:${f.hash}`)
    .join('\n');
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isHash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8,64}$/.test(value);
const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Reads an area manifest out of whatever the network returned, or null.
 *
 * NEVER TRUST THE RESPONSE TO BE A MANIFEST. The site's SPA fallback answers
 * any unknown path with index.html and a 200, so a deploy that somehow lost
 * /offline/ would hand back a web page with a success status — and a manifest
 * read carelessly from that is "this area has no files", which an update would
 * act on by deleting everything the student had downloaded.
 *
 * A file outside /anatomy/ is refused for the same kind of reason: the
 * manifest decides what gets written into a cache the service worker serves
 * from, and it should not be able to name anything but pictures.
 */
export function parseAreaManifest(raw: unknown, area: Area): AreaManifest | null {
  if (!isRecord(raw) || raw.version !== OFFLINE_MANIFEST_VERSION || raw.area !== area) return null;
  if (!isHash(raw.hash) || !isSize(raw.bytes) || !Array.isArray(raw.files) || raw.files.length === 0) return null;
  const files: ManifestFile[] = [];
  for (const entry of raw.files) {
    if (!isRecord(entry)) return null;
    const { url, bytes, hash } = entry;
    if (typeof url !== 'string' || !url.startsWith('/anatomy/') || url.includes('..')) return null;
    if (!isSize(bytes) || !isHash(hash)) return null;
    files.push({ url, bytes, hash });
  }
  return { version: OFFLINE_MANIFEST_VERSION, area, hash: raw.hash, bytes: raw.bytes, files };
}

/** Reads the index, or null. An area missing from it fails the whole read — see parseAreaManifest. */
export function parseOfflineIndex(raw: unknown): OfflineIndex | null {
  if (!isRecord(raw) || raw.version !== OFFLINE_MANIFEST_VERSION || !isRecord(raw.areas)) return null;
  const areas = {} as Record<Area, AreaSummary>;
  for (const area of AREAS) {
    const entry = raw.areas[area];
    if (!isRecord(entry) || !isSize(entry.bytes) || !isSize(entry.files) || !isHash(entry.hash)) return null;
    areas[area] = { bytes: entry.bytes, files: entry.files, hash: entry.hash };
  }
  return { version: OFFLINE_MANIFEST_VERSION, areas };
}

/** What a device holds for an area: url -> the hash of the copy it verified. */
export type HeldFiles = Readonly<Record<string, string>>;

export interface ManifestDiff {
  /** New, or redrawn since the held copy was fetched. */
  toFetch: ManifestFile[];
  /** Held, but no longer part of the area. */
  toDelete: string[];
  fetchBytes: number;
  /** Bytes already held and still current — where a resumed download's progress bar starts. */
  heldBytes: number;
}

/**
 * What it takes to bring a device from what it holds to what the manifest
 * says. The same function is a first download (nothing held), a resume (some
 * held), and an update (some held copies stale) — which is why a download that
 * dies halfway needs no special path to pick up again.
 */
export function diffManifest(manifest: AreaManifest, held: HeldFiles): ManifestDiff {
  const toFetch: ManifestFile[] = [];
  let fetchBytes = 0;
  let heldBytes = 0;
  const wanted = new Set<string>();
  for (const file of manifest.files) {
    wanted.add(file.url);
    if (held[file.url] === file.hash) {
      heldBytes += file.bytes;
    } else {
      toFetch.push(file);
      fetchBytes += file.bytes;
    }
  }
  const toDelete = Object.keys(held).filter((url) => !wanted.has(url));
  return { toFetch, toDelete, fetchBytes, heldBytes };
}

/** "62 MB", "9.8 MB", "640 KB". Decimal units, as phones and app stores report storage. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e7) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}
