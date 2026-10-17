import { describe, expect, it } from 'vitest';
import { ALL_STRUCTURES } from '../../../features/anatomy-revision/data/seed';
import { CATEGORIES, isMuscle, type Category } from '../../../features/anatomy-revision/types/structure';
import { STRUCTURE_SOURCES } from '../../../features/anatomy-revision/data/structureSources.generated';
import { FAMILIES, WORKS } from '../../../features/legal/data/provenance.generated';
import { buildProvenance } from '../provenance';

const root = process.cwd();
const totals = Object.fromEntries(CATEGORIES.map((c) => [c, ALL_STRUCTURES.filter((s) => s.category === c).length])) as Record<Category, number>;
const deck = ALL_STRUCTURES.filter(isMuscle).map((m) => m.source).filter((s): s is NonNullable<typeof s> => Boolean(s?.deck));
const built = buildProvenance(root, totals, deck, ALL_STRUCTURES.filter(isMuscle).map((m) => m.id));

describe("the Atlas card's sources line", () => {
  it('is generated from the review files as they are now (run generateProvenance.ts if not)', () => {
    const now = Object.fromEntries(Object.entries(built.byStructure).map(([id, w]) => [id, [w.facts, w.blood]]));
    expect(JSON.parse(JSON.stringify(STRUCTURE_SOURCES))).toEqual(now);
  });

  it('names only works /sources lists, for the family the structure is in', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    for (const [id, [facts]] of Object.entries(STRUCTURE_SOURCES)) {
      const s = byId.get(id);
      if (!s) continue;
      const family = FAMILIES.find((f) => f.category === s.category)!;
      for (const w of facts) {
        expect(WORKS[w], `${id} ${w}`).toBeDefined();
        expect(family.works, `${id}: ${WORKS[w].title}`).toContain(w);
      }
    }
  });

  it('does not change what /sources counts', () => {
    expect(built.works.map((w) => [w.title, w.citations])).toEqual(WORKS.map((w) => [w.title, w.citations]));
  });

  it('has a line for every muscle, and for most of everything else', () => {
    const muscles = ALL_STRUCTURES.filter(isMuscle);
    expect(muscles.filter((m) => !STRUCTURE_SOURCES[m.id]?.[0].length).map((m) => m.id)).toEqual([]);
    const sourced = ALL_STRUCTURES.filter((s) => STRUCTURE_SOURCES[s.id]?.[0].length);
    expect(sourced.length / ALL_STRUCTURES.length).toBeGreaterThan(0.9);
  });
});
