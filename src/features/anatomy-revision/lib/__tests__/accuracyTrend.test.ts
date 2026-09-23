import { describe, it, expect } from 'vitest';
import type { UserAttempt } from '../../types/attempt';
import { accuracyTrend, accuracyDeltaByAttempts, accuracyTrendSplit, gradedAttempts, splitByFirstExposure } from '../accuracyTrend';

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

describe('gradedAttempts', () => {
  it('drops learn cards, which carry no judgement', () => {
    const graded = attempt({ userId: 's1', timestamp: '2026-08-01T09:00:00.000Z' });
    const card = attempt({ userId: 's1', timestamp: '2026-08-01T09:01:00.000Z', graded: false, questionType: 'flashcard' });
    expect(gradedAttempts([graded, card])).toEqual([graded]);
  });
});

describe('splitByFirstExposure', () => {
  it('sends each structure\'s first attempt to firstSight and the rest to seenBefore, in time order', () => {
    const a1 = attempt({ userId: 's1', timestamp: '2026-08-02T09:00:00.000Z', structureId: 'deltoid', questionId: 'q-mcq' });
    const a2 = attempt({ userId: 's1', timestamp: '2026-08-01T09:00:00.000Z', structureId: 'deltoid', questionId: 'q-locate' });
    const b1 = attempt({ userId: 's1', timestamp: '2026-08-03T09:00:00.000Z', structureId: 'biceps-brachii', questionId: 'q-mcq' });
    const { firstSight, seenBefore } = splitByFirstExposure([a1, a2, b1]);
    // a2 is earlier than a1 even though it was listed second, and it is a
    // different QUESTION — first sight is about the structure, not the question.
    expect(firstSight).toEqual([a2, b1]);
    expect(seenBefore).toEqual([a1]);
  });
});

describe('accuracyTrendSplit', () => {
  it('draws both lines over the same days', () => {
    const attempts = [
      ...day('s1', '2026-08-01', 10, 5).map((a, i) => ({ ...a, structureId: `new-${i}` })),
      ...day('s1', '2026-08-05', 10, 9).map((a, i) => ({ ...a, structureId: `new-${i}` })),
    ];
    const split = accuracyTrendSplit(attempts);
    expect(split.firstSight).toHaveLength(10);
    expect(split.seenBefore).toHaveLength(10);
    const dates = split.firstSightTrend.map((p) => p.date);
    expect(dates).toEqual(split.seenBeforeTrend.map((p) => p.date));
    expect(dates[0]).toBe('2026-08-01');
    expect(dates[dates.length - 1]).toBe('2026-08-05');
    // First sight was the 1st, seen-before the 5th: each line only has data where it happened.
    expect(split.firstSightTrend[0].studentPct).toBe(50);
    expect(split.seenBeforeTrend[0].studentPct).toBeNull();
    expect(split.seenBeforeTrend[4].studentPct).toBe(90);
  });

  it('is empty for no attempts', () => {
    const split = accuracyTrendSplit([]);
    expect(split.firstSightTrend).toEqual([]);
    expect(split.seenBeforeTrend).toEqual([]);
  });

  it('draws first sight from the few attempts a student can actually produce', () => {
    // A realistic month: plenty of revision, and new structures met a couple at
    // a time. Under the revision line's rule (5 in 7 days) the new-content line
    // was computed and never drawn once — the chart showed one line and
    // described two.
    const attempts = [
      ...day('s1', '2026-08-03', 2, 1).map((a, i) => ({ ...a, structureId: `new-a${i}` })),
      ...day('s1', '2026-08-11', 2, 2).map((a, i) => ({ ...a, structureId: `new-b${i}` })),
      ...day('s1', '2026-08-18', 2, 1).map((a, i) => ({ ...a, structureId: `new-c${i}` })),
      ...day('s1', '2026-08-20', 12, 10).map((a, i) => ({ ...a, structureId: `new-a${i % 2}` })),
    ];
    const split = accuracyTrendSplit(attempts);
    expect(split.firstSight).toHaveLength(6);
    const drawn = split.firstSightTrend.filter((p) => p.studentPct !== null);
    expect(drawn.length).toBeGreaterThan(1);
    // Still refuses to draw a point from one lonely answer.
    const sparse = accuracyTrendSplit(day('s1', '2026-08-03', 1, 1).map((a) => ({ ...a, structureId: 'only-one' })));
    expect(sparse.firstSightTrend.every((p) => p.studentPct === null)).toBe(true);
  });
});

describe('a sparse line is widened, not dropped', () => {
  it('draws seen-before accuracy for a student who mostly meets new structures', () => {
    // The complaint this came from: nearly every answer is a first encounter,
    // so repeats never reach five inside a week and the revision line — the
    // one the page leads with — was the one that never appeared.
    const attempts = [
      ...day('s1', '2026-08-02', 20, 15).map((a, i) => ({ ...a, structureId: `new-${i}` })),
      ...day('s1', '2026-08-09', 20, 16).map((a, i) => ({ ...a, structureId: `later-${i}` })),
      // A handful of repeats, spread out: two, then two.
      ...day('s1', '2026-08-10', 2, 2).map((a, i) => ({ ...a, structureId: `new-${i}` })),
      ...day('s1', '2026-08-14', 2, 1).map((a, i) => ({ ...a, structureId: `new-${i}` })),
      ...day('s1', '2026-08-19', 2, 2).map((a, i) => ({ ...a, structureId: `new-${i}` })),
    ];
    const split = accuracyTrendSplit(attempts);
    expect(split.seenBefore).toHaveLength(6);
    expect(split.seenBeforeTrend.filter((p) => p.studentPct !== null).length).toBeGreaterThan(1);
    // And it says it took three weeks of answers to make those points.
    expect(split.seenBeforeWindowDays).toBe(21);
    expect(split.firstSightWindowDays).toBe(7);
  });
});
