import { describe, it, expect } from 'vitest';
import type { RevisionSessionSummary } from '../../../anatomy-revision/types/attempt';
import type { Assignment } from '../../types/cohort';
import { computeAssignmentCompletion } from '../assignmentCompletion';

const ASSIGNMENT: Assignment = {
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
      { uid: 'student-1', attempted: false, attemptCount: 0, accuracyPct: null, isOverdue: false },
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
