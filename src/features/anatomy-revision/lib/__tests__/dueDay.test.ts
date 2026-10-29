import { describe, it, expect } from 'vitest';
import { calendarDaysUntil, dueDateAfter, endOfLocalToday } from '../dueDay';
import { computeNextReview } from '../mastery';
import { buildReviewQueue, relativeDue } from '../reviewQueue';
import type { StructureMastery } from '../../types/attempt';

// Local times throughout: the rule is the student's own calendar day.
const evening = new Date(2026, 9, 27, 21, 30);
const nextMorning = new Date(2026, 9, 28, 7, 0);

function row(dueAt: string): StructureMastery {
  return { structureId: 'deltoid', userId: 'u', attemptsTotal: 3, attemptsCorrect: 2, lastAttemptAt: evening.toISOString(), dueAt, intervalDays: 1 };
}

describe('due by the local day (owner, 28 Oct 2026)', () => {
  it('dates a review from local midnight, not the minute it was answered', () => {
    expect(computeNextReview(undefined, 'hard', evening).dueAt).toBe(new Date(2026, 9, 28).toISOString());
    expect(dueDateAfter(evening, 4)).toBe(new Date(2026, 9, 31).toISOString());
  });

  it('puts last evening\'s answer in this morning\'s review', () => {
    const { due } = buildReviewQueue([row(computeNextReview(undefined, 'hard', evening).dueAt)], [], new Set(['deltoid']), nextMorning);
    expect(due.map((i) => i.structureId)).toEqual(['deltoid']);
  });

  it('reads a row stored to the minute by its day, so old progress follows the same rule', () => {
    const lateTonight = new Date(2026, 9, 28, 22, 0).toISOString();
    const { due } = buildReviewQueue([row(lateTonight)], [], new Set(['deltoid']), nextMorning);
    expect(due).toHaveLength(1);
    expect(endOfLocalToday(nextMorning) >= lateTonight).toBe(true);
  });

  it('says "tomorrow" by the calendar, however few hours away', () => {
    expect(calendarDaysUntil(new Date(2026, 9, 28).toISOString(), evening)).toBe(1);
    expect(relativeDue(new Date(2026, 9, 28).toISOString(), evening)).toBe('tomorrow');
    expect(relativeDue(new Date(2026, 9, 27, 8).toISOString(), evening)).toBe('today');
  });
});
