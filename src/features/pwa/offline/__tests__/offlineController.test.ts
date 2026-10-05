import { describe, expect, it } from 'vitest';
import { AREAS, type Area } from '../../../anatomy-revision/types/region';
import { DownloadCancelled, DownloadIncomplete, NotEnoughSpace } from '../downloadArea';
import type { AreaManifest, OfflineIndex } from '../manifest';
import { offlineCacheName } from '../offlineCache';
import { FACTS_PENDING, FactsRefused, OfflineController, describeFailure, type ControllerDeps } from '../offlineController';
import { downloadPromise } from '../areaFactsPrefetch';
import type { OfflineSource } from '../offlineSource';
import { fakeStorage } from './fakeCaches';

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

/** SHA-256 of "aaaa" and "bbbb", shortened — the real digest runs in these tests. */
const FILES = [
  { url: '/anatomy/joints/a.webp', bytes: 4, hash: '61be55a8e2f6b4e1', body: 'aaaa' },
  { url: '/anatomy/joints/b.webp', bytes: 4, hash: '81cc5b17018674b4', body: 'bbbb' },
];

const manifest = (area: Area, hash: string): AreaManifest => ({
  version: 1,
  area,
  hash,
  bytes: 8,
  files: FILES.map(({ url, bytes: size, hash: h }) => ({ url, bytes: size, hash: h })),
});

const indexWith = (hash: string): OfflineIndex => ({
  version: 1,
  areas: Object.fromEntries(AREAS.map((a) => [a, { bytes: 8, files: 2, hash }])) as OfflineIndex['areas'],
});

function setup(overrides: Partial<ControllerDeps> = {}) {
  const { storage, fake } = fakeStorage();
  const server = { hash: '1111111111111111', online: true };
  const source: OfflineSource = {
    fetchIndex: async () => {
      if (!server.online) throw new Error('offline');
      return indexWith(server.hash);
    },
    fetchManifest: async (area) => manifest(area, server.hash),
    fetchFile: async (file) => bytes(FILES.find((f) => f.url === file.url)!.body),
  };
  const controller = new OfflineController({
    source,
    storage,
    hasServiceWorker: async () => true,
    storageManager: { estimate: async () => ({ quota: 1000, usage: 100 }), persist: async () => true },
    ...overrides,
  });
  return { controller, fake, storage, server };
}

describe('OfflineController', () => {
  it('is unavailable with no service worker, or no Cache API, and does nothing when asked to download', async () => {
    const noWorker = setup({ hasServiceWorker: async () => false });
    await noWorker.controller.start();
    expect(noWorker.controller.getSnapshot().support).toBe('unavailable');
    await noWorker.controller.download('elbow');
    expect(noWorker.fake.caches.size).toBe(0);

    const noCaches = setup({ storage: null });
    await noCaches.controller.start();
    expect(noCaches.controller.getSnapshot().support).toBe('unavailable');
  });

  it('asks again when the service worker was not there the first time, as on a first visit', async () => {
    let registered = false;
    const { controller } = setup({ hasServiceWorker: async () => registered });
    await controller.start();
    expect(controller.getSnapshot().support).toBe('unavailable');

    registered = true;
    await controller.start();
    expect(controller.getSnapshot().support).toBe('ready');
  });

  it('says when the worker in control does not hand out downloads, without hiding the list', async () => {
    const stale = setup({ servesDownloads: async () => false });
    await stale.controller.start();
    expect(stale.controller.getSnapshot().support).toBe('ready');
    expect(stale.controller.getSnapshot().serving).toBe(false);

    const current = setup({ servesDownloads: async () => true });
    await current.controller.start();
    expect(current.controller.getSnapshot().serving).toBe(true);
  });

  it('walks an area from not downloaded, to downloaded, to update available, to removed', async () => {
    const { controller, fake, server } = setup();
    await controller.start();
    await controller.refreshIndex();
    expect(controller.getSnapshot().areas.elbow).toMatchObject({ status: 'not-downloaded', totalBytes: 8 });
    expect(controller.getSnapshot().freeBytes).toBe(900);

    const seen: string[] = [];
    controller.subscribe(() => seen.push(controller.getSnapshot().areas.elbow.status));
    await controller.download('elbow');
    expect(seen).toContain('downloading');
    expect(controller.getSnapshot().areas.elbow).toMatchObject({ status: 'downloaded', doneBytes: 8, error: null });
    expect(controller.getSnapshot().usedBytes).toBe(8);
    expect(fake.pictures(offlineCacheName('elbow'))).toHaveLength(2);

    // A deploy redraws something.
    server.hash = '2222222222222222';
    await controller.refreshIndex();
    expect(controller.getSnapshot().areas.elbow.status).toBe('update-available');
    // Only the area that is held is affected.
    expect(controller.getSnapshot().areas.knee.status).toBe('not-downloaded');

    await controller.download('elbow');
    expect(controller.getSnapshot().areas.elbow.status).toBe('downloaded');

    await controller.remove('elbow');
    expect(controller.getSnapshot().areas.elbow.status).toBe('not-downloaded');
    expect(controller.getSnapshot().usedBytes).toBe(0);
    expect(fake.caches.has(offlineCacheName('elbow'))).toBe(false);
  });

  it('finds an earlier download again in a new session, and calls it downloaded while offline', async () => {
    const first = setup();
    await first.controller.download('knee');

    const later = new OfflineController({
      source: { ...({} as OfflineSource), fetchIndex: async () => Promise.reject(new Error('offline')) },
      storage: first.storage,
      hasServiceWorker: async () => true,
    });
    await later.start();
    await later.refreshIndex();
    expect(later.hasDownloads()).toBe(true);
    expect(later.getSnapshot().areas.knee.status).toBe('downloaded');
  });

  it('remembers the sizes for a session with no network, but never judges freshness from memory', async () => {
    const memo = new Map<string, string>();
    const store = { getItem: (k: string) => memo.get(k) ?? null, setItem: (k: string, v: string) => void memo.set(k, v) };
    const online = setup({ memo: store });
    await online.controller.refreshIndex();
    await online.controller.download('hip');

    const offline = new OfflineController({
      source: { ...({} as OfflineSource), fetchIndex: async () => Promise.reject(new Error('offline')) },
      storage: online.storage,
      hasServiceWorker: async () => true,
      // The remembered index carries a different hash from the one downloaded.
      memo: { getItem: () => JSON.stringify(indexWith('9999999999999999')), setItem: () => undefined },
    });
    await offline.start();
    await offline.refreshIndex();
    expect(offline.getSnapshot().areas.hip).toMatchObject({ status: 'downloaded', totalBytes: 8 });
    expect(offline.getSnapshot().areas.elbow.totalBytes).toBe(8);
  });

  it('says why a download stopped, and clears it on the next attempt', async () => {
    let fail = true;
    const { controller } = setup({
      download: async () => {
        if (fail) throw new DownloadIncomplete(3);
        throw new DownloadCancelled();
      },
    });
    await controller.download('hip');
    expect(controller.getSnapshot().areas.hip.error).toMatch(/Check your connection/);

    fail = false;
    await controller.download('hip');
    expect(controller.getSnapshot().areas.hip.error).toBeNull();
  });
});

describe('describeFailure', () => {
  it('is silent about a cancel — the student did that', () => {
    expect(describeFailure(new DownloadCancelled())).toBeNull();
  });

  it('gives the numbers when there is no room', () => {
    expect(describeFailure(new NotEnoughSpace(62_000_000, 5_000_000))).toBe(
      'Not enough space. This needs 62 MB, and 5.0 MB is free.',
    );
    expect(describeFailure(new NotEnoughSpace(62_000_000, null))).toBe('Not enough space. This needs 62 MB.');
  });
});

/**
 * In a build that fetches facts per area, a download is pictures AND facts
 * (areaFactsPrefetch.ts), and the facts are what the server can refuse.
 */
describe('a download fetches the area\u2019s facts first', () => {
  it('asks for the facts before any picture, and downloads when they are saved', async () => {
    const order: string[] = [];
    const { controller } = setup({
      prefetchFacts: async (area) => {
        order.push(`facts ${area}`);
        return 'saved';
      },
      download: async ({ area }) => {
        order.push(`pictures ${area}`);
        return { version: 1, area, files: {}, bytes: 0, manifestHash: 'x', completedAt: null };
      },
    });
    await controller.download('knee');
    expect(order).toEqual(['facts knee', 'pictures knee']);
    expect(controller.getSnapshot().areas.knee.error).toBeNull();
  });

  it('downloads nothing when the server refuses the facts, and says why', async () => {
    let pictures = 0;
    const { controller, fake } = setup({
      prefetchFacts: async () => 'refused',
      download: async ({ area }) => {
        pictures += 1;
        return { version: 1, area, files: {}, bytes: 0, manifestHash: 'x', completedAt: null };
      },
    });
    await controller.download('hip');
    expect(pictures).toBe(0);
    expect(fake.caches.size).toBe(0);
    expect(controller.getSnapshot().areas.hip.error).toBe('This area is not open on your account, so it was not downloaded.');
  });

  it('still saves the pictures when the facts could not be fetched, and says the download is not finished', async () => {
    const { controller, fake } = setup({ prefetchFacts: async () => 'unavailable' });
    await controller.download('elbow');
    expect(fake.caches.has(offlineCacheName('elbow'))).toBe(true);
    expect(controller.getSnapshot().areas.elbow.error).toBe(FACTS_PENDING);
  });

  it('says nothing extra in a build whose facts are bundled', async () => {
    const { controller } = setup({ prefetchFacts: async () => 'none' });
    await controller.download('elbow');
    expect(controller.getSnapshot().areas.elbow.error).toBeNull();
  });

  it('promises only what the build delivers', () => {
    expect(downloadPromise(false)).toBe('Download an area to keep every picture in it on this device, for revising with no signal.');
    expect(downloadPromise(true)).toContain('and its facts');
    expect(downloadPromise(true)).toContain('14 days without a connection');
    expect(describeFailure(new FactsRefused())).toContain('not open on your account');
  });
});
