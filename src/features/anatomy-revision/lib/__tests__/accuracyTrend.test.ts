import { describe, it, expect } from 'vitest';
import type { UserAttempt } from '../../types/attempt';
import { accuracyTrend, accuracyDeltaByAttempts } from '../accuracyTrend';

function attempt(overrides: Partial<UserAttempt> & { userId: string; timestamp: string }): UserAttempt {
  return {
    id: `${overrides.userId}-${overrides.timestamp}-${Math.random()}`,
    sessionId: 's1',
    questionId: 'q1',
    questionType: 'mcq',
    structureId: 'deltoid',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    correct: true,
    attemptNumber: 1,
    ...overrides,
  };
}

/**
 * `correct` of the given count on one day, the rest wrong. One minute apart so
 * every attempt has a distinct timestamp — attempt-order tests are meaningless
 * against ties. Keep `total` <= 60.
 */
function day(userId: string, date: string, total: number, correct: number): UserAttempt[] {
  return Array.from({ length: total }, (_, i) =>
    attempt({ userId, timestamp: `${date}T09:${String(i).padStart(2, '0')}:00.000Z`, correct: i < correct }),
  );
}

describe('accuracyTrend', () => {
  it('returns nothing when the student has no attempts', () => {
    expect(accuracyTrend([], day('other', '2026-08-01', 40, 30))).toEqual([]);
  });

  it('spans the student\'s own first-to-last day, one point per day', () => {
    const attempts = [...day('s1', '2026-08-01', 10, 5), ...day('s1', '2026-08-04', 10, 5)];
    const points = accuracyTrend(attempts, attempts);
    expect(points.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
  });

  it('averages over the trailing window rather than the single day', () => {
    // 10 attempts at 100% on day 1, then 10 at 0% on day 2 — the day-2 point is
    // the window's 50%, not that day's 0%.
    const attempts = [...day('s1', '2026-08-01', 10, 10), ...day('s1', '2026-08-02', 10, 0)];
    const points = accuracyTrend(attempts, attempts);
    expect(points[0].studentPct).toBe(100);
    expect(points[1].studentPct).toBe(50);
    expect(points[1].studentAttempts).toBe(20);
  });

  it('drops a point when the window holds fewer than minAttempts', () => {
    const attempts = [...day('s1', '2026-08-01', 3, 3), ...day('s1', '2026-08-20', 8, 4)];
    const points = accuracyTrend(attempts, attempts);
    // Day 1 has only 3 attempts in its window; by 2026-08-20 the earlier day has
    // fallen out of the 7-day window entirely, leaving that day's 8 on its own.
    expect(points[0].studentPct).toBeNull();
    expect(points[points.length - 1].studentPct).toBe(50);
  });

  it('leaves the window behind as days pass, so old accuracy stops counting', () => {
    const attempts = [...day('s1', '2026-08-01', 10, 10), ...day('s1', '2026-08-10', 10, 0)];
    const points = accuracyTrend(attempts, attempts);
    expect(points.find((p) => p.date === '2026-08-10')?.studentPct).toBe(0);
  });

  it('computes the cohort line over every student, on the same days', () => {
    const student = day('s1', '2026-08-01', 10, 10);
    const cohort = [...student, ...day('s2', '2026-08-01', 10, 0), ...day('s3', '2026-08-01', 10, 5)];
    const points = accuracyTrend(student, cohort);
    expect(points[0].studentPct).toBe(100);
    expect(points[0].cohortPct).toBe(50);
    expect(points[0].cohortAttempts).toBe(30);
  });

  it('holds the cohort line to a higher attempt bar than one student', () => {
    const student = day('s1', '2026-08-01', 10, 7);
    // 10 cohort attempts clears the student bar (5) but not the cohort's (15).
    const points = accuracyTrend(student, student);
    expect(points[0].studentPct).toBe(70);
    expect(points[0].cohortPct).toBeNull();
  });
});

describe('accuracyDeltaByAttempts', () => {
  it('compares the first quarter of attempts with the last', () => {
    // Four sessions of 20: two at 40%, then two at 90%. The quartile is one
    // session, so the comparison is the first session against the last.
    const attempts = [
      ...day('s1', '2026-08-01', 20, 8),
      ...day('s1', '2026-08-02', 20, 8),
      ...day('s1', '2026-08-03', 20, 18),
      ...day('s1', '2026-08-04', 20, 18),
    ];
    expect(accuracyDeltaByAttempts(attempts)).toEqual({ deltaPts: 50, firstPct: 40, lastPct: 90, sliceSize: 20 });
  });

  it('is immune to the sparse-day artifact the rolling line has', () => {
    // One lucky 5/5 session, then a steady 70% for a fortnight. A date-based
    // reading carries that session across a week of windows and reports a
    // decline; by attempts the student is flat.
    const attempts = [
      ...day('s1', '2026-08-01', 5, 5),
      ...Array.from({ length: 14 }, (_, i) => day('s1', `2026-08-${String(i + 2).padStart(2, '0')}`, 10, 7)).flat(),
    ];
    expect(Math.abs(accuracyDeltaByAttempts(attempts)!.deltaPts)).toBeLessThan(10);
  });

  it('returns null when there is too little history to compare', () => {
    expect(accuracyDeltaByAttempts(day('s1', '2026-08-01', 39, 20))).toBeNull();
  });
});
