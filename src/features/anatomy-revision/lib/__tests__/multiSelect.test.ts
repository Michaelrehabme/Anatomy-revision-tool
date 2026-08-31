import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { buildIndexes } from '../indexes';
import { buildMultiSelectQuestions } from '../questionGenerators/multiSelect';
import { createRng } from '../rng';

describe('buildMultiSelectQuestions', () => {
  const indexes = buildIndexes(ALL_STRUCTURES);

  it('generates at least one question over the full seed dataset', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(1));
    expect(result.length).toBeGreaterThan(0);
  });

  it('is deterministic given the same seed', () => {
    const a = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(42));
    const b = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(42));
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('every question has at least 2 correct indices for nerve-based questions, or exactly 1 for exclusion questions', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(3));
    for (const q of result) {
      expect(q.correctIndices.length).toBeGreaterThan(0);
      if (q.id.startsWith('multiselect-nerve-')) {
        expect(q.correctIndices.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(q.correctIndices.length).toBe(1);
      }
    }
  });

  it('every correct index is within bounds and choices have no duplicate names', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(5));
    for (const q of result) {
      for (const i of q.correctIndices) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(q.choices.length);
      }
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });

  it('generates at least one joint-movement question, with exactly one correct index (CR-014)', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(2));
    const jointQuestions = result.filter((q) => q.id.startsWith('multiselect-joint-movement-'));
    expect(jointQuestions.length).toBeGreaterThan(0);
    for (const q of jointQuestions) {
      expect(q.correctIndices.length).toBe(1);
    }
  });

  it('the humeroulnar joint question flags a movement genuinely absent from its own movements list', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(2));
    const q = result.find((r) => r.id === 'multiselect-joint-movement-humeroulnar-joint');
    expect(q).toBeDefined();
    if (!q) return;
    const oddOneOut = q.choices[q.correctIndices[0]];
    expect(['Flexion', 'Extension']).not.toContain(oddOneOut);
  });

  it('nerve questions only mark muscles actually on that nerve as correct', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(8));
    const nerveQuestion = result.find((q) => q.id.startsWith('multiselect-nerve-'));
    expect(nerveQuestion).toBeDefined();
    if (!nerveQuestion) return;

    const nerveName = nerveQuestion.id.replace('multiselect-nerve-', '').replace(/-/g, ' ');
    const structureIdsOnNerve = new Set(
      [...indexes.byNerve.entries()].find(([name]) => name.toLowerCase() === nerveName)?.[1] ?? [],
    );
    const structuresByName = new Map(ALL_STRUCTURES.map((s) => [s.name, s.id]));

    nerveQuestion.choices.forEach((name, i) => {
      const id = structuresByName.get(name);
      const isMarkedCorrect = nerveQuestion.correctIndices.includes(i);
      if (id && structureIdsOnNerve.has(id)) {
        expect(isMarkedCorrect).toBe(true);
      } else {
        expect(isMarkedCorrect).toBe(false);
      }
    });
  });
});
