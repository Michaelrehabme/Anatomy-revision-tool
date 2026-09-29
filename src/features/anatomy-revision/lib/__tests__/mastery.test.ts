import { describe, it, expect } from 'vitest';
import { computeNextReview, deriveImplicitConfidence, MAX_INTERVAL_DAYS, scheduleConfidence, updateMasteryAfterAttempt } from '../mastery';
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

  // The daily review repeated the same muscles for days: every structure
  // starts on 1 day and Medium held it there, so a Medium was a Hard.
  it('moves a 1-day structure on to 4 days on medium and 10 on easy, as the buttons say', () => {
    expect(computeNextReview(undefined, 'medium').intervalDays).toBe(4);
    expect(computeNextReview({ intervalDays: 1, easeFactor: 2.5 }, 'medium').intervalDays).toBe(4);
    expect(computeNextReview(undefined, 'easy').intervalDays).toBe(10);
  });

  it('grows the interval by the ease factor on medium, and faster on easy', () => {
    expect(computeNextReview({ intervalDays: 4, easeFactor: 2.5 }, 'medium').intervalDays).toBe(10);
    expect(computeNextReview({ intervalDays: 4, easeFactor: 2.5 }, 'easy').intervalDays).toBe(13);
  });

  it('never schedules a structure further out than the ceiling, however often it is easy', () => {
    let mastery = computeNextReview(undefined, 'easy');
    for (let i = 0; i < 10; i++) mastery = computeNextReview(mastery, 'easy');
    expect(mastery.intervalDays).toBe(MAX_INTERVAL_DAYS);
    expect(computeNextReview({ intervalDays: 25, easeFactor: 2.5 }, 'medium').intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('never drops ease factor below the floor', () => {
    let mastery = { intervalDays: 1, easeFactor: 1.3 };
    for (let i = 0; i < 5; i++) {
      mastery = computeNextReview(mastery, 'hard');
    }
    expect(mastery.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('scheduleConfidence', () => {
  it('takes a correct answer at its rating, Hard included', () => {
    expect(scheduleConfidence(true, 'easy')).toBe('easy');
    expect(scheduleConfidence(true, 'hard')).toBe('hard');
  });

  it('schedules a wrong answer as Hard whatever was pressed', () => {
    expect(scheduleConfidence(false, 'easy')).toBe('hard');
    expect(scheduleConfidence(false, 'medium')).toBe('hard');
  });

  it('lets a mostly-right multi-part answer count as Medium at most', () => {
    expect(scheduleConfidence(false, 'easy', 2 / 3)).toBe('medium');
    expect(scheduleConfidence(false, 'medium', 2 / 3)).toBe('medium');
    expect(scheduleConfidence(false, 'hard', 2 / 3)).toBe('hard');
    expect(scheduleConfidence(false, 'medium', 1 / 3)).toBe('hard');
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
    expect(result.intervalDays).toBe(4); // 'medium' takes the default 1-day interval to 4
  });

  it('derives easy and grows the interval when a later attempt is faster than the baseline', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    const faster = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 1000 });
    expect(faster.intervalDays).toBeGreaterThan(seeded.intervalDays!);
  });

  it('derives medium, growing the interval less than easy, when a later attempt is slower than the baseline', () => {
    const seeded = updateMasteryAfterAttempt(undefined, { ...base, correct: true, durationMs: 4000 });
    const slower = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 8000 });
    const faster = updateMasteryAfterAttempt(seeded, { ...base, correct: true, durationMs: 1000 });
    expect(slower.intervalDays).toBeGreaterThan(seeded.intervalDays!);
    expect(slower.intervalDays).toBeLessThan(faster.intervalDays!);
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

  it('does not push a wrong answer out, but lets two of three right keep its place', () => {
    const known: StructureMastery = { ...base, attemptsTotal: 3, attemptsCorrect: 3, lastAttemptAt: '', intervalDays: 4, easeFactor: 2.5 };
    const blank = updateMasteryAfterAttempt(known, { ...base, correct: false, confidence: 'easy' });
    const near = updateMasteryAfterAttempt(known, { ...base, correct: false, confidence: 'easy', partialCredit: 2 / 3 });
    expect(blank.intervalDays).toBe(1);
    expect(near.intervalDays).toBe(10);
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

describe('updateMasteryAfterAttempt and the ladder', () => {
  it('stamps firstSeenAt once and climbs a rung after three correct answers', () => {
    const now = new Date('2026-09-20T09:00:00.000Z');
    let m: StructureMastery | undefined;
    for (let i = 0; i < 3; i++) {
      m = updateMasteryAfterAttempt(m, { structureId: 'deltoid', userId: 'u', correct: true, confidence: 'easy' }, now);
    }
    expect(m!.firstSeenAt).toBe(now.toISOString());
    expect(m!.rung).toBe('typed-hinted');
    const later = updateMasteryAfterAttempt(m, { structureId: 'deltoid', userId: 'u', correct: false, confidence: 'hard' }, new Date('2026-09-21T09:00:00.000Z'));
    expect(later.firstSeenAt).toBe(now.toISOString());
    expect(later.rung).toBe('typed-hinted');
    expect(later.rungMissStreak).toBe(1);
  });

  it('keeps recentAccuracy on the row, seeded from all-time for a row that predates it', () => {
    const legacy: StructureMastery = {
      structureId: 'deltoid',
      userId: 'u',
      attemptsTotal: 10,
      attemptsCorrect: 2,
      lastAttemptAt: '2026-09-01T09:00:00.000Z',
      rung: 'mcq',
    };
    const next = updateMasteryAfterAttempt(legacy, { structureId: 'deltoid', userId: 'u', correct: true, confidence: 'easy' });
    expect(next.recentAccuracy).toBeCloseTo(0.25 + 0.75 * 0.2);
  });
});
