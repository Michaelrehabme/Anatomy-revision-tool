import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Area } from '../../../anatomy-revision/types/region';
import { AREAS } from '../../../anatomy-revision/types/region';
import { AUTO_UPDATE_MAX_BYTES, autoUpdateDecision, saveDataRequested, type AutoUpdateFacts } from '../autoUpdate';
import type { AreaManifest, ManifestFile, OfflineIndex } from '../manifest';
import { offlineCacheName, readRecord } from '../offlineCache';
import { OfflineController } from '../offlineController';
import type { OfflineSource } from '../offlineSource';
import { fakeStorage } from './fakeCaches';

const ok: AutoUpdateFacts = { online: true, entitled: true, saveData: false, fetchBytes: 1_200_000 };

describe('autoUpdateDecision', () => {
  it('applies a small update for an entitled account with a network', () => {
    expect(autoUpdateDecision(ok)).toBe('apply');
    expect(autoUpdateDecision({ ...ok, fetchBytes: AUTO_UPDATE_MAX_BYTES })).toBe('apply');
  });

  it('leaves a large one behind the button', () => {
    expect(autoUpdateDecision({ ...ok, fetchBytes: AUTO_UPDATE_MAX_BYTES + 1 })).toBe('mark');
    expect(autoUpdateDecision({ ...ok, fetchBytes: 62_000_000 })).toBe('mark');
  });

  it('never spends data the student asked the browser to save', () => {
    expect(autoUpdateDecision({ ...ok, saveData: true })).toBe('mark');
  });

  // A lapsed subscription, or a free area moved elsewhere.
  it('never fetches for an area the account can no longer study', () => {
    expect(autoUpdateDecision({ ...ok, entitled: false })).toBe('mark');
  });

  it('does nothing with no network', () => {
    expect(autoUpdateDecision({ ...ok, online: false })).toBe('mark');
  });

  it('applies an update that fetches nothing, whoever is asking — it is only bookkeeping', () => {
    expect(autoUpdateDecision({ online: true, entitled: false, saveData: true, fetchBytes: 0 })).toBe('apply');
  });

  it('keeps the line at 5 MB: half the smallest area, a few structures of redraw', () => {
    expect(AUTO_UPDATE_MAX_BYTES).toBe(5_000_000);
  });
});

describe('saveDataRequested', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false where the browser has no connection API', () => {
    expect(saveDataRequested()).toBe(false);
  });

  it('reads navigator.connection.saveData where it exists', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    expect(saveDataRequested()).toBe(true);
  });
});

/**
 * The same decision, but through the controller and a pretend server, so what
 * is pinned is what ends up in the cache rather than what a function returned.
 * A file's hash is its content here; `digest` in the fake download agrees.
 */
const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const SHA = { aaaa: '61be55a8e2f6b4e1', bbbb: '81cc5b17018674b4' };

function world() {
  const { storage, fake } = fakeStorage();
  const fetched: string[] = [];
  const server = {
    hash: '1111111111111111',
    files: [
      { url: '/anatomy/joints/a.webp', bytes: 1000, hash: SHA.aaaa, body: 'aaaa' },
      { url: '/anatomy/joints/b.webp', bytes: 1000, hash: SHA.bbbb, body: 'bbbb' },
    ],
  };
  const source: OfflineSource = {
    fetchIndex: async (): Promise<OfflineIndex> => ({
      version: 1,
      areas: Object.fromEntries(AREAS.map((a) => [a, { bytes: 2000, files: 2, hash: server.hash }])) as OfflineIndex['areas'],
    }),
    fetchManifest: async (area: Area): Promise<AreaManifest> => ({
      version: 1,
      area,
      hash: server.hash,
      bytes: server.files.reduce((sum, f) => sum + f.bytes, 0),
      files: server.files.map(({ url, bytes: size, hash }): ManifestFile => ({ url, bytes: size, hash })),
    }),
    fetchFile: async (file) => {
      fetched.push(file.url);
      return bytes(server.files.find((f) => f.url === file.url)!.body);
    },
  };
  const controller = () => new OfflineController({ source, storage, hasServiceWorker: async () => true });
  return { storage, fake, fetched, server, source, controller };
}

const everything = { canAccess: () => true, saveData: false, online: true };

/** Downloads the elbow, then has the server redraw b.webp at the given size. */
async function staleElbow(redrawnBytes: number) {
  const w = world();
  await w.controller().download('elbow');
  w.fetched.length = 0;
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes('cccc')))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
  w.server.files[1] = { url: '/anatomy/joints/b.webp', bytes: redrawnBytes, hash: digest, body: 'cccc' };
  w.server.hash = '2222222222222222';
  // A new session: the controller that finds the stale download is not the one that made it.
  return { ...w, later: w.controller() };
}

describe('OfflineController.autoApplyUpdates', () => {
  it('applies a small update on its own, fetching only what changed, and shows Updating… while it does', async () => {
    const { later, fetched, storage } = await staleElbow(1200);
    const seen = new Set<string>();
    later.subscribe(() => seen.add(later.getSnapshot().areas.elbow.status));

    await later.autoApplyUpdates(everything);

    expect(fetched).toEqual(['/anatomy/joints/b.webp']);
    expect(seen.has('updating')).toBe(true);
    expect(seen.has('downloading')).toBe(false);
    expect(later.getSnapshot().areas.elbow.status).toBe('downloaded');
    expect((await readRecord(storage, 'elbow'))!.manifestHash).toBe('2222222222222222');
  });

  it.each([
    ['a large update', 6_000_000, everything],
    ['an account no longer entitled to the area', 1200, { ...everything, canAccess: () => false }],
    ['a browser asked to save data', 1200, { ...everything, saveData: true }],
  ])('only marks for %s', async (_name, size, facts) => {
    const { later, fetched } = await staleElbow(size);
    await later.autoApplyUpdates(facts);
    expect(fetched).toEqual([]);
    expect(later.getSnapshot().areas.elbow).toMatchObject({ status: 'update-available', error: null });
  });

  it('does nothing at all offline — not even the index', async () => {
    const { later, fetched } = await staleElbow(1200);
    await later.autoApplyUpdates({ ...everything, online: false });
    expect(fetched).toEqual([]);
    expect(later.getSnapshot().areas.elbow.status).toBe('downloaded');
  });

  it('deletes retired files even when the update itself has to wait', async () => {
    const { later, server, fake, fetched } = await staleElbow(6_000_000);
    // b is too big to fetch unasked, and a has been retired altogether.
    server.files = [server.files[1]];

    await later.autoApplyUpdates(everything);

    expect(fetched).toEqual([]);
    expect(fake.pictures(offlineCacheName('elbow'))).toEqual(['/anatomy/joints/b.webp']);
    expect(later.getSnapshot().areas.elbow.status).toBe('update-available');
  });

  it('finishes an update that only retires files, even for a locked area', async () => {
    const w = world();
    await w.controller().download('elbow');
    w.fetched.length = 0;
    w.server.files = [w.server.files[0]];
    w.server.hash = '2222222222222222';
    const later = w.controller();

    await later.autoApplyUpdates({ ...everything, canAccess: () => false });

    expect(w.fetched).toEqual([]);
    expect(w.fake.pictures(offlineCacheName('elbow'))).toEqual(['/anatomy/joints/a.webp']);
    expect(later.getSnapshot().areas.elbow.status).toBe('downloaded');
  });

  // Before sign-in settles the entitlement reads as free; the real one follows.
  it('runs the later, better-informed call rather than dropping it', async () => {
    const { later, fetched } = await staleElbow(1200);
    const first = later.autoApplyUpdates({ ...everything, canAccess: () => false });
    const second = later.autoApplyUpdates(everything);
    await Promise.all([first, second]);
    expect(fetched).toEqual(['/anatomy/joints/b.webp']);
    expect(later.getSnapshot().areas.elbow.status).toBe('downloaded');
  });

  it('says nothing when a quiet update fails, and leaves the button', async () => {
    const { source, storage } = await staleElbow(1200);
    const failing = new OfflineController({
      source: {
        ...source,
        fetchFile: async () => {
          throw new Error('connection reset');
        },
      },
      storage,
      hasServiceWorker: async () => true,
    });
    await failing.autoApplyUpdates(everything);
    expect(failing.getSnapshot().areas.elbow).toMatchObject({ status: 'update-available', error: null });
  }, 15000);
});
