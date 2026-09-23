import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { AREAS, type Area } from '../../types/region';
import type { AnatomyStructure } from '../../types/structure';
import type { StructureMastery } from '../../types/attempt';
import {
  AREA_ORDER_SUPERIOR_INFERIOR,
  ATLAS_SORTS,
  activeFilterCount,
  atlasAccuracy,
  bodyRank,
  filterAtlas,
  masteryState,
  sortAtlas,
  sortById,
  DEFAULT_FILTERS,
  DEFAULT_SORT_ID,
  type AtlasSortKey,
  type SortDirection,
} from '../atlasList';
import { atlasRow, type AtlasRow } from '../atlasFacts';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/** A minimal structure carrying only the fields the list logic reads. */
function structure(id: string, name: string, areas: Area[]): AnatomyStructure {
  return { id, name, areas, category: 'bone', attachments: [], articulations: [] } as unknown as AnatomyStructure;
}

/** A mastery row. `total` of 0 is the flashcard-only "met but never answered" case. */
function mastery(structureId: string, correct: number, total: number): StructureMastery {
  return {
    structureId,
    userId: 'u1',
    attemptsTotal: total,
    attemptsCorrect: correct,
    lastAttemptAt: '2026-01-01T00:00:00.000Z',
    ...(total === 0 ? { firstSeenAt: '2026-01-01T00:00:00.000Z' } : {}),
  };
}

function searchRows(list: AnatomyStructure[]): Map<string, AtlasRow> {
  return new Map(
    list.map((s) => [s.id, { columns: [], searchText: s.name.toLowerCase() } as unknown as AtlasRow]),
  );
}

describe('AREA_ORDER_SUPERIOR_INFERIOR', () => {
  it('places every area exactly once', () => {
    // A new area added to region.ts must fail here rather than silently
    // sorting to the bottom of every "top to bottom" list.
    expect([...AREA_ORDER_SUPERIOR_INFERIOR].sort()).toEqual([...AREAS].sort());
  });

  it('runs head to toe, interleaving trunk and limb', () => {
    const at = (a: Area) => AREA_ORDER_SUPERIOR_INFERIOR.indexOf(a);
    expect(at('cervical-spine')).toBeLessThan(at('shoulder'));
    expect(at('shoulder')).toBeLessThan(at('thoracic-spine'));
    expect(at('thoracic-spine')).toBeLessThan(at('lumbar-spine'));
    expect(at('hip')).toBeLessThan(at('knee'));
    expect(at('knee')).toBeLessThan(at('ankle-foot'));
  });
});

describe('bodyRank', () => {
  it('uses the most superior area when a structure spans several', () => {
    // A level-agnostic vertebral structure belongs to all three spine areas
    // and should sort at the topmost, not at whichever is authored first.
    const spanning = structure('s1', 'Erector spinae', ['lumbar-spine', 'cervical-spine']);
    expect(bodyRank(spanning)).toBe(AREA_ORDER_SUPERIOR_INFERIOR.indexOf('cervical-spine'));
  });

  it('sorts an unplaced structure last rather than first', () => {
    expect(bodyRank(structure('s2', 'Nowhere', []))).toBe(Number.POSITIVE_INFINITY);
  });

  it('places every shipped structure', () => {
    const unplaced = ALL_STRUCTURES.filter((s) => !Number.isFinite(bodyRank(s)));
    expect(unplaced.map((s) => s.id)).toEqual([]);
  });
});

describe('atlasAccuracy and masteryState', () => {
  it('tells apart never met, met but never answered, and scored', () => {
    expect(masteryState(undefined)).toEqual({ kind: 'unseen' });
    // The flashcard case: a row exists, nothing has been graded. Printing
    // "unseen" here is what the new seen/unseen filter would contradict.
    expect(masteryState(mastery('a', 0, 0))).toEqual({ kind: 'untested' });
    expect(masteryState(mastery('a', 3, 4))).toEqual({ kind: 'scored', pct: 75 });
  });

  it('returns null rather than 0 when nothing is graded', () => {
    expect(atlasAccuracy(mastery('a', 0, 0))).toBeNull();
    expect(atlasAccuracy(mastery('a', 0, 5))).toBe(0);
  });
});

describe('filterAtlas', () => {
  const list = [
    structure('seen-strong', 'Alpha', ['shoulder']),
    structure('seen-flashcard', 'Beta', ['knee']),
    structure('never', 'Gamma', ['knee']),
  ];
  const rows = searchRows(list);
  const masteryById = new Map([
    ['seen-strong', mastery('seen-strong', 8, 10)],
    ['seen-flashcard', mastery('seen-flashcard', 0, 0)],
  ]);

  const ids = (f: Partial<typeof DEFAULT_FILTERS>) =>
    filterAtlas(list, rows, { ...DEFAULT_FILTERS, ...f }, masteryById).map((s) => s.id);

  it('counts a flashcard-only structure as seen', () => {
    // "Seen" is a mastery row existing, matching useProgressData — not
    // attemptsTotal > 0, which would call a structure already met unseen.
    expect(ids({ seen: 'seen' })).toEqual(['seen-strong', 'seen-flashcard']);
    expect(ids({ seen: 'unseen' })).toEqual(['never']);
  });

  it('combines area, kind and query', () => {
    expect(ids({ area: 'knee' })).toEqual(['seen-flashcard', 'never']);
    expect(ids({ query: 'gam' })).toEqual(['never']);
    expect(ids({ area: 'knee', seen: 'unseen' })).toEqual(['never']);
    expect(ids({ kind: 'muscle' })).toEqual([]);
  });

  it('leaves the list untouched when nothing is set', () => {
    expect(ids({})).toEqual(['seen-strong', 'seen-flashcard', 'never']);
  });
});

describe('sortAtlas', () => {
  const a = structure('a', 'Acromion', ['shoulder']);
  const b = structure('b', 'Patella', ['knee']);
  const c = structure('c', 'Atlas', ['cervical-spine']);
  const list = [b, a, c];
  const masteryById = new Map([
    ['a', mastery('a', 9, 10)], // 90%
    ['b', mastery('b', 1, 10)], // 10%
    // c has never been met.
  ]);
  const order = (key: AtlasSortKey, dir: SortDirection) => sortAtlas(list, key, dir, masteryById).map((s) => s.id);

  it('runs top to bottom and back', () => {
    expect(order('body', 'asc')).toEqual(['c', 'a', 'b']);
    expect(order('body', 'desc')).toEqual(['b', 'a', 'c']);
  });

  it('treats no data as 0% so lowest-first surfaces unstudied structures', () => {
    expect(order('accuracy', 'asc')).toEqual(['a', 'b', 'c']);
    expect(order('accuracy', 'desc')).toEqual(['c', 'b', 'a']);
  });

  it('sorts by name both ways', () => {
    expect(order('name', 'asc')).toEqual(['a', 'c', 'b']);
    expect(order('name', 'desc')).toEqual(['b', 'c', 'a']);
  });

  it('ranks a flashcard-only row above one never met at equal counts', () => {
    const met = structure('met', 'Met', ['knee']);
    const never = structure('never', 'Never', ['knee']);
    const m = new Map([['met', mastery('met', 0, 0)]]);
    expect(sortAtlas([never, met], 'seen', 'asc', m).map((s) => s.id)).toEqual(['met', 'never']);
  });

  it('keeps the A-Z tiebreak ascending even when the primary key is reversed', () => {
    // Bottom to top reverses the areas but should still read A-Z inside one.
    const knee1 = structure('k1', 'Zeta', ['knee']);
    const knee2 = structure('k2', 'Alpha', ['knee']);
    expect(sortAtlas([knee1, knee2], 'body', 'desc', new Map()).map((s) => s.id)).toEqual(['k2', 'k1']);
  });

  it('is stable and does not mutate its input', () => {
    const input = [b, a, c];
    const once = sortAtlas(input, 'body', 'asc', masteryById).map((s) => s.id);
    const twice = sortAtlas(sortAtlas(input, 'body', 'asc', masteryById), 'body', 'asc', masteryById).map((s) => s.id);
    expect(twice).toEqual(once);
    expect(input.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('orders the real seed without dropping or duplicating anything', () => {
    for (const { key, direction } of ATLAS_SORTS) {
      const sorted = sortAtlas(ALL_STRUCTURES, key, direction, new Map());
      expect(sorted).toHaveLength(ALL_STRUCTURES.length);
      expect(new Set(sorted.map((s) => s.id)).size).toBe(ALL_STRUCTURES.length);
    }
  });
});

describe('sort options', () => {
  it('offers every key in both directions with distinct ids', () => {
    expect(ATLAS_SORTS).toHaveLength(8);
    expect(new Set(ATLAS_SORTS.map((s) => s.id)).size).toBe(8);
  });

  it('falls back to the default rather than crashing on a stale stored id', () => {
    expect(sortById('no-such-sort').id).toBe(DEFAULT_SORT_ID);
    expect(sortById('name-desc').label).toBe('Z–A');
  });
});

describe('activeFilterCount', () => {
  it('counts only what narrows the list', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, query: '   ' })).toBe(0);
    expect(activeFilterCount({ kind: 'muscle', area: 'knee', seen: 'unseen', query: 'x' })).toBe(4);
  });
});

describe('searching the real atlas rows', () => {
  it('matches a known structure by name through filterAtlas', () => {
    const rows = new Map(ALL_STRUCTURES.map((s) => [s.id, atlasRow(s, byId)]));
    const hit = filterAtlas(ALL_STRUCTURES, rows, { ...DEFAULT_FILTERS, query: 'patella' }, new Map());
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.some((s) => s.name.toLowerCase().includes('patella'))).toBe(true);
  });
});
