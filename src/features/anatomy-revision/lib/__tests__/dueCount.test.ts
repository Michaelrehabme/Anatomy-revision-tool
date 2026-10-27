import { describe, expect, it } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { dueStructureIds, type ReviewItem } from '../reviewQueue';
import { DEFAULT_FILTERS, filterAtlas } from '../atlasList';

describe('one count of "due" everywhere (27 Oct 2026)', () => {
  it('counts a structure once however many of its questions are due', () => {
    const items = [
      { structureId: 'deltoid', kind: 'identify', due: true },
      { structureId: 'deltoid', kind: 'origin', due: true },
      { structureId: 'femur', kind: 'identify', due: true },
      { structureId: 'patella', kind: 'identify', due: false },
    ] as ReviewItem[];
    expect([...dueStructureIds(items)].sort()).toEqual(['deltoid', 'femur']);
  });

  it('gives the Atlas a "Due now" filter that lists exactly those structures', () => {
    const rows = new Map(ALL_STRUCTURES.map((s) => [s.id, { searchText: s.name.toLowerCase() } as never]));
    const due = new Set(['deltoid', 'femur']);
    const listed = filterAtlas(ALL_STRUCTURES, rows, { ...DEFAULT_FILTERS, seen: 'due' }, new Map(), new Set(), due);
    expect(listed.map((s) => s.id).sort()).toEqual(['deltoid', 'femur']);
  });
});
