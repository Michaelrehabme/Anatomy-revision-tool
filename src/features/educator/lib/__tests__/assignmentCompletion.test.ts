import { describe, it, expect } from 'vitest';
import type { UserAttempt } from '../../../anatomy-revision/types/attempt';
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

function attempt(overrides: Partial<UserAttempt> & { userId: string }): UserAttempt {
  return {
    id: `${overrides.userId}-${Math.random()}`,
    sessionId: 's1',
    questionId: 'q1',
    questionType: 'mcq',
    structureId: 'deltoid',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    correct: true,
    attemptNumber: 1,
    timestamp: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeAssignmentCompletion', () => {
  it('marks a student unattempted when they have no matching-region attempts since createdAt', () => {
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], new Map(), new Date('2026-08-25'));
    expect(result).toEqual([{ uid: 'student-1', attempted: false, attemptCount: 0, accuracyPct: null, isOverdue: false }]);
  });

  it('ignores attempts before the assignment was created', () => {
    const attempts = new Map([
      ['student-1', [attempt({ userId: 'student-1', timestamp: '2026-08-01T00:00:00.000Z' })]],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], attempts, new Date('2026-08-25'));
    expect(result[0].attempted).toBe(false);
  });

  it('ignores attempts in a different region', () => {
    const attempts = new Map([
      ['student-1', [attempt({ userId: 'student-1', region: 'hip-thigh', timestamp: '2026-08-22T00:00:00.000Z' })]],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], attempts, new Date('2026-08-25'));
    expect(result[0].attempted).toBe(false);
  });

  it('counts matching attempts and computes accuracy', () => {
    const attempts = new Map([
      [
        'student-1',
        [
          attempt({ userId: 'student-1', correct: true, timestamp: '2026-08-22T00:00:00.000Z' }),
          attempt({ userId: 'student-1', correct: false, timestamp: '2026-08-23T00:00:00.000Z' }),
          attempt({ userId: 'student-1', correct: true, timestamp: '2026-08-24T00:00:00.000Z' }),
        ],
      ],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], attempts, new Date('2026-08-25'));
    expect(result[0]).toEqual({ uid: 'student-1', attempted: true, attemptCount: 3, accuracyPct: 67, isOverdue: false });
  });

  it('flags overdue once now is past dueAt, independent of attempt status', () => {
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1'], new Map(), new Date('2026-09-05'));
    expect(result[0].isOverdue).toBe(true);
  });

  it('handles multiple students independently', () => {
    const attempts = new Map([
      ['student-1', [attempt({ userId: 'student-1', timestamp: '2026-08-22T00:00:00.000Z' })]],
    ]);
    const result = computeAssignmentCompletion(ASSIGNMENT, ['student-1', 'student-2'], attempts, new Date('2026-08-25'));
    expect(result.find((r) => r.uid === 'student-1')?.attempted).toBe(true);
    expect(result.find((r) => r.uid === 'student-2')?.attempted).toBe(false);
  });
});
