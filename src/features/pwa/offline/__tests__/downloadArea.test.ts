import { describe, expect, it, vi } from 'vitest';
import type { Area } from '../../../anatomy-revision/types/region';
import { DownloadCancelled, DownloadIncomplete, NotEnoughSpace, downloadArea, type DownloadOptions } from '../downloadArea';
import type { AreaManifest, ManifestFile } from '../manifest';
import { offlineCacheName, readRecord } from '../offlineCache';
import type { OfflineSource } from '../offlineSource';
import { fakeStorage } from './fakeCaches';

/**
 * A pretend server. A file's "hash" is simply its content, so a test can say
 * what the server holds in one word and the digest below agrees with it.
 */
const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const digest = async (data: ArrayBuffer) => new TextDecoder().decode(data);

const file = (name: string, content: string): ManifestFile => ({
  url: `/anatomy/joints/${name}.webp`,
  bytes: 100,
  hash: content,
});

const manifestOf = (area: Area, files: ManifestFile[], hash = 'm1'): AreaManifest => ({
  version: 1,
  area,
  hash,
  bytes: files.length * 100,
  files,
});

function serverWith(manifest: AreaManifest, overrides: Partial<OfflineSource> = {}) {
  const fetched: string[] = [];
  const source: OfflineSource = {
    fetchIndex: async () => {
      throw new Error('not used');
    },
    fetchManifest: async () => manifest,
    fetchFile: async (f) => {
      fetched.push(f.url);
      return bytes(f.hash);
    },
    ...overrides,
  };
  return { source, fetched };
}

const base = (area: Area, source: OfflineSource, storage: CacheStorage): DownloadOptions => ({
  area,
  source,
  storage,
  digest,
  sleep: async () => undefined,
  now: () => new Date('2026-10-02T09:00:00.000Z'),
});

const A = file('a', 'aaaa');
const B = file('b', 'bbbb');
const C = file('c', 'cccc');

describe('downloadArea', () => {
  it('fetches every file, stores it under its plain url, and records the area complete', async () => {
    const { storage, fake } = fakeStorage();
    const { source } = serverWith(manifestOf('elbow', [A, B, C]));
    const progress: number[] = [];

    const record = await downloadArea({ ...base('elbow', source, storage), onProgress: (p) => progress.push(p.doneBytes) });

    expect(fake.pictures(offlineCacheName('elbow'))).toEqual([A.url, B.url, C.url]);
    expect(record).toMatchObject({ manifestHash: 'm1', bytes: 300, completedAt: '2026-10-02T09:00:00.000Z' });
    expect(await readRecord(storage, 'elbow')).toEqual(record);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(300);
  });

  it('resumes: a second run fetches only what the first did not get', async () => {
    const { storage } = fakeStorage();
    const flaky = serverWith(manifestOf('elbow', [A, B, C]), {
      fetchFile: async (f) => {
        if (f.url === C.url) throw new Error('connection reset');
        return bytes(f.hash);
      },
    });
    await expect(downloadArea({ ...base('elbow', flaky.source, storage), concurrency: 1 })).rejects.toBeInstanceOf(
      DownloadIncomplete,
    );
    // What arrived is on record, and the area is not claimed complete.
    expect(await readRecord(storage, 'elbow')).toMatchObject({ bytes: 200, manifestHash: null, completedAt: null });

    const healthy = serverWith(manifestOf('elbow', [A, B, C]));
    const progress: number[] = [];
    await downloadArea({ ...base('elbow', healthy.source, storage), onProgress: (p) => progress.push(p.doneBytes) });
    expect(healthy.fetched).toEqual([C.url]);
    expect(progress[0]).toBe(200);
    expect(await readRecord(storage, 'elbow')).toMatchObject({ bytes: 300, manifestHash: 'm1' });
  });

  it('updates: fetches the redrawn file and the new one, deletes the removed one, leaves the rest alone', async () => {
    const { storage, fake } = fakeStorage();
    await downloadArea(base('elbow', serverWith(manifestOf('elbow', [A, B, C])).source, storage));

    const redrawnB = file('b', 'BBBB');
    const D = file('d', 'dddd');
    const next = serverWith(manifestOf('elbow', [A, redrawnB, D], 'm2'));
    const record = await downloadArea(base('elbow', next.source, storage));

    expect(next.fetched.sort()).toEqual([redrawnB.url, D.url]);
    expect(fake.pictures(offlineCacheName('elbow'))).toEqual([A.url, redrawnB.url, D.url]);
    expect(record.files).toEqual({ [A.url]: 'aaaa', [B.url]: 'BBBB', [D.url]: 'dddd' });
    expect(record.manifestHash).toBe('m2');
    const cache = await storage.open(offlineCacheName('elbow'));
    expect(await (await cache.match(B.url))!.text()).toBe('BBBB');
  });

  // The SPA fallback and a captive portal both answer 200 with a web page.
  it('never records a file whose bytes do not match the manifest', async () => {
    const { storage, fake } = fakeStorage();
    const { source } = serverWith(manifestOf('elbow', [A, B]), {
      fetchFile: async (f) => bytes(f.url === B.url ? '<!doctype html>' : f.hash),
    });

    await expect(downloadArea(base('elbow', source, storage))).rejects.toBeInstanceOf(DownloadIncomplete);
    expect(fake.pictures(offlineCacheName('elbow'))).toEqual([A.url]);
    expect((await readRecord(storage, 'elbow'))!.files).toEqual({ [A.url]: 'aaaa' });
  });

  it('retries a file that fails once', async () => {
    const { storage } = fakeStorage();
    let attempts = 0;
    const { source } = serverWith(manifestOf('elbow', [A]), {
      fetchFile: async (f) => {
        attempts += 1;
        if (attempts === 1) throw new Error('timeout');
        return bytes(f.hash);
      },
    });
    const record = await downloadArea(base('elbow', source, storage));
    expect(attempts).toBe(2);
    expect(record.manifestHash).toBe('m1');
  });

  it('gives up on a dead connection instead of trying every file', async () => {
    const { storage } = fakeStorage();
    const many = Array.from({ length: 60 }, (_, i) => file(`f${i}`, `hash${i}`));
    const fetchFile = vi.fn(async () => {
      throw new Error('offline');
    });
    const { source } = serverWith(manifestOf('elbow', many), { fetchFile });

    const error = await downloadArea({ ...base('elbow', source, storage), concurrency: 1, retries: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(DownloadIncomplete);
    // Every file is reported missing, but only a handful were attempted.
    expect((error as DownloadIncomplete).failed).toBe(60);
    expect(fetchFile.mock.calls.length).toBeLessThan(15);
  });

  it('stops when cancelled and keeps what had arrived', async () => {
    const { storage } = fakeStorage();
    const abort = new AbortController();
    const { source, fetched } = serverWith(manifestOf('elbow', [A, B, C]), {
      fetchFile: async (f) => {
        if (f.url === B.url) abort.abort();
        return bytes(f.hash);
      },
    });

    await expect(
      downloadArea({ ...base('elbow', source, storage), signal: abort.signal, concurrency: 1 }),
    ).rejects.toBeInstanceOf(DownloadCancelled);
    expect(fetched).not.toContain(C.url);
    const record = await readRecord(storage, 'elbow');
    expect(record!.manifestHash).toBeNull();
    expect(Object.keys(record!.files)).toContain(A.url);
  });

  it('refuses before fetching or deleting anything when there is clearly no room', async () => {
    const { storage, fake } = fakeStorage();
    const { source, fetched } = serverWith(manifestOf('elbow', [A, B, C]));

    const error = await downloadArea({ ...base('elbow', source, storage), freeBytes: async () => 120 }).catch((e) => e);
    expect(error).toBeInstanceOf(NotEnoughSpace);
    expect(error).toMatchObject({ neededBytes: 300, freeBytes: 120 });
    expect(fetched).toEqual([]);
    expect(fake.caches.size).toBe(0);
  });

  it('goes ahead when the browser will not say how much room there is', async () => {
    const { storage } = fakeStorage();
    const { source } = serverWith(manifestOf('elbow', [A]));
    await expect(downloadArea({ ...base('elbow', source, storage), freeBytes: async () => null })).resolves.toMatchObject({
      manifestHash: 'm1',
    });
  });

  // The three spine areas share most of their pictures.
  it('copies a file another downloaded area already holds instead of fetching it again', async () => {
    const { storage, fake } = fakeStorage();
    await downloadArea(base('cervical-spine', serverWith(manifestOf('cervical-spine', [A, B])).source, storage));

    const second = serverWith(manifestOf('lumbar-spine', [A, B, C]));
    await downloadArea(base('lumbar-spine', second.source, storage));

    expect(second.fetched).toEqual([C.url]);
    expect(fake.pictures(offlineCacheName('lumbar-spine'))).toEqual([A.url, B.url, C.url]);
  });

  it('fails without touching the cache when the manifest cannot be had', async () => {
    const { storage, fake } = fakeStorage();
    const { source } = serverWith(manifestOf('elbow', [A]), {
      fetchManifest: async () => {
        throw new Error('The offline manifest for elbow could not be read.');
      },
    });
    await expect(downloadArea(base('elbow', source, storage))).rejects.toThrow('could not be read');
    expect(fake.caches.size).toBe(0);
  });
});
