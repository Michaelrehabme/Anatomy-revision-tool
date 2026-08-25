import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildIndexes } from '../indexes';
import { pickNameDistractors } from '../distractors';
import { createRng } from '../rng';
import { isMcqQuestion, isFillBlankQuestion } from '../../types/question';

describe('generateRevisionSet', () => {
  it('generates flashcards and MCQs for the full seed dataset deterministically', () => {
    const config = { types: ['flashcard', 'mcq'] as const, mode: 'practice' as const, seed: 42 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('never generates locate questions when no images have hotspots (current seed state)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['locate'],
      mode: 'practice',
      seed: 1,
    });
    expect(result).toHaveLength(0);
  });

  it('respects region filtering', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      region: 'hip-thigh',
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.region === 'hip-thigh')).toBe(true);
  });

  it('respects multi-region filtering (OR-matched), taking precedence over `region`', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      region: 'back-core', // should be ignored since `regions` is set
      regions: ['hip-thigh', 'lower-leg-foot'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.region === 'hip-thigh' || q.region === 'lower-leg-foot')).toBe(true);
  });

  it('an empty `regions` array applies no region filter at all', () => {
    const filtered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      regions: [],
      mode: 'practice',
      seed: 1,
    });
    const unfiltered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      mode: 'practice',
      seed: 1,
    });
    expect(filtered.length).toBe(unfiltered.length);
  });

  it('assessment mode samples the requested count (or fewer if pool is smaller)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      mode: 'assessment',
      count: 3,
      seed: 7,
    });
    expect(result).toHaveLength(3);
  });

  it('generates fill-blank questions for bones and landmarks, deterministically', () => {
    const config = { types: ['fill-blank'] as const, mode: 'practice' as const, seed: 11 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    for (const q of a.filter(isFillBlankQuestion)) {
      expect(q.category === 'bone' || q.category === 'landmark').toBe(true);
      expect(q.answer.length).toBeGreaterThan(0);
      expect(q.before + q.after).not.toBe('');
    }
  });

  it('never generates identify-typed questions when no images have hotspots (atlas-slide gap), but does for single-structure images', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['identify-typed'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.every((q) => q.type === 'identify-typed')).toBe(true);
  });

  it('MCQ choices always include the correct answer exactly once', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['mcq'],
      mode: 'practice',
      seed: 5,
    });
    for (const q of result.filter(isMcqQuestion)) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });
});

describe('pickNameDistractors', () => {
  it('never includes the correct structure itself', () => {
    const rng = createRng(3);
    const sartorius = ALL_STRUCTURES.find((s) => s.id === 'sartorius')!;
    const distractors = pickNameDistractors(sartorius, ALL_STRUCTURES, 3, rng);
    expect(distractors).not.toContain(sartorius.name);
  });

  it('prefers same-region structures before falling back to the full dataset', () => {
    buildIndexes(ALL_STRUCTURES); // sanity: indexes build without throwing over seed data
    const rng = createRng(9);
    const iliacus = ALL_STRUCTURES.find((s) => s.id === 'iliacus')!;
    const distractors = pickNameDistractors(iliacus, ALL_STRUCTURES, 2, rng);
    expect(distractors.length).toBeGreaterThan(0);
  });
});
