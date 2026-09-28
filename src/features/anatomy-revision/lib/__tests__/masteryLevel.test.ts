import { describe, it, expect } from 'vitest';
import { masteryLevel } from '../masteryLevel';
import { markSeen, rungOfQuestion } from '../ladder';
import { updateMasteryAfterAttempt } from '../mastery';
import type { StructureMastery } from '../../types/attempt';

const NOW = new Date('2026-09-27T09:00:00.000Z');

function row(overrides: Partial<StructureMastery> = {}): StructureMastery {
  return {
    structureId: 'deltoid',
    userId: 'u',
    attemptsTotal: 5,
    attemptsCorrect: 5,
    lastAttemptAt: '2026-09-26T09:00:00.000Z',
    ...overrides,
  };
}

/** Answers through the real update path, asking each question at the rung given. */
function answer(m: StructureMastery | undefined, correct: boolean, type: 'mcq' | 'typed' | 'bare'): StructureMastery {
  const askedRung =
    type === 'mcq' ? rungOfQuestion('mcq') : rungOfQuestion('identify-typed', type === 'bare' ? 'none' : 'full');
  return updateMasteryAfterAttempt(m, { structureId: 'deltoid', userId: 'u', correct, askedRung }, NOW);
}

describe('masteryLevel', () => {
  it('reads a structure never met, and one only shown on a flashcard, as Beginner', () => {
    expect(masteryLevel(undefined, NOW)).toMatchObject({ level: 'beginner', seen: false });
    expect(masteryLevel(markSeen('deltoid', 'u', NOW), NOW)).toMatchObject({ level: 'beginner', seen: true });
  });

  it('maps each rung to its level', () => {
    expect(masteryLevel(row({ rung: 'mcq' }), NOW).level).toBe('novice');
    expect(masteryLevel(row({ rung: 'typed-hinted' }), NOW).level).toBe('intermediate');
    expect(masteryLevel(row({ rung: 'typed-bare', rungStreak: 2 }), NOW).level).toBe('advanced');
    expect(masteryLevel(row({ rung: 'typed-bare', rungStreak: 3 }), NOW).level).toBe('master');
  });

  it('places a row from before the ladder by its accuracy, like the ladder does', () => {
    expect(masteryLevel(row({ attemptsTotal: 10, attemptsCorrect: 9 }), NOW).level).toBe('advanced');
  });

  it('climbs Novice → Intermediate → Advanced → Master through real answers, and a miss takes Master away', () => {
    let m: StructureMastery | undefined;
    for (let i = 0; i < 3; i++) m = answer(m, true, 'mcq');
    expect(masteryLevel(m, NOW).level).toBe('intermediate');
    for (let i = 0; i < 3; i++) m = answer(m, true, 'typed');
    expect(masteryLevel(m, NOW).level).toBe('advanced');
    m = answer(m, true, 'bare');
    m = answer(m, true, 'bare');
    expect(masteryLevel(m, NOW)).toMatchObject({ level: 'advanced', next: '1 more typed answer without hints' });
    m = answer(m, true, 'bare');
    expect(masteryLevel(m, NOW)).toMatchObject({ level: 'master', next: null });
    m = answer(m, false, 'bare');
    expect(masteryLevel(m, NOW).level).toBe('advanced');
  });

  it('does not count easier questions towards Master', () => {
    let m: StructureMastery | undefined = row({ rung: 'typed-bare', rungStreak: 2 });
    m = answer(m, true, 'mcq');
    expect(masteryLevel(m, NOW).level).toBe('advanced');
  });

  it('marks a Master fading once it is a whole interval past due', () => {
    const master = row({ rung: 'typed-bare', rungStreak: 3, intervalDays: 10 });
    const due = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
    expect(masteryLevel({ ...master, dueAt: due(5) }, NOW).fading).toBe(false);
    expect(masteryLevel({ ...master, dueAt: due(11) }, NOW)).toMatchObject({ level: 'master', fading: true });
  });
});
