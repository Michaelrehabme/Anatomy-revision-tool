import { describe, it, expect } from 'vitest';
import type { AnatomyStructure } from '../../../anatomy-revision/types/structure';
import type { RevisionSessionSummary, UserAttempt } from '../../../anatomy-revision/types/attempt';
import type { DayTally } from '../../../anatomy-revision/lib/accuracyTrend';
import {
  aggregateAccuracyByRegion,
  aggregateActiveUsersByDay,
  aggregateConfusionPairs,
  aggregateStructureWeakness,
  computeRetention,
} from '../../../admin/lib/analyticsAggregation';
import { buildConfusionStats, buildStudentStats } from '../rollupFromAttempts';
import {
  accuracyByRegionFromStats,
  accuracyDeltaFromDayTallies,
  activeUsersByDayFromStats,
  confusionPairsFromStats,
  mergeDayTallies,
  retentionFromStats,
  sessionMetricsFromSummaries,
  structureWeaknessFromStats,
} from '../rollupAggregation';

/**
 * The point of these tests is not that the new functions compute something —
 * it is that they compute the SAME THING the attempt-based ones did.
 *
 * CR-031 replaced an educator's read of every student's answers with counters
 * accumulated on the students' own devices. That is only an acceptable trade
 * if the dashboard still says what it said before; a privacy fix that quietly
 * changes every number on the screen is a regression wearing a badge. So most
 * of what follows rolls a set of attempts up and then asserts the rollup path
 * and the attempt path agree, rather than asserting against figures typed in
 * by hand — which would only ever prove the new code agrees with itself.
 */

const STRUCTURES = [
  { id: 'deltoid', name: 'Deltoid', region: 'shoulder-arm', category: 'muscle' },
  { id: 'biceps-brachii', name: 'Biceps brachii', region: 'shoulder-arm', category: 'muscle' },
  { id: 'gluteus-maximus', name: 'Gluteus maximus', region: 'hip-thigh', category: 'muscle' },
] as unknown as AnatomyStructure[];

function attempt(overrides: Partial<UserAttempt> & { userId: string }): UserAttempt {
  const structureId = overrides.structureId ?? 'deltoid';
  // Falls back rather than throwing: one test deliberately uses a structure
  // that is not in the seed, which is a state the real data can reach after a
  // structure is retired.
  const structure = STRUCTURES.find((s) => s.id === structureId) ?? STRUCTURES[0];
  return {
    id: `${overrides.userId}-${overrides.timestamp ?? ''}-${Math.random()}`,
    sessionId: 's1',
    questionId: 'q1',
    questionType: 'mcq',
    structureId,
    promptKind: 'identify',
    region: structure.region,
    category: structure.category,
    correct: true,
    attemptNumber: 1,
    timestamp: '2026-08-21T09:00:00.000Z',
    ...overrides,
  };
}

/** A spread of attempts across three students, both structures, several days, some wrong, some ungraded. */
function sampleAttempts(): UserAttempt[] {
  const out: UserAttempt[] = [];
  const days = ['2026-08-01', '2026-08-02', '2026-08-09', '2026-08-20'];

  for (const [i, uid] of ['s1', 's2', 's3'].entries()) {
    for (const [d, day] of days.entries()) {
      // s3 only ever appears on the first day — a student who tried it once
      // and never came back, which is what makes retention non-trivial.
      if (uid === 's3' && d > 0) continue;

      for (let n = 0; n < 4; n += 1) {
        out.push(
          attempt({
            userId: uid,
            structureId: n % 2 === 0 ? 'deltoid' : 'gluteus-maximus',
            correct: (i + d + n) % 3 !== 0,
            attemptNumber: n === 0 ? 1 : 2,
            durationMs: 1000 + n * 250 + i * 100,
            timestamp: `${day}T1${n}:00:00.000Z`,
            correctAnswer: 'Deltoid',
            selectedAnswer: (i + d + n) % 3 !== 0 ? 'Deltoid' : 'Biceps brachii',
          }),
        );
      }
    }
  }

  // Learn cards: ungraded, and the whole reason the counters split graded
  // from total. Deliberately all "correct", which is what would drag every
  // accuracy figure upward if they leaked into a denominator.
  for (let n = 0; n < 6; n += 1) {
    out.push(
      attempt({
        userId: 's1',
        structureId: 'deltoid',
        graded: false,
        correct: true,
        timestamp: `2026-08-02T2${n}:00:00.000Z`.replace('2026-08-02T26', '2026-08-02T23'),
      }),
    );
  }

  return out;
}

const statsFor = (attempts: UserAttempt[]) =>
  [...new Set(attempts.map((a) => a.userId))].map((uid) =>
    buildStudentStats(uid, `Student ${uid}`, attempts.filter((a) => a.userId === uid)),
  );

describe('rollup aggregation matches the attempt-based aggregation it replaced', () => {
  const attempts = sampleAttempts();
  const stats = statsFor(attempts);

  it('produces the same structure weakness rows', () => {
    const fromRollups = structureWeaknessFromStats(stats, STRUCTURES, 1);
    const fromAttempts = aggregateStructureWeakness(attempts, STRUCTURES, {}, 1);

    expect(fromRollups.map((r) => r.structureId)).toEqual(fromAttempts.map((r) => r.structureId));

    for (const expected of fromAttempts) {
      const actual = fromRollups.find((r) => r.structureId === expected.structureId)!;
      expect(actual.totalAttempts).toBe(expected.totalAttempts);
      expect(actual.accuracyPct).toBe(expected.accuracyPct);
      expect(actual.firstAttemptCount).toBe(expected.firstAttemptCount);
      expect(actual.firstAttemptAccuracyPct).toBe(expected.firstAttemptAccuracyPct);
      expect(actual.distinctUsers).toBe(expected.distinctUsers);
      // The attempt-based version keeps a fractional mean; a counter-based one
      // can only carry a sum and a count, so it rounds. Same number either way.
      expect(actual.meanAnswerTimeMs).toBe(Math.round(expected.meanAnswerTimeMs!));
    }
  });

  it('produces the same accuracy by region', () => {
    const fromRollups = accuracyByRegionFromStats(stats, STRUCTURES);
    const fromAttempts = aggregateAccuracyByRegion(attempts);

    expect(fromRollups.length).toBe(fromAttempts.length);
    for (const expected of fromAttempts) {
      expect(fromRollups.find((r) => r.region === expected.region)).toEqual(expected);
    }
  });

  it('produces the same active-users-by-day series', () => {
    expect(activeUsersByDayFromStats(stats)).toEqual(aggregateActiveUsersByDay(attempts));
  });

  it('produces the same retention figures', () => {
    expect(retentionFromStats(stats)).toEqual(computeRetention(attempts));
  });

  it('produces the same confusion pairs', () => {
    const fromRollups = confusionPairsFromStats(buildConfusionStats(attempts), STRUCTURES);
    const fromAttempts = aggregateConfusionPairs(attempts);

    expect(fromRollups.map(({ correctAnswer, selectedAnswer, count }) => ({ correctAnswer, selectedAnswer, count })))
      .toEqual(fromAttempts.map(({ correctAnswer, selectedAnswer, count }) => ({ correctAnswer, selectedAnswer, count })));
  });
});

describe('graded and ungraded are kept apart', () => {
  it('excludes learn cards from accuracy but keeps them in the attempt total', () => {
    const attempts = [
      attempt({ userId: 's1', correct: false, timestamp: '2026-08-01T09:00:00.000Z' }),
      attempt({ userId: 's1', correct: true, timestamp: '2026-08-01T10:00:00.000Z' }),
      // Four learn cards, all "correct" — if these counted, accuracy would be 83%.
      ...Array.from({ length: 4 }, (_, n) =>
        attempt({ userId: 's1', graded: false, correct: true, timestamp: `2026-08-01T1${n + 1}:00:00.000Z` }),
      ),
    ];

    const [stats] = statsFor(attempts);
    expect(stats.attemptsTotal).toBe(6);
    expect(stats.gradedTotal).toBe(2);
    expect(stats.gradedCorrect).toBe(1);
    expect(stats.structures.deltoid.attempts).toBe(2);
  });

  it('still counts a learn-card-only day as a day the student was active', () => {
    const [stats] = statsFor([
      attempt({ userId: 's1', graded: false, timestamp: '2026-08-05T09:00:00.000Z' }),
    ]);
    expect(stats.activeDays).toEqual(['2026-08-05']);
    // ...but contributes no point to the accuracy chart, which would otherwise
    // draw a 100% day out of cards nobody was graded on.
    expect(stats.dayTallies.size).toBe(0);
  });
});

describe('structureWeaknessFromStats', () => {
  it('drops structures below the attempt threshold', () => {
    const stats = statsFor([
      attempt({ userId: 's1', structureId: 'deltoid', timestamp: '2026-08-01T09:00:00.000Z' }),
      attempt({ userId: 's1', structureId: 'gluteus-maximus', timestamp: '2026-08-01T10:00:00.000Z' }),
      attempt({ userId: 's2', structureId: 'gluteus-maximus', timestamp: '2026-08-01T11:00:00.000Z' }),
    ]);
    expect(structureWeaknessFromStats(stats, STRUCTURES, 2).map((r) => r.structureId)).toEqual(['gluteus-maximus']);
  });

  it('counts a student once in distinctUsers however many attempts they made', () => {
    const stats = statsFor(
      Array.from({ length: 5 }, (_, n) =>
        attempt({ userId: 's1', timestamp: `2026-08-0${n + 1}T09:00:00.000Z` }),
      ),
    );
    expect(structureWeaknessFromStats(stats, STRUCTURES, 1)[0].distinctUsers).toBe(1);
  });

  it('drops a structure that is no longer in the seed rather than showing a nameless row', () => {
    const stats = statsFor([attempt({ userId: 's1', structureId: 'retired-structure' })]);
    expect(structureWeaknessFromStats(stats, STRUCTURES, 1)).toEqual([]);
  });

  it('reports no first-attempt accuracy when nothing was a first attempt', () => {
    const stats = statsFor([attempt({ userId: 's1', attemptNumber: 3 })]);
    const [row] = structureWeaknessFromStats(stats, STRUCTURES, 1);
    expect(row.firstAttemptCount).toBe(0);
    expect(row.firstAttemptAccuracyPct).toBeNull();
  });
});

describe('sessionMetricsFromSummaries', () => {
  const summary = (id: string, startedAt: string, finishedAt?: string): RevisionSessionSummary => ({
    id,
      userId: 's1',
      startedAt,
      finishedAt,
      questionTypes: [],
      totalQuestions: 0,
      correctCount: 0,
      breakdownByCategory: {
        muscle: { total: 0, correct: 0 },
        bone: { total: 0, correct: 0 },
        landmark: { total: 0, correct: 0 },
        joint: { total: 0, correct: 0 },
      },
    breakdownByRegion: {},
    missedStructureIds: [],
  });

  it('counts an abandoned session as started but not completed', () => {
    const result = sessionMetricsFromSummaries([
      summary('a', '2026-08-01T09:00:00.000Z', '2026-08-01T09:10:00.000Z'),
      summary('b', '2026-08-01T10:00:00.000Z'),
    ]);
    expect(result.totalSessions).toBe(2);
    expect(result.completionRatePct).toBe(50);
    expect(result.meanSessionLengthMinutes).toBe(10);
  });

  it('returns nulls rather than zeroes when there are no sessions', () => {
    expect(sessionMetricsFromSummaries([])).toEqual({
      meanSessionLengthMinutes: null,
      completionRatePct: null,
      totalSessions: 0,
    });
  });
});

describe('accuracyDeltaFromDayTallies', () => {
  const tallies = (entries: [string, number, number][]): Map<string, DayTally> =>
    new Map(entries.map(([day, total, correct]) => [day, { total, correct }]));

  it('is exact when the quartile boundary falls on a day edge', () => {
    // 40 attempts over 4 equal days: quartile is exactly one day.
    const result = accuracyDeltaFromDayTallies(
      tallies([
        ['2026-08-01', 10, 4],
        ['2026-08-02', 10, 6],
        ['2026-08-03', 10, 8],
        ['2026-08-04', 10, 9],
      ]),
      10,
    )!;
    expect(result.sliceSize).toBe(10);
    expect(result.firstPct).toBe(40);
    expect(result.lastPct).toBe(90);
    expect(result.deltaPts).toBe(50);
  });

  it('splits a boundary day in proportion rather than rounding to whole days', () => {
    // 48 attempts, quartile 12, but days are 20/20/8 — the first boundary
    // falls 12 attempts into a 20-attempt day scored at 50%.
    const result = accuracyDeltaFromDayTallies(
      tallies([
        ['2026-08-01', 20, 10],
        ['2026-08-02', 20, 20],
        ['2026-08-03', 8, 8],
      ]),
      10,
    )!;
    expect(result.sliceSize).toBe(12);
    expect(result.firstPct).toBe(50);
    expect(result.lastPct).toBe(100);
  });

  it('returns null rather than a headline drawn from too little work', () => {
    expect(accuracyDeltaFromDayTallies(tallies([['2026-08-01', 8, 4]]), 10)).toBeNull();
  });
});

describe('mergeDayTallies', () => {
  it('sums every student into one cohort series', () => {
    const stats = statsFor([
      attempt({ userId: 's1', correct: true, timestamp: '2026-08-01T09:00:00.000Z' }),
      attempt({ userId: 's2', correct: false, timestamp: '2026-08-01T10:00:00.000Z' }),
      attempt({ userId: 's2', correct: true, timestamp: '2026-08-02T10:00:00.000Z' }),
    ]);
    expect(mergeDayTallies(stats).get('2026-08-01')).toEqual({ total: 2, correct: 1 });
    expect(mergeDayTallies(stats).get('2026-08-02')).toEqual({ total: 1, correct: 1 });
  });
});
