import { describe, it, expect } from 'vitest';
import { LADDER_CONFIG, hintsForRung, markSeen, promoteOrDemote, questionTypeForRung, rungFor } from '../ladder';
import type { StructureMastery } from '../../types/attempt';

function row(overrides: Partial<StructureMastery> = {}): StructureMastery {
  return {
    structureId: 'deltoid',
    userId: 'user-1',
    attemptsTotal: 0,
    attemptsCorrect: 0,
    lastAttemptAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

/** Feeds `answers` through the ladder one at a time, the way the session does. */
function climb(start: StructureMastery | undefined, answers: boolean[]): StructureMastery {
  let m: StructureMastery = start ?? row();
  for (const correct of answers) {
    const next = promoteOrDemote(start === undefined && m === start ? undefined : m, correct);
    m = { ...m, ...next, attemptsTotal: m.attemptsTotal + 1, attemptsCorrect: m.attemptsCorrect + (correct ? 1 : 0) };
  }
  return m;
}

describe('rungFor', () => {
  it('starts an unseen structure on the flashcard rung and a seen one on mcq', () => {
    expect(rungFor(undefined)).toBe('flashcard');
    expect(rungFor(markSeen('deltoid', 'user-1'))).toBe('mcq');
  });

  it('places a row written before the ladder by its accuracy', () => {
    expect(rungFor(row({ attemptsTotal: 10, attemptsCorrect: 3 }))).toBe('mcq');
    expect(rungFor(row({ attemptsTotal: 10, attemptsCorrect: 7 }))).toBe('typed-hinted');
    expect(rungFor(row({ attemptsTotal: 10, attemptsCorrect: 9 }))).toBe('typed-bare');
  });

  it('prefers a stored rung over the accuracy heuristic', () => {
    expect(rungFor(row({ attemptsTotal: 10, attemptsCorrect: 9, rung: 'mcq' }))).toBe('mcq');
  });
});

describe('promoteOrDemote', () => {
  it('climbs a rung after three correct in a row, then again after three more', () => {
    const afterThree = climb(undefined, [true, true, true]);
    expect(afterThree.rung).toBe('typed-hinted');
    expect(afterThree.rungStreak).toBe(0);
    const afterSix = climb(afterThree, [true, true, true]);
    expect(afterSix.rung).toBe('typed-bare');
  });

  it('will not climb on a streak when overall accuracy is poor', () => {
    const poor = row({ attemptsTotal: 12, attemptsCorrect: 2, rung: 'mcq', rungStreak: 0 });
    const after = climb(poor, [true, true, true]);
    expect(after.rung).toBe('mcq');
    expect(after.rungStreak).toBe(LADDER_CONFIG.promotionStreak);
  });

  it('drops a rung after two misses, never below mcq, and a demotion resets the streak', () => {
    const typed = row({ attemptsTotal: 6, attemptsCorrect: 6, rung: 'typed-bare', rungStreak: 2 });
    const oneMiss = climb(typed, [false]);
    expect(oneMiss.rung).toBe('typed-bare');
    expect(oneMiss.rungStreak).toBe(0);
    const twoMisses = climb(typed, [false, false]);
    expect(twoMisses.rung).toBe('typed-hinted');
    expect(twoMisses.rungMissStreak).toBe(0);
    const grounded = climb(twoMisses, [false, false, false, false]);
    expect(grounded.rung).toBe('mcq');
    expect(climb(grounded, [false, false]).rung).toBe('mcq');
  });

  it('never leaves a graded structure on the flashcard rung', () => {
    expect(promoteOrDemote(undefined, false).rung).toBe('mcq');
  });
});

describe('questionTypeForRung', () => {
  const all = ['flashcard', 'mcq', 'identify-typed', 'locate'] as const;
  it('asks the format of the rung when it was requested', () => {
    expect(questionTypeForRung('flashcard', all)).toBe('flashcard');
    expect(questionTypeForRung('mcq', all)).toBe('mcq');
    expect(questionTypeForRung('typed-hinted', all)).toBe('identify-typed');
    expect(questionTypeForRung('typed-bare', all)).toBe('identify-typed');
  });

  it('falls back to something requested rather than nothing', () => {
    expect(questionTypeForRung('typed-bare', ['mcq'])).toBe('mcq');
    expect(questionTypeForRung('flashcard', ['identify-typed'])).toBe('identify-typed');
    expect(questionTypeForRung('mcq', ['locate'])).toBeNull();
  });
});

describe('hintsForRung', () => {
  it('drops the hints only on the top rung', () => {
    expect(hintsForRung('typed-hinted')).toBe('full');
    expect(hintsForRung('typed-bare')).toBe('none');
  });
});
