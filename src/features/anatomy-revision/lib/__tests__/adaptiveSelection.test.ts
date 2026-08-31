import { describe, it, expect } from 'vitest';
import { adaptiveWeight, isWellKnown, selectAdaptiveStructures, pickAdaptiveQuestionType } from '../adaptiveSelection';
import { createRng } from '../rng';
import type { StructureMastery } from '../../types/attempt';

const now = new Date('2026-08-25T12:00:00.000Z');

function mastery(overrides: Partial<StructureMastery> = {}): StructureMastery {
  return {
    structureId: 'deltoid',
    userId: 'user-1',
    attemptsTotal: 5,
    attemptsCorrect: 4,
    lastAttemptAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('adaptiveWeight', () => {
  it('gives never-attempted structures a neutral baseline weight', () => {
    expect(adaptiveWeight(undefined, now)).toBe(1);
  });

  it('weights overdue structures heavier than on-time ones', () => {
    const overdue = adaptiveWeight(mastery({ dueAt: '2026-08-20T00:00:00.000Z' }), now);
    const onTime = adaptiveWeight(mastery({ dueAt: '2026-08-30T00:00:00.000Z' }), now);
    expect(overdue).toBeGreaterThan(onTime);
  });

  it('weights lower-accuracy structures heavier', () => {
    const weak = adaptiveWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 2 }), now);
    const strong = adaptiveWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 9 }), now);
    expect(weak).toBeGreaterThan(strong);
  });

  it('boosts leech structures', () => {
    const leech = adaptiveWeight(mastery({ isLeech: true }), now);
    const nonLeech = adaptiveWeight(mastery({ isLeech: false }), now);
    expect(leech).toBeGreaterThan(nonLeech);
  });

  it('heavily downweights a structure answered moments ago', () => {
    const justAnswered = adaptiveWeight(mastery({ lastAttemptAt: '2026-08-25T11:50:00.000Z' }), now);
    const answeredAWhileAgo = adaptiveWeight(mastery({ lastAttemptAt: '2026-08-01T00:00:00.000Z' }), now);
    expect(justAnswered).toBeLessThan(answeredAWhileAgo);
  });
});

describe('isWellKnown', () => {
  it('is false for never-attempted structures', () => {
    expect(isWellKnown(undefined, now)).toBe(false);
  });

  it('is false for a low-accuracy structure', () => {
    expect(isWellKnown(mastery({ attemptsTotal: 10, attemptsCorrect: 3 }), now)).toBe(false);
  });

  it('is false for an overdue structure even with good accuracy', () => {
    expect(isWellKnown(mastery({ attemptsTotal: 10, attemptsCorrect: 9, dueAt: '2026-08-01T00:00:00.000Z' }), now)).toBe(false);
  });

  it('is false for a leech even with good accuracy and not overdue', () => {
    expect(isWellKnown(mastery({ attemptsTotal: 10, attemptsCorrect: 9, dueAt: '2026-09-01T00:00:00.000Z', isLeech: true }), now)).toBe(
      false,
    );
  });

  it('is true for a high-accuracy, not-yet-due, non-leech structure', () => {
    expect(isWellKnown(mastery({ attemptsTotal: 10, attemptsCorrect: 9, dueAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(true);
  });
});

describe('selectAdaptiveStructures', () => {
  const structures = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` }));

  it('returns the requested count when enough structures exist', () => {
    const result = selectAdaptiveStructures(structures, new Map(), 10, createRng(1), now);
    expect(result).toHaveLength(10);
  });

  it('never returns duplicate structures', () => {
    const result = selectAdaptiveStructures(structures, new Map(), 15, createRng(2), now);
    expect(new Set(result.map((s) => s.id)).size).toBe(result.length);
  });

  it('is deterministic given the same seed', () => {
    const a = selectAdaptiveStructures(structures, new Map(), 10, createRng(42), now);
    const b = selectAdaptiveStructures(structures, new Map(), 10, createRng(42), now);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  it('includes a guaranteed slice of well-known structures, not just weak ones', () => {
    const masteryByStructureId = new Map<string, StructureMastery>();
    // First 10 are well-known; last 10 are never-attempted (weak).
    for (let i = 0; i < 10; i++) {
      masteryByStructureId.set(`s${i}`, mastery({ structureId: `s${i}`, attemptsTotal: 10, attemptsCorrect: 10, dueAt: '2026-09-01T00:00:00.000Z' }));
    }
    const result = selectAdaptiveStructures(structures, masteryByStructureId, 20, createRng(3), now);
    const knownPicked = result.filter((s) => Number(s.id.slice(1)) < 10).length;
    expect(knownPicked).toBeGreaterThan(0);
    expect(knownPicked).toBeLessThan(20); // not exclusively known either
  });

  it('falls back to backfill when one bucket is empty', () => {
    // Nothing is well-known — the whole pool is "weak".
    const result = selectAdaptiveStructures(structures, new Map(), 20, createRng(4), now);
    expect(result).toHaveLength(20);
  });
});

describe('pickAdaptiveQuestionType', () => {
  const allTypes = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed'] as const;

  it('picks mcq for a never-attempted structure', () => {
    expect(pickAdaptiveQuestionType(undefined, allTypes)).toBe('mcq');
  });

  it('picks mcq for low accuracy', () => {
    expect(pickAdaptiveQuestionType(mastery({ attemptsTotal: 10, attemptsCorrect: 3 }), allTypes)).toBe('mcq');
  });

  it('picks fill-blank for medium accuracy', () => {
    expect(pickAdaptiveQuestionType(mastery({ attemptsTotal: 10, attemptsCorrect: 7 }), allTypes)).toBe('fill-blank');
  });

  it('picks identify-typed for high accuracy', () => {
    expect(pickAdaptiveQuestionType(mastery({ attemptsTotal: 10, attemptsCorrect: 9 }), allTypes)).toBe('identify-typed');
  });

  it('falls back down the ladder when the ideal type was not requested', () => {
    const highAccuracy = mastery({ attemptsTotal: 10, attemptsCorrect: 9 });
    expect(pickAdaptiveQuestionType(highAccuracy, ['mcq', 'flashcard'])).toBe('mcq');
  });

  it('returns null when no requested types remain', () => {
    expect(pickAdaptiveQuestionType(undefined, [])).toBeNull();
  });
});
