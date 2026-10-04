import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { STRUCTURE_INDEX } from '../../data/structureIndex';
import {
  STRUCTURE_FACT_FIELDS,
  STRUCTURE_INDEX_FIELDS,
  hasDescription,
  type StructureIndexEntry,
} from '../structureIndex';

describe('the index / fact field lists', () => {
  it('put no field on both sides', () => {
    const facts = new Set<string>(STRUCTURE_FACT_FIELDS);
    expect(STRUCTURE_INDEX_FIELDS.filter((f) => facts.has(f))).toEqual([]);
  });

  // The type checks in structureIndex.ts hold the declared types to the lists.
  // This holds the DATA to them: a seed object is a plain literal, and a field
  // typed onto it through a cast or a spread would not be caught there.
  it('classify every field that appears on any seed structure', () => {
    const known = new Set<string>([...STRUCTURE_INDEX_FIELDS, ...STRUCTURE_FACT_FIELDS]);
    const stray = new Set<string>();
    for (const s of ALL_STRUCTURES) {
      for (const key of Object.keys(s)) if (!known.has(key)) stray.add(key);
    }
    expect([...stray]).toEqual([]);
  });

  it('name no field the seed never uses, except the two reserved for later', () => {
    const used = new Set(ALL_STRUCTURES.flatMap((s) => Object.keys(s)));
    const unused = [...STRUCTURE_INDEX_FIELDS, ...STRUCTURE_FACT_FIELDS].filter((f) => !used.has(f));
    // Declared on the type and waiting for content: recorded clips (CR-011),
    // and the two clinical fields nobody has authored yet. Listed so that a
    // field going unused by accident — a rename that missed the list — fails.
    expect(unused.sort()).toEqual(['audioUrl', 'dermatomeRelation', 'referredPainPattern'].filter((f) => !used.has(f)).sort());
  });
});

describe('hasDescription', () => {
  const entry: StructureIndexEntry = {
    id: 'x',
    name: 'X',
    aliases: [],
    category: 'bone',
    region: 'hip-thigh',
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: [],
  };

  it('reads the flag on an index entry', () => {
    expect(hasDescription({ ...entry, hasDescription: true })).toBe(true);
    expect(hasDescription({ ...entry, hasDescription: false })).toBe(false);
  });

  it('reads the description itself on a full structure, which carries no flag', () => {
    for (const s of ALL_STRUCTURES) expect(hasDescription(s)).toBe(s.description.length > 0);
  });

  it('is false for an entry with neither', () => {
    expect(hasDescription(entry)).toBe(false);
  });
});

describe('STRUCTURE_INDEX', () => {
  it('is every seed structure, in seed order', () => {
    expect(STRUCTURE_INDEX.map((s) => s.id)).toEqual(ALL_STRUCTURES.map((s) => s.id));
  });
});
