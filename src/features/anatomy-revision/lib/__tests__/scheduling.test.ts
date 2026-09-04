import { describe, it, expect } from 'vitest';
import type { StructureMastery } from '../../types/attempt';
import { structureWeight, buildWeightMap, UNSEEN_WEIGHT } from '../scheduling';
import { weightedShuffle, createRng } from '../rng';

const NOW = new Date('2026-08-31T12:00:00.000Z');

function mastery(overrides: Partial<StructureMastery> = {}): StructureMastery {
  return {
    structureId: 'biceps-brachii',
    userId: 'u1',
    attemptsTotal: 10,
    attemptsCorrect: 5,
    lastAttemptAt: NOW.toISOString(),
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe('structureWeight', () => {
  it('treats a never-attempted structure as needing exposure', () => {
    expect(structureWeight(undefined, NOW)).toBe(UNSEEN_WEIGHT);
    expect(structureWeight(mastery({ attemptsTotal: 0, attemptsCorrect: 0 }), NOW)).toBe(UNSEEN_WEIGHT);
  });

  it('weights a consistently-wrong structure above a consistently-right one', () => {
    const weak = structureWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 0 }), NOW);
    const strong = structureWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 10 }), NOW);
    expect(weak).toBeGreaterThan(strong);
    expect(weak).toBeGreaterThan(UNSEEN_WEIGHT);
    expect(strong).toBeLessThan(UNSEEN_WEIGHT);
  });

  it('never weights a well-known structure to zero', () => {
    const strong = structureWeight(
      mastery({ attemptsTotal: 200, attemptsCorrect: 200, intervalDays: 30, dueAt: daysFromNow(30) }),
      NOW,
    );
    expect(strong).toBeGreaterThan(0);
  });

  it('smooths tiny attempt counts so one answer does not decide everything', () => {
    // A single wrong answer must not outrank a structure wrong ten times.
    const oneWrong = structureWeight(mastery({ attemptsTotal: 1, attemptsCorrect: 0 }), NOW);
    const tenWrong = structureWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 0 }), NOW);
    expect(oneWrong).toBeLessThan(tenWrong);

    // And a single lucky answer must not bury it below a proven-known one.
    const oneRight = structureWeight(mastery({ attemptsTotal: 1, attemptsCorrect: 1 }), NOW);
    const tenRight = structureWeight(mastery({ attemptsTotal: 10, attemptsCorrect: 10 }), NOW);
    expect(oneRight).toBeGreaterThan(tenRight);
  });

  it('boosts an overdue structure and damps a freshly-reviewed one', () => {
    const base = { attemptsTotal: 10, attemptsCorrect: 5, intervalDays: 10 };
    const overdue = structureWeight(mastery({ ...base, dueAt: daysFromNow(-7) }), NOW);
    const noSchedule = structureWeight(mastery(base), NOW);
    const fresh = structureWeight(mastery({ ...base, dueAt: daysFromNow(10) }), NOW);

    expect(overdue).toBeGreaterThan(noSchedule);
    expect(fresh).toBeLessThan(noSchedule);
  });

  it('saturates the overdue boost rather than letting it run away', () => {
    const base = { attemptsTotal: 10, attemptsCorrect: 5, intervalDays: 5 };
    const twoWeeks = structureWeight(mastery({ ...base, dueAt: daysFromNow(-14) }), NOW);
    const twoYears = structureWeight(mastery({ ...base, dueAt: daysFromNow(-730) }), NOW);
    expect(twoYears).toBeCloseTo(twoWeeks, 10);
  });

  it('ignores an unparseable dueAt instead of producing NaN', () => {
    const weight = structureWeight(mastery({ dueAt: 'not-a-date' }), NOW);
    expect(Number.isFinite(weight)).toBe(true);
  });

  it('measures the not-yet-due damping against the structure own interval', () => {
    // Same absolute distance from due, different intervals. The 60-day structure
    // is 58/60 through its wait — all but due — while the 4-day one is only
    // halfway, so the long-interval structure is weighted higher. Damping on
    // absolute days-until-due instead would have these the wrong way round.
    const shortInterval = structureWeight(
      mastery({ attemptsTotal: 10, attemptsCorrect: 5, intervalDays: 4, dueAt: daysFromNow(2) }),
      NOW,
    );
    const longInterval = structureWeight(
      mastery({ attemptsTotal: 10, attemptsCorrect: 5, intervalDays: 60, dueAt: daysFromNow(2) }),
      NOW,
    );
    expect(longInterval).toBeGreaterThan(shortInterval);
  });
});

describe('buildWeightMap', () => {
  it('keys weights by structureId and omits unattempted structures', () => {
    const weights = buildWeightMap(
      [
        mastery({ structureId: 'a', attemptsTotal: 10, attemptsCorrect: 0 }),
        mastery({ structureId: 'b', attemptsTotal: 10, attemptsCorrect: 10 }),
      ],
      NOW,
    );
    expect([...weights.keys()].sort()).toEqual(['a', 'b']);
    expect(weights.get('a')!).toBeGreaterThan(weights.get('b')!);
    expect(weights.get('c')).toBeUndefined();
  });
});

describe('weightedShuffle', () => {
  const items = ['heavy', 'light-1', 'light-2', 'light-3'];
  const weightOf = (item: string) => (item === 'heavy' ? 50 : 1);

  it('returns a permutation, never dropping or duplicating items', () => {
    const result = weightedShuffle(items, weightOf, createRng(7));
    expect([...result].sort()).toEqual([...items].sort());
  });

  it('is deterministic under a fixed seed', () => {
    expect(weightedShuffle(items, weightOf, createRng(99))).toEqual(
      weightedShuffle(items, weightOf, createRng(99)),
    );
  });

  it('puts heavy items first far more often than chance', () => {
    let heavyFirst = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (weightedShuffle(items, weightOf, createRng(seed))[0] === 'heavy') heavyFirst++;
    }
    // Uniform would be ~25%; the 50:1 weighting should clear 80%.
    expect(heavyFirst).toBeGreaterThan(160);
  });

  it('falls back to a uniform shuffle when every weight is zero', () => {
    const result = weightedShuffle(items, () => 0, createRng(3));
    expect([...result].sort()).toEqual([...items].sort());
  });

  it('handles an empty list', () => {
    expect(weightedShuffle([], weightOf, createRng(1))).toEqual([]);
  });
});
