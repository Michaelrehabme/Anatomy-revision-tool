import { describe, it, expect } from 'vitest';
import {
  FACT_MASTERY_CONFIG,
  factComplete,
  factDueAt,
  skillOf,
  factHints,
  factStage,
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

describe('three-stage fact ladder (29 Sep 2026)', () => {
  it('climbs select → typed with hints → typed without, three right at each stage', () => {
    expect(factStage(history(true, true))).toBe('select');
    expect(factStage(history(true, true, true))).toBe('typed-hinted');
    expect(factStage(history(true, true, true, true, true))).toBe('typed-hinted');
    expect(factStage(history(true, true, true, true, true, true))).toBe('typed-bare');
  });

  it('starts the streak again on every change of stage', () => {
    expect(history(true, true, true).streak).toBe(0);
    expect(history(true, true, true, true).streak).toBe(1);
  });

  it('asks with hints at the middle stage and without at the last', () => {
    expect(factHints(history(true, true, true))).toBe('full');
    expect(factHints(history(true, true, true, true, true, true))).toBe('none');
  });

  it('demotes one stage at a time after two misses', () => {
    const bare = history(true, true, true, true, true, true);
    expect(factStage(answer(answer(bare, false), false))).toBe('typed-hinted');
    const hinted = history(true, true, true);
    expect(factStage(answer(answer(hinted, false), false))).toBe('select');
  });

  it('reads a typed row from before hints existed as typed without hints', () => {
    const legacy = { ...history(true, true, true), bare: undefined };
    expect(factStage(legacy)).toBe('typed-bare');
  });

  it('never promotes "how rich", and counts it complete at three in a row', () => {
    const rating = (results: boolean[]) =>
      results.reduce<FactMastery | undefined>(
        (acc, correct) =>
          updateFactMasteryAfterAttempt(acc, { ...INPUT, promptKind: 'blood-supply-rating', correct, now }),
        undefined,
      )!;
    const three = rating([true, true, true]);
    expect(factStage(three)).toBe('select');
    expect(factComplete('blood-supply-rating', rating([true, true]))).toBe(false);
    expect(factComplete('blood-supply-rating', three)).toBe(true);
  });

  it('counts a fact complete once it reaches typed without hints, and not before', () => {
    expect(factComplete('origin', history(true, true, true, true, true))).toBe(false);
    expect(factComplete('origin', history(true, true, true, true, true, true))).toBe(true);
  });
});

describe('each fact on its own schedule (2 Oct 2026)', () => {
  const at = (iso: string) => new Date(iso);
  const DAY = 86_400_000;
  const days = (f: FactMastery) => Math.round((Date.parse(f.dueAt!) - now.getTime()) / DAY);

  it('goes ten days out on an easy right answer and comes back tomorrow on a miss', () => {
    expect(days(updateFactMasteryAfterAttempt(undefined, { ...INPUT, correct: true, confidence: 'easy', now }))).toBe(10);
    expect(days(updateFactMasteryAfterAttempt(undefined, { ...INPUT, correct: false, confidence: 'easy', now }))).toBe(1);
  });

  it('reads an unrated right answer as Medium', () => {
    expect(days(updateFactMasteryAfterAttempt(undefined, { ...INPUT, correct: true, now }))).toBe(4);
  });

  it('schedules an answer asked below the stage, but does not let it promote', () => {
    const hinted = history(true, true, true);
    let fact = hinted;
    for (let i = 0; i < 4; i++) fact = updateFactMasteryAfterAttempt(fact, { ...INPUT, correct: true, askedStage: 'select', now });
    expect(factStage(fact)).toBe('typed-hinted');
    expect(fact.dueAt).toBeDefined();
  });

  it('spaces a fact row from before facts were scheduled by the stage it reached', () => {
    const legacy: FactMastery = { ...history(true, true, true), dueAt: undefined, intervalDays: undefined, lastAttemptAt: '2026-09-01T10:00:00.000Z' };
    expect(factDueAt(legacy)).toBe(at('2026-09-05T10:00:00.000Z').toISOString());
  });
});

describe('skillOf', () => {
  it('puts naming on the structure and every other kind on its own row', () => {
    expect(skillOf('locate', 'identify')).toBe('identify');
    expect(skillOf('flashcard', 'origin')).toBe('identify');
    expect(skillOf('mcq', 'identify')).toBe('identify');
    expect(skillOf('mcq', 'origin')).toBe('origin');
    expect(skillOf('oina', 'nerve')).toBe('nerve');
    expect(skillOf('fill-blank', 'attachment')).toBe('attachment');
  });
});
