import { describe, it, expect } from 'vitest';
import { computeNextReview, deriveImplicitConfidence, updateMasteryAfterAttempt } from '../mastery';
import type { StructureMastery } from '../../types/attempt';

describe('computeNextReview', () => {
  it('grows the interval on an easy rating', () => {
    const first = computeNextReview(undefined, 'easy');
    const second = computeNextReview(
      { intervalDays: first.intervalDays, easeFactor: first.easeFactor },
      'easy',
    );
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
  });

  it('resets the interval to 1 day on a hard rating', () => {
    const grown = computeNextReview({ intervalDays: 10, easeFactor: 2.5 }, 'easy');
    const reset = computeNextReview(grown, 'hard');
    expect(reset.intervalDays).toBe(1);
  });

  it('holds the interval steady on a medium rating', () => {
    const result = computeNextReview({ intervalDays: 4, easeFactor: 2.5 }, 'medium');
    expect(result.intervalDays).toBe(4);
  });

  it('never drops ease factor below the floor', () => {
    let mastery = { intervalDays: 1, easeFactor: 1.3 };
    for (let i = 0; i < 5; i++) {
      mastery = computeNextReview(mastery, 'hard');
    }
    expect(mastery.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('deriveImplicitConfidence', () => {
  it('derives hard on an incorrect answer regardless of duration', () => {
    expect(deriveImplicitConfidence(false, 500, 5000)).toBe('hard');
    expect(deriveImplicitConfidence(false, undefined, undefined)).toBe('hard');
  });

  it('derives medium when correct but there is no baseline yet', () => {
    expect(deriveImplicitConfidence(true, 3000, undefined)).toBe('medium');
  });

  it('derives medium when correct but there is no duration to compare', () => {
    expect(deriveImplicitConfidence(true, undefined, 3000)).toBe('medium');
  });

  it('derives easy when correct and faster than the baseline', () => {
    expect(deriveImplicitConfidence(true, 1000, 3000)).toBe('easy');
  });

  it('derives medium when correct and at or slower than the baseline', () => {
    expect(deriveImplicitConfidence(true, 3000, 3000)).toBe('medium');
    expect(deriveImplicitConfidence(true, 5000, 3000)).toBe('medium');
  });
});

describe('updateMasteryAfterAttempt', () => {
  const base = { structureId: 'deltoid', userId: 'user-1' };

  it('seeds the duration baseline and derives medium on a first no-confidence attempt', () => {
    const result = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    expect(result.durationEwmaMs).toBe(4000);
    expect(result.intervalDays).toBe(1); // 'medium' holds the default interval of 1 steady
  });

  it('derives easy and grows the interval when a later attempt is faster than the baseline', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    const faster = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 1000 });
    expect(faster.intervalDays).toBeGreaterThan(seeded.intervalDays!);
  });

  it('derives medium and holds the interval when a later attempt is slower than the baseline', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    const slower = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 8000 });
    expect(slower.intervalDays).toBe(seeded.intervalDays);
  });

  it('derives hard and resets the interval on an incorrect no-confidence attempt', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    const grown = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 1000 });
    const wrong = updateMasteryAfterAttempt(grown, { ...base, correct: false, durationMs: 1000 });
    expect(wrong.intervalDays).toBe(1);
  });

  it('lets an explicit confidence win over what duration would derive, and leaves the baseline untouched', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    // Duration (very slow) would derive 'medium', but explicit 'easy' should win and grow the interval.
    const result = updateMasteryAfterAttempt(seeded, {
      ...base,
      correct: true,
      confidence: 'easy',
      durationMs: 999_999,
    });
    expect(result.intervalDays).toBeGreaterThan(seeded.intervalDays!);
    expect(result.durationEwmaMs).toBe(seeded.durationEwmaMs);
  });

  it('increments lapses only when the pre-attempt interval was 7+ days and the answer is wrong', () => {
    const longInterval: StructureMastery = {
      structureId: 'deltoid',
      userId: 'user-1',
      attemptsTotal: 5,
      attemptsCorrect: 5,
      lastAttemptAt: new Date().toISOString(),
      intervalDays: 10,
      easeFactor: 2.5,
    };
    const lapsed = updateMasteryAfterAttempt(longInterval, { ...base, correct: false });
    expect(lapsed.lapses).toBe(1);

    const shortInterval: StructureMastery = { ...longInterval, intervalDays: 3 };
    const notLapsed = updateMasteryAfterAttempt(shortInterval, { ...base, correct: false });
    expect(notLapsed.lapses).toBe(0);
  });

  it('flags isLeech once lapses reach the threshold and caps the interval on a subsequent easy answer', () => {
    let mastery: StructureMastery = {
      structureId: 'deltoid',
      userId: 'user-1',
      attemptsTotal: 20,
      attemptsCorrect: 15,
      lastAttemptAt: new Date().toISOString(),
      intervalDays: 10,
      easeFactor: 2.5,
      lapses: 3,
    };
    mastery = updateMasteryAfterAttempt(mastery, { ...base, correct: false });
    expect(mastery.lapses).toBe(4);
    expect(mastery.isLeech).toBe(true);

    const now = new Date();
    const capped = updateMasteryAfterAttempt({ ...mastery, intervalDays: 10 }, { ...base, correct: true, confidence: 'easy' }, now);
    const cappedIntervalDays = capped.intervalDays!;
    expect(cappedIntervalDays).toBeLessThanOrEqual(7);
    expect(capped.dueAt).toBe(new Date(now.getTime() + cappedIntervalDays * 24 * 60 * 60 * 1000).toISOString());
  });

  it('keeps attemptsTotal/attemptsCorrect bookkeeping correct across attempts', () => {
    const first = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 1000 });
    const second = updateMasteryAfterAttempt(first, { ...base, correct: false, durationMs: 1000 });
    expect(second.attemptsTotal).toBe(2);
    expect(second.attemptsCorrect).toBe(1);
  });
});
