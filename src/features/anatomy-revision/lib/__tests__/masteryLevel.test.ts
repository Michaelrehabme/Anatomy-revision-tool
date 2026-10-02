import { describe, it, expect } from 'vitest';
import { factLevel, factsIndex, masteryLevel, structureLevel } from '../masteryLevel';
import { requiredFactKinds } from '../factMastery';
import { ALL_STRUCTURES } from '../../data/seed';
import type { FactKind } from '../../types/question';
import { markSeen, rungOfQuestion } from '../ladder';
import { updateMasteryAfterAttempt } from '../mastery';
import type { FactMastery, StructureMastery } from '../../types/attempt';

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

describe('structureLevel: the average of the question types met (2 Oct 2026)', () => {
  const structure = ALL_STRUCTURES.find((s) => s.id === 'deltoid')!;
  const fact = (kind: FactKind, overrides: Partial<FactMastery> = {}): FactMastery => ({
    userId: 'u',
    structureId: 'deltoid',
    promptKind: kind,
    attemptsTotal: 9,
    attemptsCorrect: 9,
    streak: 3,
    missStreak: 0,
    lastCorrect: true,
    lastAttemptAt: NOW.toISOString(),
    typed: kind !== 'blood-supply-rating',
    bare: kind !== 'blood-supply-rating',
    ...overrides,
  });
  const master = row({ rung: 'typed-bare', rungStreak: 3 });

  it('averages only the types met, rounded down, and lists the rest', () => {
    // Naming Master (4), origin Intermediate (2), insertion Advanced (3): 9 / 3 = 3.
    const facts = factsIndex([
      fact('origin', { bare: false, streak: 0 }),
      fact('insertion', { streak: 1 }),
    ]);
    const state = structureLevel(structure, master, facts, NOW);
    expect(state.level).toBe('advanced');
    expect(state.unmet).toContain('nerve');
    expect(state.unmet).not.toContain('identify');
    expect(state.next).toMatch(/^Origin: /);
  });

  it('rounds down, so one weak type keeps the average under it', () => {
    // Naming Master (4), origin Novice (1): 5 / 2 = 2.5 → Intermediate.
    const state = structureLevel(structure, master, factsIndex([fact('origin', { typed: false, bare: false, streak: 0 })]), NOW);
    expect(state.level).toBe('intermediate');
  });

  it('is Master only when every type is met and at Master', () => {
    const all = requiredFactKinds(structure).map((k) => fact(k));
    expect(structureLevel(structure, master, factsIndex(all), NOW)).toMatchObject({ level: 'master', unmet: [] });
    const allButOne = all.slice(1);
    expect(structureLevel(structure, master, factsIndex(allButOne), NOW).level).toBe('advanced');
  });

  it('counts a structure met through a fact alone as seen', () => {
    const state = structureLevel(structure, undefined, factsIndex([fact('origin', { typed: false, bare: false, streak: 1 })]), NOW);
    expect(state).toMatchObject({ seen: true, level: 'novice' });
    expect(state.unmet).toContain('identify');
  });

  it('is an unmet Beginner with nothing answered', () => {
    expect(structureLevel(structure, undefined, new Map(), NOW)).toMatchObject({ level: 'beginner', seen: false });
  });
});

describe('factLevel', () => {
  const base = { userId: 'u', structureId: 'deltoid', attemptsTotal: 4, attemptsCorrect: 4, missStreak: 0, lastCorrect: true, lastAttemptAt: NOW.toISOString() };
  it('maps the OINA stages to levels', () => {
    expect(factLevel('origin', { ...base, promptKind: 'origin', streak: 1, typed: false }, NOW)?.level).toBe('novice');
    expect(factLevel('origin', { ...base, promptKind: 'origin', streak: 1, typed: true, bare: false }, NOW)?.level).toBe('intermediate');
    expect(factLevel('origin', { ...base, promptKind: 'origin', streak: 1, typed: true, bare: true }, NOW)?.level).toBe('advanced');
    expect(factLevel('origin', { ...base, promptKind: 'origin', streak: 3, typed: true, bare: true }, NOW)?.level).toBe('master');
  });

  it('reads a multiple-choice-only type by its run of right answers', () => {
    const rating = (streak: number) => factLevel('blood-supply-rating', { ...base, promptKind: 'blood-supply-rating', streak, typed: false }, NOW)?.level;
    expect([0, 1, 2, 3].map(rating)).toEqual(['novice', 'intermediate', 'advanced', 'master']);
  });

  it('is null when never answered', () => {
    expect(factLevel('origin', undefined, NOW)).toBeNull();
  });
});

describe('rungOfQuestion for fact questions', () => {
  it('gives blood-supply questions no naming rung', () => {
    expect(rungOfQuestion('mcq', undefined, 'blood-supply-rating')).toBeNull();
    expect(rungOfQuestion('oina', undefined, 'blood-supply')).toBeNull();
  });
});
