import { AREAS, type Area } from '../../anatomy-revision/types/region';
import { diffManifest, type AreaManifest, type ManifestFile } from './manifest';
import {
  emptyRecord,
  OFFLINE_FILES_CACHE,
  readRecord,
  sha256Hex,
  writeRecord,
  type AreaRecord,
} from './offlineCache';
import type { OfflineSource } from './offlineSource';

/**
 * Brings one area's cache from whatever it holds to what the manifest says.
 *
 * ONE FUNCTION FOR DOWNLOAD, RESUME AND UPDATE. All three are "fetch what the
 * manifest has and the record does not, delete what the record has and the
 * manifest does not" (diffManifest), and keeping them one path is what makes a
 * download resumable for free: a tab closed at 60% leaves a record of the 60%,
 * and pressing the button again is simply a smaller diff.
 *
 * A FILE IS RECORDED ONLY AFTER ITS HASH HAS BEEN CHECKED. The site answers
 * any unknown path with index.html and a 200, a captive portal answers every
 * path with its login page, and a connection that drops mid-body can hand back
 * half a picture — all three are "successful" responses. The record is what
 * the app later trusts without looking, so nothing gets into it on the
 * strength of a status code.
 *
 * NOT EVERY FAILURE IS RETRIED FOREVER. Each file gets a few attempts with a
 * widening gap, and a run of files failing in a row stops the whole download
 * rather than grinding through a thousand timeouts: that pattern is a lost
 * connection, not a thousand bad files, and what has arrived is kept.
 */

/** The student pressed Cancel, or the page is going away. What had arrived is kept. */
export class DownloadCancelled extends Error {
  constructor() {
    super('Download cancelled.');
    this.name = 'DownloadCancelled';
  }
}

/** Some files could not be fetched or did not match their hash. What had arrived is kept. */
export class DownloadIncomplete extends Error {
  constructor(public readonly failed: number) {
    super(`${failed} ${failed === 1 ? 'file' : 'files'} could not be downloaded.`);
    this.name = 'DownloadIncomplete';
  }
}

/** The device does not have room. Raised before anything is fetched, or when the browser refuses a write. */
export class NotEnoughSpace extends Error {
  constructor(
    public readonly neededBytes: number,
    public readonly freeBytes: number | null,
  ) {
    super('Not enough storage space.');
    this.name = 'NotEnoughSpace';
  }
}

export interface DownloadProgress {
  doneBytes: number;
  totalBytes: number;
}

export interface DownloadOptions {
  area: Area;
  source: OfflineSource;
  storage: CacheStorage;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
  /** Bytes the browser will still let this site store, or null when it will not say. */
  freeBytes?: () => Promise<number | null>;
  /** Files in flight at once. Enough to fill a connection, few enough not to starve the session beside it. */
  concurrency?: number;
  /** Extra attempts per file after the first. */
  retries?: number;
  /** Injected in tests; hex SHA-256 of a buffer. */
  digest?: (data: ArrayBuffer) => Promise<string>;
  /** Injected in tests so retries do not really wait. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export const DEFAULT_CONCURRENCY = 5;
export const DEFAULT_RETRIES = 2;
/** Files failing one after another before the download gives up on the connection. */
const MAX_CONSECUTIVE_FAILURES = 8;
/** How often the record is written while a download runs, in files. */
const FLUSH_EVERY = 25;
/** Room asked for beyond the files themselves — Cache Storage pads what it stores. */
const SPACE_MARGIN = 1.1;

function contentTypeFor(url: string): string {
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
const isQuota = (error: unknown) => error instanceof DOMException && error.name === 'QuotaExceededError';

/**
 * Downloads or updates an area and returns its record once it is complete.
 *
 * Rejects with DownloadCancelled, DownloadIncomplete or NotEnoughSpace; in
 * every one of those cases the record on the device already describes exactly
 * what did arrive, so calling again carries on from there.
 */
export async function downloadArea(options: DownloadOptions): Promise<AreaRecord> {
  const {
    area,
    source,
    storage,
    signal,
    onProgress,
    freeBytes,
    concurrency = DEFAULT_CONCURRENCY,
    retries = DEFAULT_RETRIES,
    digest = sha256Hex,
    sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    now = () => new Date(),
  } = options;

  let manifest: AreaManifest;
  try {
    manifest = await source.fetchManifest(area, signal);
  } catch (error) {
    if (signal?.aborted || isAbort(error)) throw new DownloadCancelled();
    throw error;
  }

  const previous = (await readRecord(storage, area)) ?? emptyRecord(area);
  const diff = diffManifest(manifest, previous.files);

  // What another downloaded area already holds at the right hash is recorded
  // without being fetched or stored again — the second and third spine areas
  // cost a few megabytes, not forty each.
  const others = (await Promise.all(AREAS.filter((a) => a !== area).map((a) => readRecord(storage, a)))).filter(
    (r): r is AreaRecord => r !== null,
  );
  const sharedBytes = diff.toFetch
    .filter((file) => others.some((other) => other.files[file.url] === file.hash))
    .reduce((sum, file) => sum + file.bytes, 0);

  // Asked before anything is fetched: a download refused for space must leave
  // a working older copy exactly as it was.
  const neededBytes = diff.fetchBytes - sharedBytes;
  const free = freeBytes ? await freeBytes().catch(() => null) : null;
  if (free !== null && free < neededBytes * SPACE_MARGIN) throw new NotEnoughSpace(neededBytes, free);

  const cache = await storage.open(OFFLINE_FILES_CACHE);
  const files: Record<string, string> = { ...previous.files };
  const sizes: Record<string, number> = { ...previous.sizes };
  // Only taken off the record. The picture itself may be another area's too,
  // and is deleted by the controller's sweep once nothing lists it.
  for (const url of diff.toDelete) {
    delete files[url];
    delete sizes[url];
  }
  // A stale copy is dropped from the record before its replacement is fetched,
  // so a download that stops here never claims a hash it no longer holds. The
  // old picture stays in the cache and goes on being served until it is
  // overwritten — an old plate is better than none in a tunnel.
  for (const file of diff.toFetch) delete files[file.url];
  for (const file of manifest.files) if (files[file.url] !== undefined) sizes[file.url] = file.bytes;

  let doneBytes = diff.heldBytes;
  const record = (): AreaRecord => ({ ...previous, files: { ...files }, sizes: { ...sizes }, bytes: doneBytes });
  onProgress?.({ doneBytes, totalBytes: manifest.bytes });

  // The record is rewritten as the download goes; writes are chained so two
  // can never land out of order and leave the older one on disk.
  let writing: Promise<void> = Promise.resolve();
  const flush = () => {
    const snapshot = record();
    writing = writing.then(() => writeRecord(storage, snapshot)).catch(() => undefined);
    return writing;
  };

  const queue = [...diff.toFetch];
  let failed = 0;
  let consecutiveFailures = 0;
  let sinceFlush = 0;
  let outOfSpace = false;
  const stopped = () => signal?.aborted || outOfSpace || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

  /** True when the shared cache already holds this exact file — another area's, or a stopped download's. */
  const alreadyHeld = async (file: ManifestFile): Promise<boolean> => {
    try {
      const held = await cache.match(file.url);
      return held !== undefined && (await digest(await held.arrayBuffer())).startsWith(file.hash);
    } catch {
      return false;
    }
  };

  const fetchVerified = async (file: ManifestFile): Promise<ArrayBuffer> => {
    let lastError: unknown = new Error('not attempted');
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(400 * 3 ** (attempt - 1));
      if (signal?.aborted) break;
      try {
        const data = await source.fetchFile(file, signal);
        if ((await digest(data)).startsWith(file.hash)) return data;
        lastError = new Error(`${file.url} did not match its hash`);
      } catch (error) {
        if (isAbort(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  };

  const worker = async () => {
    while (!stopped()) {
      const file = queue.shift();
      if (!file) return;
      try {
        if (!(await alreadyHeld(file))) {
          const data = await fetchVerified(file);
          await cache.put(
            file.url,
            // Built fresh rather than stored as fetched: the body has been read
            // to hash it, and a response with no Date header can never be judged
            // "expired" by anything that later looks at it.
            new Response(data, {
              headers: { 'Content-Type': contentTypeFor(file.url), 'Content-Length': String(data.byteLength) },
            }),
          );
        }
        files[file.url] = file.hash;
        sizes[file.url] = file.bytes;
        doneBytes += file.bytes;
        consecutiveFailures = 0;
        onProgress?.({ doneBytes, totalBytes: manifest.bytes });
        if (++sinceFlush >= FLUSH_EVERY) {
          sinceFlush = 0;
          void flush();
        }
      } catch (error) {
        if (signal?.aborted || isAbort(error)) return;
        if (isQuota(error)) {
          outOfSpace = true;
          return;
        }
        failed += 1;
        consecutiveFailures += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  await flush();

  if (signal?.aborted) throw new DownloadCancelled();
  if (outOfSpace) throw new NotEnoughSpace(manifest.bytes - doneBytes, null);
  // Files left in the queue were never tried — the run was stopped — and they
  // are as missing as the ones that were tried and failed.
  if (failed > 0 || queue.length > 0) throw new DownloadIncomplete(failed + queue.length);

  const complete: AreaRecord = {
    ...record(),
    bytes: manifest.bytes,
    manifestHash: manifest.hash,
    completedAt: now().toISOString(),
  };
  writing = writing.then(() => writeRecord(storage, complete));
  await writing;
  return complete;
}
