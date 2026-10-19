import { describe, expect, it } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { lensOptions, matchesLens, movementLabel, nerveKey } from '../atlasLenses';
import { DEFAULT_FILTERS, filterAtlas } from '../atlasList';
import { isMuscle } from '../../types/structure';

describe('nerveKey', () => {
  it('reads one nerve however it is written', () => {
    expect(nerveKey('Tibial nerve (long head)')).toBe('Tibial nerve');
    expect(nerveKey('Deep fibular (peroneal) nerve')).toBe('Deep fibular nerve');
    expect(nerveKey('Deep fibular nerve')).toBe('Deep fibular nerve');
  });

  it('leaves out bare roots, which are levels rather than nerves', () => {
    expect(nerveKey('L1')).toBeNull();
    expect(nerveKey('C3–C4 (sensory)')).toBeNull();
  });
});

describe('lenses over the real muscles', () => {
  it('offers the femoral nerve, and it finds the quadriceps', () => {
    const femoral = lensOptions(ALL_STRUCTURES, 'nerve').find((o) => o.value === 'Femoral nerve');
    expect(femoral?.count).toBeGreaterThanOrEqual(5);
    const rf = ALL_STRUCTURES.find((s) => s.id === 'rectus-femoris')!;
    expect(matchesLens(rf, 'nerve', 'Femoral nerve')).toBe(true);
    expect(matchesLens(rf, 'movement', 'hip-flexion')).toBe(true);
  });

  it('has no duplicate spellings of one nerve', () => {
    const labels = lensOptions(ALL_STRUCTURES, 'nerve').map((o) => o.label);
    expect(labels).not.toContain('Deep fibular (peroneal) nerve');
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('labels movements and groups for people', () => {
    expect(movementLabel('hip-external-rotation')).toBe('Hip external rotation');
    expect(lensOptions(ALL_STRUCTURES, 'group').find((o) => o.value === 'rotator-cuff')?.label).toBe('Rotator cuff');
  });

  it('narrows the atlas to muscles when a lens is set, and to the starred list', () => {
    const rows = new Map(ALL_STRUCTURES.map((s) => [s.id, { searchText: s.name.toLowerCase() } as never]));
    const byNerve = filterAtlas(ALL_STRUCTURES, rows, { ...DEFAULT_FILTERS, lens: { group: 'all', movement: 'all', nerve: 'Femoral nerve' } }, new Map());
    expect(byNerve.length).toBeGreaterThan(0);
    expect(byNerve.every(isMuscle)).toBe(true);
    const starred = filterAtlas(ALL_STRUCTURES, rows, { ...DEFAULT_FILTERS, starred: true }, new Map(), new Set(['femur', 'deltoid']));
    expect(starred.map((s) => s.id).sort()).toEqual(['deltoid', 'femur']);
  });
});
