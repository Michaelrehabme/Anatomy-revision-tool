import { describe, it, expect } from 'vitest';
import {
  aggregateStructureWeakness,
  aggregateDistractors,
  aggregateConfusionPairs,
  flagQuestionHealth,
  aggregateAccuracyByRegion,
  aggregateActiveUsersByDay,
  computeRetention,
  computeSessionMetrics,
  LOW_ACCURACY_MIN_ATTEMPTS,
  NO_DISCRIMINATION_MIN_ATTEMPTS,
} from '../analyticsAggregation';
import type { AnatomyStructure } from '../../../anatomy-revision/types/structure';
import type { UserAttempt, RevisionSessionSummary } from '../../../anatomy-revision/types/attempt';

let seq = 0;

function attempt(overrides: Partial<UserAttempt> = {}): UserAttempt {
  seq += 1;
  return {
    id: `attempt-${seq}`,
    userId: 'user-1',
    sessionId: 'session-1',
    questionId: 'question-1',
    questionType: 'mcq',
    structureId: 'structure-1',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    correct: true,
    attemptNumber: 1,
    timestamp: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function structure(overrides: Partial<AnatomyStructure> & { id: string; name: string }): AnatomyStructure {
  return {
    region: 'shoulder-arm',
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: true },
    difficulty: 'medium',
    tags: [],
    category: 'muscle',
    origin: [],
    insertion: [],
    nerve: [],
    actions: [],
    actionText: '',
    ...overrides,
  } as AnatomyStructure;
}

describe('aggregateStructureWeakness', () => {
  const structures = [
    structure({ id: 'supraspinatus', name: 'Supraspinatus' }),
    structure({ id: 'iliacus', name: 'Iliacus', region: 'hip-thigh' }),
  ];

  it('computes total attempts, accuracy, distinct users, and mean answer time', () => {
    const attempts = [
      attempt({ structureId: 'supraspinatus', userId: 'u1', correct: true, durationMs: 1000, attemptNumber: 1 }),
      attempt({ structureId: 'supraspinatus', userId: 'u1', correct: false, durationMs: 2000, attemptNumber: 2 }),
      attempt({ structureId: 'supraspinatus', userId: 'u2', correct: true, durationMs: 3000, attemptNumber: 1 }),
      attempt({ structureId: 'supraspinatus', userId: 'u3', correct: true, durationMs: 3000, attemptNumber: 1 }),
      attempt({ structureId: 'supraspinatus', userId: 'u3', correct: true, durationMs: 3000, attemptNumber: 2 }),
    ];

    const rows = aggregateStructureWeakness(attempts, structures, {}, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      structureId: 'supraspinatus',
      name: 'Supraspinatus',
      totalAttempts: 5,
      accuracyPct: 80,
      distinctUsers: 3,
      meanAnswerTimeMs: 2400,
    });
  });

  it('distinguishes a structure being learned (low first-attempt, high overall accuracy) from one being forgotten (the reverse)', () => {
    const learning = Array.from({ length: 10 }, (_, i) =>
      attempt({
        structureId: 'supraspinatus',
        userId: `u${i}`,
        attemptNumber: 1,
        correct: i < 2, // 20% first-attempt accuracy
      }),
    ).concat(
      Array.from({ length: 10 }, (_, i) =>
        attempt({ structureId: 'supraspinatus', userId: `u${i}`, attemptNumber: 2, correct: i < 9 }), // 90% on repeat
      ),
    );

    const forgetting = Array.from({ length: 10 }, (_, i) =>
      attempt({ structureId: 'iliacus', userId: `v${i}`, attemptNumber: 1, correct: i < 9 }), // 90% first-attempt
    ).concat(
      Array.from({ length: 10 }, (_, i) =>
        attempt({ structureId: 'iliacus', userId: `v${i}`, attemptNumber: 2, correct: i < 2 }), // 20% on repeat
      ),
    );

    const rows = aggregateStructureWeakness([...learning, ...forgetting], structures, {}, 5);
    const learningRow = rows.find((r) => r.structureId === 'supraspinatus')!;
    const forgettingRow = rows.find((r) => r.structureId === 'iliacus')!;

    expect(learningRow.firstAttemptAccuracyPct).toBe(20);
    expect(learningRow.accuracyPct).toBeGreaterThan(learningRow.firstAttemptAccuracyPct!);

    expect(forgettingRow.firstAttemptAccuracyPct).toBe(90);
    expect(forgettingRow.accuracyPct).toBeLessThan(forgettingRow.firstAttemptAccuracyPct!);
  });

  it('excludes structures below the minimum attempt threshold', () => {
    const attempts = [
      attempt({ structureId: 'supraspinatus', correct: false }),
      attempt({ structureId: 'supraspinatus', correct: false }),
    ];
    expect(aggregateStructureWeakness(attempts, structures, {}, 5)).toHaveLength(0);
    expect(aggregateStructureWeakness(attempts, structures, {}, 2)).toHaveLength(1);
  });

  it('filters by region, category, and question type', () => {
    const attempts = [
      ...Array.from({ length: 5 }, () => attempt({ structureId: 'supraspinatus', region: 'shoulder-arm', questionType: 'mcq' })),
      ...Array.from({ length: 5 }, () => attempt({ structureId: 'iliacus', region: 'hip-thigh', questionType: 'flashcard' })),
    ];

    expect(aggregateStructureWeakness(attempts, structures, { region: 'hip-thigh' }, 5).map((r) => r.structureId)).toEqual([
      'iliacus',
    ]);
    expect(aggregateStructureWeakness(attempts, structures, { questionType: 'mcq' }, 5).map((r) => r.structureId)).toEqual([
      'supraspinatus',
    ]);
  });

  it('sorts worst accuracy first', () => {
    const attempts = [
      ...Array.from({ length: 5 }, () => attempt({ structureId: 'supraspinatus', correct: true })),
      ...Array.from({ length: 5 }, () => attempt({ structureId: 'iliacus', correct: false })),
    ];
    const rows = aggregateStructureWeakness(attempts, structures, {}, 5);
    expect(rows.map((r) => r.structureId)).toEqual(['iliacus', 'supraspinatus']);
  });
});

describe('aggregateDistractors', () => {
  const structures = [structure({ id: 'supraspinatus', name: 'Supraspinatus' })];

  it('groups wrong answers by frequency and ranks the top ones', () => {
    const attempts = [
      ...Array.from({ length: 5 }, () =>
        attempt({ questionId: 'q1', structureId: 'supraspinatus', correct: false, selectedAnswer: 'Infraspinatus', correctAnswer: 'Supraspinatus' }),
      ),
      ...Array.from({ length: 2 }, () =>
        attempt({ questionId: 'q1', structureId: 'supraspinatus', correct: false, selectedAnswer: 'Teres minor', correctAnswer: 'Supraspinatus' }),
      ),
      attempt({ questionId: 'q1', structureId: 'supraspinatus', correct: true, correctAnswer: 'Supraspinatus' }),
    ];

    const [summary] = aggregateDistractors(attempts, structures);
    expect(summary.questionId).toBe('q1');
    expect(summary.totalWrong).toBe(7);
    expect(summary.totalAttempts).toBe(8);
    expect(summary.topWrongAnswers[0]).toEqual({ answer: 'Infraspinatus', count: 5 });
    expect(summary.topWrongAnswers[1]).toEqual({ answer: 'Teres minor', count: 2 });
  });

  it('excludes questions with no wrong answers', () => {
    const attempts = [attempt({ questionId: 'q1', correct: true }), attempt({ questionId: 'q1', correct: true })];
    expect(aggregateDistractors(attempts, structures)).toHaveLength(0);
  });

  it('orders questions by total wrong attempts, highest first', () => {
    const attempts = [
      ...Array.from({ length: 3 }, () => attempt({ questionId: 'q-small', correct: false, selectedAnswer: 'X' })),
      ...Array.from({ length: 9 }, () => attempt({ questionId: 'q-big', correct: false, selectedAnswer: 'Y' })),
    ];
    const summaries = aggregateDistractors(attempts, structures);
    expect(summaries.map((s) => s.questionId)).toEqual(['q-big', 'q-small']);
  });
});

describe('aggregateConfusionPairs', () => {
  it('ranks a synthetic dataset where supraspinatus is wrongly answered as infraspinatus 38 times at the top', () => {
    const attempts = [
      ...Array.from({ length: 38 }, () =>
        attempt({ structureId: 'supraspinatus', correct: false, correctAnswer: 'Supraspinatus', selectedAnswer: 'Infraspinatus' }),
      ),
      ...Array.from({ length: 12 }, () =>
        attempt({ structureId: 'iliacus', correct: false, correctAnswer: 'Iliacus', selectedAnswer: 'Psoas major' }),
      ),
      ...Array.from({ length: 5 }, () =>
        attempt({ structureId: 'gluteus-medius', correct: false, correctAnswer: 'Gluteus medius', selectedAnswer: 'Gluteus minimus' }),
      ),
    ];

    const pairs = aggregateConfusionPairs(attempts);

    expect(pairs[0]).toMatchObject({ correctAnswer: 'Supraspinatus', selectedAnswer: 'Infraspinatus', count: 38 });
    expect(pairs[1]).toMatchObject({ correctAnswer: 'Iliacus', selectedAnswer: 'Psoas major', count: 12 });
    expect(pairs[2]).toMatchObject({ correctAnswer: 'Gluteus medius', selectedAnswer: 'Gluteus minimus', count: 5 });
    expect(pairs).toHaveLength(3);
  });

  it('ignores correct attempts and attempts missing either answer field', () => {
    const attempts = [
      attempt({ correct: true, correctAnswer: 'A', selectedAnswer: 'B' }),
      attempt({ correct: false, correctAnswer: 'A', selectedAnswer: undefined }),
      attempt({ correct: false, correctAnswer: undefined, selectedAnswer: 'B' }),
    ];
    expect(aggregateConfusionPairs(attempts)).toHaveLength(0);
  });
});

describe('flagQuestionHealth', () => {
  const structures = [structure({ id: 'supraspinatus', name: 'Supraspinatus' })];

  it('flags a question below 25% accuracy with 10+ attempts as low-accuracy', () => {
    const attempts = Array.from({ length: LOW_ACCURACY_MIN_ATTEMPTS }, (_, i) =>
      attempt({ questionId: 'q-bad', correct: i === 0 }),
    );
    const flags = flagQuestionHealth(attempts, structures);
    expect(flags.some((f) => f.questionId === 'q-bad' && f.flagType === 'low-accuracy')).toBe(true);
  });

  it('does not flag low accuracy below the attempt threshold', () => {
    const attempts = Array.from({ length: LOW_ACCURACY_MIN_ATTEMPTS - 1 }, () => attempt({ questionId: 'q-bad', correct: false }));
    const flags = flagQuestionHealth(attempts, structures);
    expect(flags.some((f) => f.questionId === 'q-bad')).toBe(false);
  });

  it('flags a question above 98% accuracy with 20+ attempts as no-discrimination', () => {
    const attempts = Array.from({ length: NO_DISCRIMINATION_MIN_ATTEMPTS }, () => attempt({ questionId: 'q-easy', correct: true }));
    const flags = flagQuestionHealth(attempts, structures);
    expect(flags.some((f) => f.questionId === 'q-easy' && f.flagType === 'no-discrimination')).toBe(true);
  });

  it('does not flag no-discrimination below the attempt threshold', () => {
    const attempts = Array.from({ length: NO_DISCRIMINATION_MIN_ATTEMPTS - 1 }, () => attempt({ questionId: 'q-easy', correct: true }));
    const flags = flagQuestionHealth(attempts, structures);
    expect(flags.some((f) => f.questionId === 'q-easy')).toBe(false);
  });

  it('flags high-accuracy questions whose mean answer time is in the top decile', () => {
    // 9 fast, high-accuracy questions plus one dramatically slower one -> a clean gap
    // either side of the 90th-percentile cutoff among the 10 candidate questions.
    const fastQuestions = Array.from({ length: 9 }, (_, qi) =>
      Array.from({ length: 10 }, () => attempt({ questionId: `q-fast-${qi}`, correct: true, durationMs: 2000 })),
    ).flat();
    const slowQuestion = Array.from({ length: 10 }, () => attempt({ questionId: 'q-slow', correct: true, durationMs: 60000 }));

    const flags = flagQuestionHealth([...fastQuestions, ...slowQuestion], structures);
    expect(flags.some((f) => f.questionId === 'q-slow' && f.flagType === 'slow-despite-accurate')).toBe(true);
    expect(flags.some((f) => f.questionId === 'q-fast-0' && f.flagType === 'slow-despite-accurate')).toBe(false);
  });
});

describe('aggregateAccuracyByRegion', () => {
  it('sums totals and correct counts per region', () => {
    const attempts = [
      attempt({ region: 'shoulder-arm', correct: true }),
      attempt({ region: 'shoulder-arm', correct: false }),
      attempt({ region: 'hip-thigh', correct: true }),
    ];
    const bars = aggregateAccuracyByRegion(attempts);
    expect(bars.find((b) => b.region === 'shoulder-arm')).toMatchObject({ total: 2, correct: 1, accuracyPct: 50 });
    expect(bars.find((b) => b.region === 'hip-thigh')).toMatchObject({ total: 1, correct: 1, accuracyPct: 100 });
  });
});

describe('aggregateActiveUsersByDay', () => {
  it('counts distinct users per calendar day', () => {
    const attempts = [
      attempt({ userId: 'u1', timestamp: '2026-08-01T09:00:00.000Z' }),
      attempt({ userId: 'u2', timestamp: '2026-08-01T15:00:00.000Z' }),
      attempt({ userId: 'u1', timestamp: '2026-08-01T20:00:00.000Z' }),
      attempt({ userId: 'u1', timestamp: '2026-08-02T09:00:00.000Z' }),
    ];
    const points = aggregateActiveUsersByDay(attempts);
    expect(points).toEqual([
      { date: '2026-08-01', activeUsers: 2 },
      { date: '2026-08-02', activeUsers: 1 },
    ]);
  });
});

describe('computeRetention', () => {
  it('computes day-1 retention only over users eligible to have returned', () => {
    const attempts = [
      // u1: active day 0 and day 1 -> retained at day 1.
      attempt({ userId: 'u1', timestamp: '2026-08-01T00:00:00.000Z' }),
      attempt({ userId: 'u1', timestamp: '2026-08-02T00:00:00.000Z' }),
      // u2: active day 0 only, dataset extends to day 5 -> eligible, not retained.
      attempt({ userId: 'u2', timestamp: '2026-08-01T00:00:00.000Z' }),
      // u3: first active on the dataset's last day -> not eligible for day-1 yet.
      attempt({ userId: 'u3', timestamp: '2026-08-06T00:00:00.000Z' }),
    ];
    const retention = computeRetention(attempts);
    // eligible: u1, u2 (u3 not eligible); retained: u1 only.
    expect(retention.day1Pct).toBe(50);
  });

  it('returns null for a window with no eligible users', () => {
    const attempts = [attempt({ userId: 'u1', timestamp: '2026-08-01T00:00:00.000Z' })];
    expect(computeRetention(attempts).day30Pct).toBeNull();
  });
});

describe('computeSessionMetrics', () => {
  it('computes completion rate and mean session length from finished session summaries', () => {
    const attempts = [
      attempt({ sessionId: 'session-a' }),
      attempt({ sessionId: 'session-b' }),
      attempt({ sessionId: 'session-c' }), // no summary saved -> abandoned
    ];
    const summaries: RevisionSessionSummary[] = [
      {
        id: 'session-a',
        userId: 'u1',
        startedAt: '2026-08-01T10:00:00.000Z',
        finishedAt: '2026-08-01T10:10:00.000Z',
        questionTypes: ['mcq'],
        totalQuestions: 10,
        correctCount: 8,
        breakdownByCategory: { muscle: { total: 10, correct: 8 }, bone: { total: 0, correct: 0 }, landmark: { total: 0, correct: 0 }, joint: { total: 0, correct: 0 } },
        breakdownByRegion: {},
        missedStructureIds: [],
      },
      {
        id: 'session-b',
        userId: 'u1',
        startedAt: '2026-08-01T11:00:00.000Z',
        finishedAt: '2026-08-01T11:20:00.000Z',
        questionTypes: ['mcq'],
        totalQuestions: 10,
        correctCount: 9,
        breakdownByCategory: { muscle: { total: 10, correct: 9 }, bone: { total: 0, correct: 0 }, landmark: { total: 0, correct: 0 }, joint: { total: 0, correct: 0 } },
        breakdownByRegion: {},
        missedStructureIds: [],
      },
    ];

    const result = computeSessionMetrics(attempts, summaries);
    expect(result.totalSessions).toBe(3);
    expect(result.completionRatePct).toBe(67); // 2 of 3 sessions completed
    expect(result.meanSessionLengthMinutes).toBe(15); // mean of 10 and 20 minutes
  });
});
