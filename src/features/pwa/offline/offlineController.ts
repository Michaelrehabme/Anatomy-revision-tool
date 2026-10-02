import { AREAS, type Area } from '../../anatomy-revision/types/region';
import { areaStatus, type AreaStatus } from './areaStatus';
import {
  DownloadCancelled,
  DownloadIncomplete,
  NotEnoughSpace,
  downloadArea,
  type DownloadOptions,
} from './downloadArea';
import { autoUpdateDecision } from './autoUpdate';
import { diffManifest, formatBytes, parseOfflineIndex, type OfflineIndex } from './manifest';
import { offlineCacheName, readAllRecords, removeAreaCache, writeRecord, type AreaRecord } from './offlineCache';
import { staticOfflineSource, type OfflineSource } from './offlineSource';

/**
 * The one object that knows what is downloaded and what is downloading.
 *
 * OUTSIDE REACT ON PURPOSE. A download of the ankle and foot is sixty
 * megabytes and can take minutes; the Account screen that started it is
 * unmounted the moment the student goes back to revising, and the app mounts
 * a separate desktop and mobile tree besides. State held in a component would
 * lose the download on the first navigation. Held here, the download carries
 * on, and whichever screen is looking subscribes and sees it.
 *
 * It holds no truth of its own about what is on the device — that is the
 * record inside each cache (offlineCache.ts). This is the live part: which
 * downloads are running, how far along, what last went wrong, and the latest
 * index to compare against.
 */

export type OfflineSupport = 'checking' | 'ready' | 'unavailable';

export interface AreaView {
  area: Area;
  status: AreaStatus;
  /** The area's full size: from the index, or null before one has ever been seen. */
  totalBytes: number | null;
  /** Bytes held and verified. While downloading, this is the progress. */
  doneBytes: number;
  completedAt: string | null;
  /** Why the last download stopped, in words for the student. Null when it did not, or was cancelled. */
  error: string | null;
}

export interface OfflineSnapshot {
  support: OfflineSupport;
  areas: Record<Area, AreaView>;
  /** Everything the downloads hold, counting a file once per area that holds it — which is what it costs. */
  usedBytes: number;
  /** What the browser says is still available to this site, or null when it will not say. */
  freeBytes: number | null;
}

export interface ControllerDeps {
  source: OfflineSource;
  /** Null where the Cache API does not exist. */
  storage: CacheStorage | null;
  /** navigator.storage, where it exists. */
  storageManager?: Pick<StorageManager, 'estimate' | 'persist'> | null;
  /** Whether a service worker is there to serve what gets downloaded. */
  hasServiceWorker: () => Promise<boolean>;
  download?: (options: DownloadOptions) => Promise<AreaRecord>;
  /** Where the last index is remembered, so sizes still show with no network. */
  memo?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

const INDEX_MEMO_KEY = 'locusmsk:offline:index';

/** What a failed download says. Short, and each one names what to do next. */
export function describeFailure(error: unknown): string | null {
  if (error instanceof DownloadCancelled) return null;
  if (error instanceof NotEnoughSpace) {
    const free = error.freeBytes === null ? '' : `, and ${formatBytes(error.freeBytes)} is free`;
    return `Not enough space. This needs ${formatBytes(error.neededBytes)}${free}.`;
  }
  if (error instanceof DownloadIncomplete) return 'The download stopped. Check your connection, then resume.';
  return 'The download could not start. Check your connection and try again.';
}

export class OfflineController {
  private support: OfflineSupport = 'checking';
  private records: Partial<Record<Area, AreaRecord>> = {};
  private index: OfflineIndex | null = null;
  /** True once an index has come from the network this session, rather than from the memo. */
  private indexIsFresh = false;
  private active = new Map<Area, AbortController>();
  /** The running downloads nobody pressed a button for. */
  private quiet = new Set<Area>();
  private autoApplying = false;
  private autoApplyAgain: Parameters<OfflineController['autoApplyUpdates']>[0] | null = null;
  private progress = new Map<Area, number>();
  private errors = new Map<Area, string>();
  private freeBytes: number | null = null;
  private listeners = new Set<() => void>();
  private snapshot: OfflineSnapshot;
  private started: Promise<void> | null = null;

  constructor(private readonly deps: ControllerDeps) {
    this.snapshot = this.build();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): OfflineSnapshot => this.snapshot;

  /**
   * Finds out whether downloads can work here and what is already held. Safe
   * to call from every screen that mounts; it runs once.
   */
  start(): Promise<void> {
    this.started ??= (async () => {
      const { storage, memo } = this.deps;
      const supported = storage !== null && (await this.deps.hasServiceWorker().catch(() => false));
      if (!supported) {
        this.support = 'unavailable';
        this.emit();
        return;
      }
      try {
        this.index = parseOfflineIndex(JSON.parse(memo?.getItem(INDEX_MEMO_KEY) ?? 'null'));
      } catch {
        this.index = null;
      }
      this.records = await readAllRecords(storage);
      await this.measureSpace();
      this.support = 'ready';
      this.emit();
    })();
    return this.started;
  }

  /**
   * Fetches the index: the areas' sizes, and the hashes that say whether a
   * download is out of date. Quietly does nothing when the network is not
   * there — the remembered index and the records are enough to draw the list.
   */
  async refreshIndex(): Promise<void> {
    await this.start();
    if (this.support !== 'ready') return;
    try {
      this.index = await this.deps.source.fetchIndex();
      this.indexIsFresh = true;
      try {
        this.deps.memo?.setItem(INDEX_MEMO_KEY, JSON.stringify(this.index));
      } catch {
        // A full or blocked localStorage only costs the sizes shown offline.
      }
      this.emit();
    } catch {
      // Offline, or the deploy has no manifests. Nothing to compare against.
    }
  }

  /** Whether anything is held at all — the start-up check uses it to skip a request nobody needs. */
  hasDownloads(): boolean {
    return Object.keys(this.records).length > 0;
  }

  /**
   * Brings stale downloads up to date without being asked, where that is
   * cheap and allowed (autoUpdate.ts has the rule and the reasons). Called
   * once the entitlement has settled, and again if it changes; an area
   * already current, or already downloading, is passed over, so repeating it
   * costs one small request.
   *
   * FILES AN AREA NO LONGER INCLUDES ARE DELETED WHATEVER THE DECISION. A
   * retired plate is never shown again, so holding it is storage spent on
   * nothing — and deleting needs no download, no data and no entitlement.
   *
   * A quiet update that fails says nothing. The area is left as "Update
   * available" with its button, which is exactly where it would have been had
   * this never run; an error message about something the student did not ask
   * for would only read as the app breaking.
   */
  async autoApplyUpdates(facts: { canAccess: (area: Area) => boolean; saveData: boolean; online: boolean }): Promise<void> {
    await this.start();
    const { storage } = this.deps;
    if (this.support !== 'ready' || !storage || !this.hasDownloads() || !facts.online) return;
    // One pass at a time: the entitlement settling twice in quick succession
    // must not start two diffs over the same record.
    // The later call is not dropped, though — it carries the newer
    // entitlement, and runs when this pass is done.
    if (this.autoApplying) {
      this.autoApplyAgain = facts;
      return;
    }
    this.autoApplying = true;
    try {
      if (!this.indexIsFresh) await this.refreshIndex();
      for (const area of AREAS) {
        if (this.snapshot.areas[area].status !== 'update-available') continue;
        const record = this.records[area];
        if (!record) continue;
        let diff;
        try {
          diff = diffManifest(await this.deps.source.fetchManifest(area), record.files);
        } catch {
          continue;
        }
        const decision = autoUpdateDecision({
          online: facts.online,
          entitled: facts.canAccess(area),
          saveData: facts.saveData,
          fetchBytes: diff.fetchBytes,
        });
        if (decision === 'apply') await this.download(area, { quiet: true });
        else if (diff.toDelete.length > 0) await this.prune(storage, record, diff.toDelete);
      }
    } finally {
      this.autoApplying = false;
    }
    const again = this.autoApplyAgain;
    this.autoApplyAgain = null;
    if (again) await this.autoApplyUpdates(again);
  }

  /** Deletes retired files from an area that is otherwise being left as it is. */
  private async prune(storage: CacheStorage, record: AreaRecord, urls: readonly string[]): Promise<void> {
    try {
      const cache = await storage.open(offlineCacheName(record.area));
      const files = { ...record.files };
      let bytes = record.bytes;
      for (const url of urls) {
        // The record does not keep sizes; the copy being deleted knows its own.
        const held = await cache.match(url);
        if (held) bytes -= (await held.arrayBuffer()).byteLength;
        await cache.delete(url);
        delete files[url];
      }
      await writeRecord(storage, { ...record, files, bytes: Math.max(0, bytes) });
      this.records = await readAllRecords(storage);
      this.emit();
    } catch {
      // Left for the next start, or for the update itself, to clear.
    }
  }

  /**
   * Starts, resumes or updates an area. A second call while one is running is
   * ignored. `quiet` is the unasked update: no progress bar, no error text.
   */
  async download(area: Area, { quiet = false }: { quiet?: boolean } = {}): Promise<void> {
    await this.start();
    const { storage, storageManager } = this.deps;
    if (this.support !== 'ready' || !storage || this.active.has(area)) return;

    const abort = new AbortController();
    this.active.set(area, abort);
    if (quiet) this.quiet.add(area);
    this.errors.delete(area);
    this.progress.set(area, this.records[area]?.bytes ?? 0);
    this.emit();

    // Asks the browser not to evict this site's storage under pressure. It is
    // a request: Chrome grants it to an installed or much-used site, Safari
    // decides for itself. Not awaited — a browser that shows a prompt must not
    // hold the download up — and not acted on, since nothing can be done
    // about a refusal except the Home Screen advice the screen already gives.
    void storageManager?.persist?.().catch(() => false);

    let lastEmit = 0;
    try {
      await (this.deps.download ?? downloadArea)({
        area,
        source: this.deps.source,
        storage,
        signal: abort.signal,
        freeBytes: () => this.measureSpace(),
        onProgress: ({ doneBytes }) => {
          this.progress.set(area, doneBytes);
          // A thousand small files finish in bursts; redrawing on each would
          // re-render the whole list several hundred times a second.
          const t = Date.now();
          if (t - lastEmit > 200) {
            lastEmit = t;
            this.emit();
          }
        },
      });
    } catch (error) {
      const message = describeFailure(error);
      if (message && !quiet) this.errors.set(area, message);
    } finally {
      this.active.delete(area);
      this.quiet.delete(area);
      this.progress.delete(area);
      // The record on the device is the truth about what arrived, whichever
      // way the download ended.
      this.records = await readAllRecords(storage);
      await this.measureSpace();
      this.emit();
    }
  }

  cancel(area: Area): void {
    this.active.get(area)?.abort();
  }

  /** Deletes an area's pictures. A download in flight is stopped first. */
  async remove(area: Area): Promise<void> {
    const { storage } = this.deps;
    if (!storage) return;
    this.cancel(area);
    // Wait for the cancelled download to finish writing its record, or it
    // would recreate the cache just after it was deleted.
    while (this.active.has(area)) await new Promise((resolve) => setTimeout(resolve, 20));
    await removeAreaCache(storage, area);
    this.errors.delete(area);
    this.records = await readAllRecords(storage);
    await this.measureSpace();
    this.emit();
  }

  private async measureSpace(): Promise<number | null> {
    try {
      const estimate = await this.deps.storageManager?.estimate?.();
      this.freeBytes =
        estimate && typeof estimate.quota === 'number' && typeof estimate.usage === 'number'
          ? Math.max(0, estimate.quota - estimate.usage)
          : null;
    } catch {
      this.freeBytes = null;
    }
    return this.freeBytes;
  }

  private build(): OfflineSnapshot {
    const areas = {} as Record<Area, AreaView>;
    let usedBytes = 0;
    for (const area of AREAS) {
      const record = this.records[area] ?? null;
      const downloading = this.active.has(area);
      usedBytes += downloading ? (this.progress.get(area) ?? 0) : (record?.bytes ?? 0);
      areas[area] = {
        area,
        status: areaStatus({
          record,
          // A remembered index is good for sizes and useless for freshness: it
          // can only ever say what was current the last time it was online.
          latestHash: this.indexIsFresh ? (this.index?.areas[area].hash ?? null) : null,
          downloading,
          quiet: this.quiet.has(area),
        }),
        totalBytes: this.index?.areas[area].bytes ?? null,
        doneBytes: downloading ? (this.progress.get(area) ?? 0) : (record?.bytes ?? 0),
        completedAt: record?.completedAt ?? null,
        error: this.errors.get(area) ?? null,
      };
    }
    return { support: this.support, areas, usedBytes, freeBytes: this.freeBytes };
  }

  private emit(): void {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
  }
}

/**
 * Whether there is a service worker to serve a download. Without one the
 * files would sit in Cache Storage and never be used: the dev server and the
 * public demo build have none, nor does a browser with workers switched off.
 */
async function serviceWorkerRegistered(): Promise<boolean> {
  if (import.meta.env.VITE_PUBLIC_DEMO === '1') return false;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  return (await navigator.serviceWorker.getRegistration()) !== undefined;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let shared: OfflineController | null = null;

/** The app's one controller. Created on first use so importing this module costs nothing. */
export function offlineController(): OfflineController {
  shared ??= new OfflineController({
    source: staticOfflineSource,
    storage: typeof caches === 'undefined' ? null : caches,
    storageManager: typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null,
    hasServiceWorker: serviceWorkerRegistered,
    memo: safeLocalStorage(),
  });
  return shared;
}

/**
 * Run once when the app starts: if anything is downloaded and there is a
 * network, find out whether it is out of date, so the Account screen can say
 * "Update available" the moment it is opened rather than after a spinner.
 *
 * It only MARKS. Nothing is fetched beyond the index — a few hundred bytes —
 * because at this moment nobody knows yet whether the account may still have
 * the area: the entitlement is read after sign-in settles. Applying the small
 * updates is useOfflineAutoUpdate's job, once it does.
 */
export async function checkOfflineUpdatesOnStart(): Promise<void> {
  const controller = offlineController();
  await controller.start();
  if (!controller.hasDownloads()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await controller.refreshIndex();
}
