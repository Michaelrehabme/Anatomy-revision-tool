import { describe, it, expect } from 'vitest';
import type { RevisionSessionSummary } from '../../../anatomy-revision/types/attempt';
import type { RegionAssignment, ScopedAssignment } from '../../types/cohort';
import { computeAssignmentCompletion, sessionScorePct } from '../assignmentCompletion';

const ASSIGNMENT: RegionAssignment = {
  id: 'a1',
  cohortId: 'c1',
  region: 'shoulder-arm',
  title: 'Rotator cuff review',
  dueAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-08-20T00:00:00.000Z',
  createdBy: 'educator-1',
};

/**
 * Completion is read off session summaries rather than attempt rows since
 * CR-031 — an educator no longer reads attempts at all. The behaviour under
 * test is unchanged: only work in the assigned region, only since the
 * assignment was set.
 */
function session(
  userId: string,
  startedAt: string,
  breakdownByRegion: RevisionSessionSummary['breakdownByRegion'],
): RevisionSessionSummary {
  return {
    id: `${userId}-${startedAt}`,
    userId,
    startedAt,
    finishedAt: startedAt,
    questionTypes: ['mcq'],
    totalQuestions: 0,
    correctCount: 0,
    breakdownByCategory: {
      muscle: { total: 0, correct: 0 },
      bone: { total: 0, correct: 0 },
      landmark: { total: 0, correct: 0 },
      joint: { total: 0, correct: 0 },
    },
    breakdownByRegion,
    missedStructureIds: [],
  };
}

describe('computeAssignmentCompletion', () => {
  it('marks a student unattempted when they have no matching-region work since createdAt', () => {
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], new Map(), new Date('2026-08-25'));
    expect(result).toEqual([
      {
        uid: 'student-1',
        attempted: false,
        attemptCount: 0,
        accuracyPct: null,
        attemptsTaken: 0,
        bestScorePct: null,
        completed: null,
        isOverdue: false,
      },
    ]);
  });

  it('ignores sessions started before the assignment was created', () => {
    const summaries = new Map([
      ['student-1', [session('student-1', '2026-08-01T00:00:00.000Z', { 'shoulder-arm': { total: 5, correct: 4 } })]],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], summaries, new Date('2026-08-25'));
    expect(result[0].attempted).toBe(false);
  });

  it('ignores work in a different region', () => {
    const summaries = new Map([
      ['student-1', [session('student-1', '2026-08-22T00:00:00.000Z', { 'hip-thigh': { total: 5, correct: 4 } })]],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], summaries, new Date('2026-08-25'));
    expect(result[0].attempted).toBe(false);
  });

  it('counts matching work across sessions and computes accuracy', () => {
    const summaries = new Map([
      [
        'student-1',
        [
          session('student-1', '2026-08-22T00:00:00.000Z', { 'shoulder-arm': { total: 1, correct: 1 } }),
          session('student-1', '2026-08-23T00:00:00.000Z', { 'shoulder-arm': { total: 1, correct: 0 } }),
          session('student-1', '2026-08-24T00:00:00.000Z', { 'shoulder-arm': { total: 1, correct: 1 } }),
        ],
      ],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], summaries, new Date('2026-08-25'));
    expect(result[0]).toEqual({
      uid: 'student-1',
      attempted: true,
      attemptCount: 3,
      accuracyPct: 67,
      attemptsTaken: 0,
      bestScorePct: null,
      completed: null,
      isOverdue: false,
    });
  });

  it('counts only the assigned region from a session that spanned several', () => {
    const summaries = new Map([
      [
        'student-1',
        [
          session('student-1', '2026-08-22T00:00:00.000Z', {
            'shoulder-arm': { total: 2, correct: 1 },
            'hip-thigh': { total: 8, correct: 8 },
          }),
        ],
      ],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], summaries, new Date('2026-08-25'));
    expect(result[0].attemptCount).toBe(2);
    expect(result[0].accuracyPct).toBe(50);
  });

  it('flags overdue once now is past dueAt, independent of attempt status', () => {
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], new Map(), new Date('2026-09-05'));
    expect(result[0].isOverdue).toBe(true);
  });

  it('handles multiple students independently', () => {
    const summaries = new Map([
      ['student-1', [session('student-1', '2026-08-22T00:00:00.000Z', { 'shoulder-arm': { total: 1, correct: 1 } })]],
    ]);
    const result = computeAssignmentCompletion(
      ASSIGNMENT,
      ['student-1', 'student-2'],
      summaries,
      new Date('2026-08-25'),
    );
    expect(result.find((r) => r.uid === 'student-1')?.attempted).toBe(true);
    expect(result.find((r) => r.uid === 'student-2')?.attempted).toBe(false);
  });
});

const SCOPED: ScopedAssignment = {
  id: 'a2',
  cohortId: 'c1',
  title: 'Hip flexors',
  scope: { areas: ['hip'], category: 'muscle', groups: ['hip-flexors'] },
  questionTypes: ['mcq'],
  questionCount: 20,
  targetAccuracyPct: 70,
  dueAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-08-20T00:00:00.000Z',
  createdBy: 'educator-1',
};

function attempt(
  userId: string,
  startedAt: string,
  correctCount: number,
  overrides: Partial<RevisionSessionSummary> = {},
): RevisionSessionSummary {
  return {
    ...session(userId, startedAt, { 'hip-thigh': { total: 20, correct: correctCount } }),
    totalQuestions: 20,
    correctCount,
    assignmentId: SCOPED.id,
    ...overrides,
  };
}

describe('computeAssignmentCompletion — scoped assignments', () => {
  const now = new Date('2026-08-25');

  it('is complete once one finished attempt reaches the pass mark, and the best attempt counts', () => {
    const summaries = new Map([
      [
        'student-1',
        [
          attempt('student-1', '2026-08-21T00:00:00.000Z', 11),
          attempt('student-1', '2026-08-22T00:00:00.000Z', 15),
          attempt('student-1', '2026-08-23T00:00:00.000Z', 13),
        ],
      ],
    ]);
    expect(computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now)[0]).toEqual({
      uid: 'student-1',
      attempted: true,
      attemptCount: 60,
      accuracyPct: 65,
      attemptsTaken: 3,
      bestScorePct: 75,
      completed: true,
      isOverdue: false,
    });
  });

  it('treats a score exactly on the pass mark as a pass', () => {
    const summaries = new Map([['student-1', [attempt('student-1', '2026-08-21T00:00:00.000Z', 14)]]]);
    expect(computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now)[0].completed).toBe(true);
  });

  it('is attempted but not complete while every attempt is below the pass mark', () => {
    const summaries = new Map([['student-1', [attempt('student-1', '2026-08-21T00:00:00.000Z', 13)]]]);
    const [status] = computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now);
    expect(status.attempted).toBe(true);
    expect(status.completed).toBe(false);
    expect(status.bestScorePct).toBe(65);
  });

  it('ignores free revision in the same area — only sessions stamped with the assignment count', () => {
    const summaries = new Map([
      ['student-1', [attempt('student-1', '2026-08-21T00:00:00.000Z', 20, { assignmentId: undefined })]],
    ]);
    const [status] = computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now);
    expect(status.attempted).toBe(false);
    expect(status.completed).toBe(false);
  });

  it('ignores attempts at a different assignment', () => {
    const summaries = new Map([
      ['student-1', [attempt('student-1', '2026-08-21T00:00:00.000Z', 20, { assignmentId: 'other' })]],
    ]);
    expect(computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now)[0].attempted).toBe(false);
  });

  it('ignores an abandoned attempt, however well it was going', () => {
    const summaries = new Map([
      ['student-1', [attempt('student-1', '2026-08-21T00:00:00.000Z', 18, { finishedAt: undefined })]],
    ]);
    expect(computeAssignmentCompletion(SCOPED, ['student-1'], summaries, now)[0].attemptsTaken).toBe(0);
  });
});

describe('sessionScorePct', () => {
  it('scores out of every question asked, so unanswered questions count against the attempt', () => {
    // An exam that timed out after 5 answered, all correct, out of 20.
    expect(sessionScorePct(attempt('s', '2026-08-21T00:00:00.000Z', 5))).toBe(25);
  });

  it('is null for a session with no graded questions', () => {
    expect(sessionScorePct(attempt('s', '2026-08-21T00:00:00.000Z', 0, { totalQuestions: 0 }))).toBeNull();
  });
});
