import { describe, it, expect } from 'vitest';
import { LADDER_CONFIG, hintsForRung, markSeen, promoteOrDemote, questionTypeForRung, rungFor, rungOfQuestion } from '../ladder';
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

  it('will not read one lucky answer as earned accuracy', () => {
    // The bug this guards: a pre-ladder row with a single correct answer is
    // 100% accurate, which used to place it on typed-bare — a no-hint typed
    // question on a structure seen once.
    expect(rungFor(row({ attemptsTotal: 1, attemptsCorrect: 1 }))).toBe('mcq');
    expect(rungFor(row({ attemptsTotal: 2, attemptsCorrect: 2 }))).toBe('mcq');
    expect(rungFor(row({ attemptsTotal: 5, attemptsCorrect: 5 }))).toBe('typed-hinted');
    expect(rungFor(row({ attemptsTotal: 6, attemptsCorrect: 6 }))).toBe('typed-bare');
  });

  it('asks for as many answers as climbing would have cost', () => {
    const { legacyMinAttempts, promotionStreak } = LADDER_CONFIG;
    expect(legacyMinAttempts['typed-hinted']).toBe(promotionStreak);
    expect(legacyMinAttempts['typed-bare']).toBe(promotionStreak * 2);
  });
});

describe('rungOfQuestion', () => {
  it('reads the demand off the question, hints included', () => {
    expect(rungOfQuestion('flashcard')).toBe('flashcard');
    expect(rungOfQuestion('mcq')).toBe('mcq');
    expect(rungOfQuestion('fill-blank')).toBe('typed-hinted');
    expect(rungOfQuestion('identify-typed', 'full')).toBe('typed-hinted');
    expect(rungOfQuestion('identify-typed')).toBe('typed-hinted');
    expect(rungOfQuestion('identify-typed', 'none')).toBe('typed-bare');
  });

  it('puts the formats with progressions of their own outside the ladder', () => {
    expect(rungOfQuestion('locate')).toBeNull();
    expect(rungOfQuestion('multi-select')).toBeNull();
    expect(rungOfQuestion('oina')).toBeNull();
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

describe('promoteOrDemote and the format that was asked', () => {
  const met = row({ attemptsTotal: 6, attemptsCorrect: 6, rung: 'mcq', rungStreak: 2, rungMissStreak: 0 });

  it('does not climb on answers from outside the ladder', () => {
    // Three right locate taps used to carry a structure to typed recall, and
    // the next session asked for its name with nothing to go on.
    let m = met;
    for (let i = 0; i < 3; i++) m = { ...m, ...promoteOrDemote(m, true, null) };
    expect(m.rung).toBe('mcq');
    expect(m.rungStreak).toBe(2); // untouched, not reset and not advanced
  });

  it('does not let a wrong locate tap wipe the streak it did not earn', () => {
    const after = promoteOrDemote(met, false, null);
    expect(after.rungStreak).toBe(2);
    expect(after.rungMissStreak).toBe(0);
  });

  it('climbs on three answers at the structure own rung', () => {
    let m = row({ attemptsTotal: 6, attemptsCorrect: 6, rung: 'mcq', rungStreak: 0 });
    for (let i = 0; i < 3; i++) {
      m = { ...m, ...promoteOrDemote(m, true, 'mcq'), attemptsTotal: m.attemptsTotal + 1, attemptsCorrect: m.attemptsCorrect + 1 };
    }
    expect(m.rung).toBe('typed-hinted');
  });

  it('gives no promotion credit for an easier question than the rung asks', () => {
    // A session offering only MCQs, asking a structure that has earned hints.
    let m = row({ attemptsTotal: 9, attemptsCorrect: 9, rung: 'typed-hinted', rungStreak: 0 });
    for (let i = 0; i < 4; i++) {
      m = { ...m, ...promoteOrDemote(m, true, 'mcq'), attemptsTotal: m.attemptsTotal + 1, attemptsCorrect: m.attemptsCorrect + 1 };
    }
    expect(m.rung).toBe('typed-hinted');
    expect(m.rungStreak).toBe(0);
  });

  it('still demotes on an easier question missed twice', () => {
    let m = row({ attemptsTotal: 9, attemptsCorrect: 9, rung: 'typed-bare', rungStreak: 0 });
    for (let i = 0; i < 2; i++) m = { ...m, ...promoteOrDemote(m, false, 'mcq'), attemptsTotal: m.attemptsTotal + 1 };
    expect(m.rung).toBe('typed-hinted');
  });

  it('credits an answer harder than the rung asks', () => {
    let m = row({ attemptsTotal: 6, attemptsCorrect: 6, rung: 'mcq', rungStreak: 0 });
    for (let i = 0; i < 3; i++) {
      m = { ...m, ...promoteOrDemote(m, true, 'typed-bare'), attemptsTotal: m.attemptsTotal + 1, attemptsCorrect: m.attemptsCorrect + 1 };
    }
    expect(m.rung).toBe('typed-hinted');
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
