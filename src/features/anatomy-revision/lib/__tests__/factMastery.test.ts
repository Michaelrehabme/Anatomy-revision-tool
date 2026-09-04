import { describe, it, expect } from 'vitest';
import {
  FACT_MASTERY_CONFIG,
  factMasteryKey,
  pickOinaFormat,
  shouldPrecedeWithLearnCard,
  updateFactMasteryAfterAttempt,
} from '../factMastery';
import type { FactMastery } from '../../types/attempt';

const INPUT = { userId: 'u1', structureId: 'biceps-femoris', promptKind: 'origin' as const };
const now = new Date('2026-09-03T10:00:00.000Z');

function answer(existing: FactMastery | undefined, correct: boolean): FactMastery {
  return updateFactMasteryAfterAttempt(existing, { ...INPUT, correct, now });
}

/** Applies a run of answers in order, starting from nothing. */
function history(...results: boolean[]): FactMastery {
  return results.reduce<FactMastery | undefined>((acc, correct) => answer(acc, correct), undefined)!;
}

describe('updateFactMasteryAfterAttempt', () => {
  it('starts a record on the first answer', () => {
    const fact = answer(undefined, true);
    expect(fact).toMatchObject({
      structureId: 'biceps-femoris',
      promptKind: 'origin',
      attemptsTotal: 1,
      attemptsCorrect: 1,
      streak: 1,
      missStreak: 0,
      lastCorrect: true,
      typed: false,
    });
  });

  it('promotes to typed after three consecutive correct answers', () => {
    expect(history(true, true).typed).toBe(false);
    expect(history(true, true, true).typed).toBe(true);
  });

  it('does not promote on a streak that follows a poor record', () => {
    // 3 right at the end, but 3/9 overall is below the accuracy floor.
    const fact = history(false, false, false, false, false, false, true, true, true);
    expect(fact.streak).toBe(FACT_MASTERY_CONFIG.promotionStreak);
    expect(fact.attemptsCorrect / fact.attemptsTotal).toBeLessThan(FACT_MASTERY_CONFIG.promotionAccuracy);
    expect(fact.typed).toBe(false);
  });

  it('resets the streak on a wrong answer', () => {
    expect(history(true, true, false).streak).toBe(0);
    expect(history(true, true, false, true).typed).toBe(false);
  });

  it('demotes after two consecutive typed misses, but not one', () => {
    const promoted = history(true, true, true);
    expect(promoted.typed).toBe(true);
    const oneMiss = answer(promoted, false);
    expect(oneMiss.typed).toBe(true);
    const twoMisses = answer(oneMiss, false);
    expect(twoMisses.typed).toBe(false);
  });

  it('makes a demoted fact earn its promotion again rather than bouncing back', () => {
    const demoted = answer(answer(history(true, true, true), false), false);
    expect(demoted.typed).toBe(false);
    expect(demoted.streak).toBe(0);
    const oneRight = answer(demoted, true);
    expect(oneRight.typed).toBe(false);
    expect(oneRight.streak).toBe(1);
  });

  it('keeps a running record across answers', () => {
    const fact = history(true, false, true, true);
    expect(fact).toMatchObject({ attemptsTotal: 4, attemptsCorrect: 3, streak: 2, missStreak: 0 });
    expect(fact.lastAttemptAt).toBe(now.toISOString());
  });
});

describe('pickOinaFormat', () => {
  it('starts on recognition and stays there until promoted', () => {
    expect(pickOinaFormat(undefined)).toBe('select');
    expect(pickOinaFormat(history(true, true))).toBe('select');
    expect(pickOinaFormat(history(true, true, true))).toBe('typed');
  });
});

describe('shouldPrecedeWithLearnCard', () => {
  it('teaches a fact the student has never seen', () => {
    expect(shouldPrecedeWithLearnCard(undefined)).toBe(true);
  });

  it('keeps teaching for the first three attempts by default', () => {
    expect(shouldPrecedeWithLearnCard(history(true))).toBe(true);
    expect(shouldPrecedeWithLearnCard(history(true, true))).toBe(true);
    expect(shouldPrecedeWithLearnCard(history(true, true, true))).toBe(false);
  });

  it('re-teaches after a wrong answer, however well known the fact was', () => {
    const known = history(true, true, true, true, true);
    expect(shouldPrecedeWithLearnCard(known)).toBe(false);
    expect(shouldPrecedeWithLearnCard(answer(known, false))).toBe(true);
  });

  it('honours a student who only wants to be shown a fact once', () => {
    expect(shouldPrecedeWithLearnCard(undefined, 1)).toBe(true);
    expect(shouldPrecedeWithLearnCard(history(true), 1)).toBe(false);
    // The re-teach after a miss still applies — it is not a repeat, it is a correction.
    expect(shouldPrecedeWithLearnCard(history(true, false), 1)).toBe(true);
  });

  it('turns teaching off completely at 0, including after a miss', () => {
    expect(shouldPrecedeWithLearnCard(undefined, 0)).toBe(false);
    expect(shouldPrecedeWithLearnCard(history(true, false), 0)).toBe(false);
  });
});

describe('factMasteryKey', () => {
  it('keys per muscle and fact, not per muscle', () => {
    expect(factMasteryKey('biceps-femoris', 'origin')).toBe('biceps-femoris__origin');
    expect(factMasteryKey('biceps-femoris', 'nerve')).not.toBe(factMasteryKey('biceps-femoris', 'origin'));
  });
});
