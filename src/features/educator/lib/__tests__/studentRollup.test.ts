import { describe, it, expect } from 'vitest';
import { buildStudentRollup, parseStudentRollup, replayMastery } from '../studentRollup';
import { masteryMixByRegion, sessionMetricsFromRollups } from '../rollupAggregation';
import type { StudentStatsDoc } from '../../data/cohortRollups';
import type { RevisionSessionSummary, StructureMastery, UserAttempt } from '../../../anatomy-revision/types/attempt';
import type { AnatomyStructure } from '../../../anatomy-revision/types/structure';

const NOW = new Date('2026-09-28T12:00:00.000Z');

function summary(overrides: Partial<RevisionSessionSummary>): RevisionSessionSummary {
  return {
    id: 's',
    userId: 'u',
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: '2026-09-20T10:10:00.000Z',
    totalQuestions: 10,
    correctCount: 8,
    breakdownByCategory: {},
    breakdownByRegion: {},
    missedStructureIds: ['deltoid'],
    ...overrides,
  } as RevisionSessionSummary;
}

function row(structureId: string, overrides: Partial<StructureMastery> = {}): StructureMastery {
  return { structureId, userId: 'u', attemptsTotal: 5, attemptsCorrect: 5, lastAttemptAt: '2026-09-27T09:00:00.000Z', ...overrides };
}

describe('buildStudentRollup', () => {
  it('keeps the level of every met structure and nothing for unmet ones', () => {
    const rollup = buildStudentRollup(
      [row('deltoid', { rung: 'typed-bare', rungStreak: 3 }), row('supraspinatus', { rung: 'mcq' })],
      [],
      NOW,
    );
    expect(rollup.levels).toEqual({ deltoid: 'master', supraspinatus: 'novice' });
  });

  it('sums sessions, keeps the best assignment score, and carries no time finer than a day', () => {
    const rollup = buildStudentRollup(
      [],
      [
        summary({ id: 'a', assignmentId: 'hw1', correctCount: 6 }),
        summary({ id: 'b', assignmentId: 'hw1', correctCount: 9, startedAt: '2026-09-21T10:00:00.000Z', finishedAt: '2026-09-21T10:20:00.000Z' }),
        summary({ id: 'c', finishedAt: undefined, startedAt: '2026-09-21T18:00:00.000Z' }),
      ],
      NOW,
    );
    expect(rollup.sessions).toEqual({ total: 3, finished: 2, finishedMinutes: 30 });
    expect(rollup.assignments.hw1).toEqual({ taken: 2, questions: 20, correct: 15, bestPct: 90 });
    expect(rollup.sessionDays).toEqual(['2026-09-20', '2026-09-21']);
    const serialised = JSON.stringify(rollup);
    expect(serialised).not.toMatch(/T\d\d:/);
    expect(serialised).not.toContain('deltoid');
  });

  it('leaves out everything from before the student joined the class', () => {
    const rollup = buildStudentRollup(
      [
        row('deltoid', { rung: 'typed-bare', lastAttemptAt: '2026-09-10T09:00:00.000Z' }),
        row('supraspinatus', { rung: 'mcq', lastAttemptAt: '2026-09-26T09:00:00.000Z' }),
      ],
      [summary({ id: 'old', startedAt: '2026-09-10T10:00:00.000Z', finishedAt: '2026-09-10T10:05:00.000Z' }), summary({ id: 'new', startedAt: '2026-09-26T10:00:00.000Z', finishedAt: '2026-09-26T10:05:00.000Z' })],
      NOW,
      '2026-09-25T00:00:00.000Z',
    );
    expect(rollup.levels).toEqual({ supraspinatus: 'novice' });
    expect(rollup.sessions.total).toBe(1);
    expect(rollup.sessionDays).toEqual(['2026-09-26']);
  });

  it('survives a round trip through storage, and reads garbage as empty', () => {
    const rollup = buildStudentRollup([row('deltoid', { rung: 'typed-hinted' })], [summary({})], NOW);
    expect(parseStudentRollup(JSON.parse(JSON.stringify(rollup)))).toEqual(rollup);
    expect(parseStudentRollup(undefined)).toBeUndefined();
    expect(parseStudentRollup({ levels: { deltoid: 'wizard' }, sessions: 'x' })?.levels).toEqual({});
  });
});

describe('replayMastery', () => {
  it('climbs a structure through the ladder from its attempt log', () => {
    const attempt = (i: number, questionType: UserAttempt['questionType'], hints?: 'full' | 'none'): UserAttempt =>
      ({
        id: `a${i}`,
        userId: 'u',
        sessionId: 's',
        questionId: 'q',
        questionType,
        structureId: 'deltoid',
        promptKind: 'identify',
        region: 'shoulder-arm',
        category: 'muscle',
        correct: true,
        attemptNumber: i,
        timestamp: `2026-09-2${Math.floor(i / 5)}T10:0${i % 5}:00.000Z`,
        hints,
      }) as UserAttempt;
    const log = [
      ...[0, 1, 2].map((i) => attempt(i, 'mcq')),
      ...[3, 4, 5].map((i) => attempt(i, 'identify-typed', 'full')),
      ...[6, 7, 8].map((i) => attempt(i, 'identify-typed', 'none')),
    ];
    const [deltoid] = replayMastery('u', log);
    expect(buildStudentRollup([deltoid], [], NOW).levels.deltoid).toBe('master');
  });
});

describe('class aggregation from rollups', () => {
  const structures = [
    { id: 'deltoid', region: 'shoulder-arm' },
    { id: 'supraspinatus', region: 'shoulder-arm' },
    { id: 'gluteus-maximus', region: 'hip-thigh' },
  ] as AnatomyStructure[];

  const stat = (uid: string, rollup?: ReturnType<typeof buildStudentRollup>) =>
    ({ uid, rollup }) as unknown as StudentStatsDoc;

  it('counts every student-structure pair, and leaves out students with no rollup yet', () => {
    const a = buildStudentRollup([row('deltoid', { rung: 'typed-bare', rungStreak: 3 })], [], NOW);
    const b = buildStudentRollup([row('deltoid', { rung: 'mcq' }), row('gluteus-maximus', { rung: 'typed-hinted' })], [], NOW);
    const { regions, studentsReporting } = masteryMixByRegion([stat('a', a), stat('b', b), stat('c')], structures);
    expect(studentsReporting).toBe(2);
    const shoulder = regions.find((r) => r.region === 'shoulder-arm')!;
    expect(shoulder.levels).toMatchObject({ master: 1, novice: 1, unmet: 2 });
    const hip = regions.find((r) => r.region === 'hip-thigh')!;
    expect(hip.levels).toMatchObject({ intermediate: 1, unmet: 1 });
  });

  it('gives the session figures the summaries used to', () => {
    const a = buildStudentRollup([], [summary({}), summary({ finishedAt: undefined })], NOW);
    expect(sessionMetricsFromRollups([stat('a', a), stat('c')])).toEqual({
      totalSessions: 2,
      completionRatePct: 50,
      meanSessionLengthMinutes: 10,
    });
  });
});
