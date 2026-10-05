import { describe, expect, it } from 'vitest';
import { createMemoryContentCache, type CachedArea } from '../../contentCache';
import { loadAreaFacts, parseGrant, prefetchAreaFacts, RENEW_AT_MOST_EVERY_HOURS, type AreaFactsDeps, type AreaFetchResult } from '../areaFacts';
import { CONTENT_LEASE_DAYS, CONTENT_LEASE_RENEW_WITHIN_DAYS, leaseExpired, leaseNeedsRenewal, leaseUntil } from '../lease';
import type { Area } from '../../../types/region';

/**
 * The rules for using, renewing and deleting a saved area
 * (data/content/areaFacts.ts), each with the clock, the network and the cache
 * handed in. What they protect, between them: a student offline inside their
 * lease sees their areas; a lapsed one stops seeing them; and nobody's
 * downloads are deleted because a read failed.
 */

const NOW = new Date('2026-10-05T12:00:00.000Z');
const DAY = 86_400_000;
const HOUR = 3_600_000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
const V = 'aaaaaaaaaaaaaaaa';

const facts = (area: Area, tag = 'v1') => [{ id: `${area}-structure`, description: `${area} ${tag}` }];

function copy(area: Area, over: Partial<CachedArea> = {}): CachedArea {
  return {
    uid: 'u1',
    area,
    version: V,
    askedWith: V,
    leaseUntil: at(10 * DAY),
    fetchedAt: at(-1 * HOUR),
    structures: facts(area, 'saved'),
    ...over,
  };
}

/** A server that answers each area as told, and remembers what it was asked. */
function setup(saved: CachedArea[] = [], answers: Partial<Record<Area, AreaFetchResult>> = {}, online = true) {
  const cache = createMemoryContentCache(saved);
  const asked: Area[] = [];
  const deps: AreaFactsDeps = {
    cache,
    version: V,
    now: () => NOW,
    online: () => online,
    fetchArea: async (area) => {
      asked.push(area);
      return answers[area] ?? { kind: 'granted', version: V, leaseUntil: at(CONTENT_LEASE_DAYS * DAY), structures: facts(area, 'fresh') };
    },
  };
  return { cache, asked, deps };
}

const load = (areas: Area[], deps: AreaFactsDeps, known = true, uid = 'u1') => loadAreaFacts({ uid, areas, known }, deps);

describe('an area with nothing saved', () => {
  it('is fetched, shown and saved with its lease', async () => {
    const { cache, asked, deps } = setup();
    const [knee] = await load(['knee'], deps);

    expect(asked).toEqual(['knee']);
    expect(knee).toMatchObject({ area: 'knee', status: 'loaded', from: 'server', leaseUntil: at(CONTENT_LEASE_DAYS * DAY) });
    expect(knee.facts?.structures).toEqual(facts('knee', 'fresh'));
    expect(await cache.get('u1', 'knee')).toMatchObject({ version: V, askedWith: V, fetchedAt: NOW.toISOString() });
  });

  it('is reported as offline when the device is offline — and the server is not even asked', async () => {
    const { asked, deps } = setup([], {}, false);
    expect(await load(['knee'], deps)).toEqual([{ area: 'knee', status: 'offline' }]);
    expect(asked).toEqual([]);
  });

  it('is reported as offline when the server cannot be reached, and as an error when it answers badly', async () => {
    const { deps } = setup([], { knee: { kind: 'unreachable' }, hip: { kind: 'failed', status: 500 }, elbow: { kind: 'failed', status: 429 } });
    expect(await load(['knee', 'hip', 'elbow'], deps)).toEqual([
      { area: 'elbow', status: 'error' },
      { area: 'hip', status: 'error' },
      { area: 'knee', status: 'offline' },
    ]);
  });

  it('is reported as denied when the server refuses it', async () => {
    const { cache, deps } = setup([], { hip: { kind: 'denied' } });
    expect(await load(['hip'], deps)).toEqual([{ area: 'hip', status: 'denied' }]);
    expect(await cache.get('u1', 'hip')).toBeNull();
  });
});

describe('a saved area', () => {
  it('is used without asking while it is current and well inside its lease', async () => {
    const { asked, deps } = setup([copy('knee')]);
    const [knee] = await load(['knee'], deps);
    expect(asked).toEqual([]);
    expect(knee).toMatchObject({ status: 'loaded', from: 'device' });
    expect(knee.facts?.structures).toEqual(facts('knee', 'saved'));
  });

  it('works offline inside its lease', async () => {
    const { deps } = setup([copy('knee', { leaseUntil: at(2 * HOUR) })], {}, false);
    expect((await load(['knee'], deps))[0]).toMatchObject({ status: 'loaded', from: 'device' });
  });

  it('is fetched again when the content version has moved on', async () => {
    const { asked, cache, deps } = setup([copy('knee', { version: 'old0000000000000', askedWith: 'old0000000000000' })]);
    const [knee] = await load(['knee'], deps);
    expect(asked).toEqual(['knee']);
    expect(knee.facts?.structures).toEqual(facts('knee', 'fresh'));
    // One copy per account and area: the old version is gone.
    expect(cache.entries()).toHaveLength(1);
    expect(cache.entries()[0].version).toBe(V);
  });

  // An app on an older bundle is handed the server's newer version. Without
  // remembering what it ASKED with, it would see "not my version" on every
  // start and fetch all nine areas every time it opened.
  it('is not fetched again merely because the server is ahead of this bundle', async () => {
    const { asked, deps } = setup([copy('knee', { version: 'newer00000000000', askedWith: V })]);
    await load(['knee'], deps);
    expect(asked).toEqual([]);
  });

  it('still shows old content offline, inside its lease, when the version has moved on', async () => {
    const { deps } = setup([copy('knee', { version: 'old0000000000000', askedWith: 'old0000000000000' })], {}, false);
    const [knee] = await load(['knee'], deps);
    expect(knee).toMatchObject({ status: 'loaded', from: 'device' });
  });

  it('falls back to the saved copy when the server gives no usable answer', async () => {
    for (const answer of [{ kind: 'unreachable' }, { kind: 'failed', status: 503 }, { kind: 'failed', status: 429 }, { kind: 'failed', status: 401 }] as AreaFetchResult[]) {
      const { cache, deps } = setup([copy('knee', { version: 'old0000000000000', askedWith: 'old0000000000000' })], { knee: answer });
      expect((await load(['knee'], deps))[0], JSON.stringify(answer)).toMatchObject({ status: 'loaded', from: 'device' });
      expect(await cache.get('u1', 'knee')).not.toBeNull();
    }
  });
});

describe('a lease that has run out', () => {
  const expired = () => copy('knee', { leaseUntil: at(-1 * HOUR), fetchedAt: at(-15 * DAY) });

  it('is renewed when the server can be reached', async () => {
    const { asked, deps } = setup([expired()]);
    const [knee] = await load(['knee'], deps);
    expect(asked).toEqual(['knee']);
    expect(knee).toMatchObject({ status: 'loaded', from: 'server' });
  });

  it('is NOT shown when it cannot be renewed, and the copy is deleted', async () => {
    const { cache, deps } = setup([expired()], {}, false);
    expect(await load(['knee'], deps)).toEqual([{ area: 'knee', status: 'offline' }]);
    expect(await cache.get('u1', 'knee')).toBeNull();
  });

  it('is deleted when the server now refuses the area', async () => {
    const { cache, deps } = setup([expired()], { knee: { kind: 'denied' } });
    expect(await load(['knee'], deps)).toEqual([{ area: 'knee', status: 'denied' }]);
    expect(cache.entries()).toEqual([]);
  });

  it('counts an unreadable lease as run out', async () => {
    const { deps } = setup([copy('knee', { leaseUntil: 'whenever' })], {}, false);
    expect((await load(['knee'], deps))[0].status).toBe('offline');
  });
});

describe('renewing a lease before it runs out', () => {
  const closing = (hoursSinceFetch: number) =>
    copy('knee', { leaseUntil: at((CONTENT_LEASE_RENEW_WITHIN_DAYS - 1) * DAY), fetchedAt: at(-hoursSinceFetch * HOUR) });

  it('asks once under half the lease is left', async () => {
    const { asked, deps } = setup([closing(RENEW_AT_MOST_EVERY_HOURS + 1)]);
    const [knee] = await load(['knee'], deps);
    expect(asked).toEqual(['knee']);
    expect(knee.leaseUntil).toBe(at(CONTENT_LEASE_DAYS * DAY));
  });

  // A monthly subscriber's lease can never be longer than the days they have
  // left, so in the last week of every month it is always "closing".
  it('does not ask again within a day of the last fetch', async () => {
    const { asked, deps } = setup([closing(RENEW_AT_MOST_EVERY_HOURS - 1)]);
    expect((await load(['knee'], deps))[0]).toMatchObject({ status: 'loaded', from: 'device' });
    expect(asked).toEqual([]);
  });

  it('keeps the saved copy if the renewal is refused an answer', async () => {
    const { deps } = setup([closing(48)], { knee: { kind: 'unreachable' } });
    expect((await load(['knee'], deps))[0]).toMatchObject({ status: 'loaded', from: 'device' });
  });

  it('a renewal that is REFUSED deletes the copy, lease or no lease', async () => {
    const { cache, deps } = setup([closing(48)], { knee: { kind: 'denied' } });
    expect((await load(['knee'], deps))[0].status).toBe('denied');
    expect(await cache.get('u1', 'knee')).toBeNull();
  });
});

describe('what is deleted, and when', () => {
  it('deletes a saved area the account is no longer entitled to — when that is known', async () => {
    const { cache, asked, deps } = setup([copy('knee'), copy('hip'), copy('shoulder')]);
    const result = await load(['knee'], deps, true);
    expect(result.map((r) => r.area)).toEqual(['knee']);
    expect(cache.entries().map((e) => e.area)).toEqual(['knee']);
    expect(asked).toEqual([]);
  });

  // useEntitlement answers `free` when the read FAILS. A subscriber opening
  // the app in a tunnel must not lose nine downloads to that.
  it('deletes nothing on the strength of an entitlement that could not be read', async () => {
    const { cache, deps } = setup([copy('knee'), copy('hip'), copy('shoulder')], {}, false);
    await load(['knee'], deps, false);
    expect(cache.entries().map((e) => e.area).sort()).toEqual(['hip', 'knee', 'shoulder']);
  });

  it("deletes every other account's copies, whoever signed out", async () => {
    const { cache, deps } = setup([copy('knee'), copy('knee', { uid: 'someone-else' }), copy('hip', { uid: 'someone-else' })]);
    await load(['knee'], deps, false);
    expect(cache.entries().map((e) => e.uid)).toEqual(['u1']);
  });

  it("never shows one account another's copy", async () => {
    const { deps, asked } = setup([copy('knee', { uid: 'someone-else' })], {}, false);
    expect(await load(['knee'], deps, true, 'u1')).toEqual([{ area: 'knee', status: 'offline' }]);
    expect(asked).toEqual([]);
  });
});

describe('prefetching for an offline download', () => {
  it('asks the server even when a good copy is saved, and stores the new lease', async () => {
    const { asked, cache, deps } = setup([copy('knee', { leaseUntil: at(10 * DAY) })]);
    const result = await prefetchAreaFacts('u1', 'knee', deps);
    expect(asked).toEqual(['knee']);
    expect(result).toMatchObject({ status: 'loaded', from: 'server' });
    expect((await cache.get('u1', 'knee'))?.leaseUntil).toBe(at(CONTENT_LEASE_DAYS * DAY));
  });

  it('reports a refusal as a refusal', async () => {
    const { deps } = setup([], { hip: { kind: 'denied' } });
    expect((await prefetchAreaFacts('u1', 'hip', deps)).status).toBe('denied');
  });
});

describe('reading a grant', () => {
  const good = { version: V, area: 'knee', leaseUntil: at(DAY), structures: [{ id: 'patella', description: 'x' }] };

  it('accepts a well-formed one', () => {
    expect(parseGrant(good, 'knee')).toEqual({ kind: 'granted', version: V, leaseUntil: good.leaseUntil, structures: good.structures });
  });

  it('refuses anything else: the wrong area, no lease, no structures, a page of HTML', () => {
    expect(parseGrant(good, 'hip')).toBeNull();
    expect(parseGrant({ ...good, leaseUntil: 'soon' }, 'knee')).toBeNull();
    expect(parseGrant({ ...good, leaseUntil: undefined }, 'knee')).toBeNull();
    expect(parseGrant({ ...good, version: '' }, 'knee')).toBeNull();
    expect(parseGrant({ ...good, structures: 'all of them' }, 'knee')).toBeNull();
    expect(parseGrant({ ...good, structures: [{ name: 'no id' }] }, 'knee')).toBeNull();
    expect(parseGrant('<!doctype html>', 'knee')).toBeNull();
    expect(parseGrant(null, 'knee')).toBeNull();
  });
});

describe('the lease', () => {
  it('is fourteen days, or the end of the entitlement when that is sooner', () => {
    expect(CONTENT_LEASE_DAYS).toBe(14);
    expect(leaseUntil(null, NOW)).toBe(at(14 * DAY));
    expect(leaseUntil({ tier: 'free', source: null, expiresAt: null }, NOW)).toBe(at(14 * DAY));
    expect(leaseUntil({ tier: 'individual', source: 'paddle', expiresAt: at(3 * DAY) }, NOW)).toBe(at(3 * DAY));
    expect(leaseUntil({ tier: 'individual', source: 'paddle', expiresAt: at(300 * DAY) }, NOW)).toBe(at(14 * DAY));
    expect(leaseUntil({ tier: 'institutional', source: 'complimentary', expiresAt: null }, NOW)).toBe(at(14 * DAY));
    expect(leaseUntil({ tier: 'individual', source: 'paddle', expiresAt: 'not a date' }, NOW)).toBe(at(14 * DAY));
  });

  it('knows when one has run out and when one is worth renewing', () => {
    expect(leaseExpired(at(-1), NOW)).toBe(true);
    expect(leaseExpired(at(HOUR), NOW)).toBe(false);
    expect(leaseExpired('', NOW)).toBe(true);
    expect(leaseNeedsRenewal(at(8 * DAY), NOW)).toBe(false);
    expect(leaseNeedsRenewal(at(6 * DAY), NOW)).toBe(true);
  });
});
