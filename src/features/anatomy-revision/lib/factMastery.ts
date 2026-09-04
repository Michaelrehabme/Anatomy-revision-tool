import type { FactMastery } from '../types/attempt';
import type { OinaPromptKind } from '../types/question';

/**
 * All OINA escalation tuning in one place, matching the convention
 * ADAPTIVE_CONFIG and DEFAULT_XP_CONFIG set.
 */
export const FACT_MASTERY_CONFIG = {
  /** Consecutive fully-correct select answers before a fact switches to typed recall. */
  promotionStreak: 3,
  /** ...and the all-time accuracy floor that must hold as well, so a fact answered 3 right after 12 wrong isn't promoted. */
  promotionAccuracy: 0.7,
  /** Consecutive typed misses before a fact drops back to select. */
  demotionStreak: 2,
  /**
   * Default for how many attempts a fact is still "being learned" for. Below
   * this the question is preceded by its flashcard — a student cannot recall
   * an attachment they have never been shown, and a first encounter that is
   * a blind guess teaches nothing.
   *
   * Only a default: the student picks their own on the setup screen, since
   * how many repeats help is a matter of how well they already know the
   * material. See lib/preferences.ts.
   */
  learnCardAttempts: 3,
};

export function factMasteryKey(structureId: string, promptKind: OinaPromptKind): string {
  return `${structureId}__${promptKind}`;
}

/** Indexes fact mastery rows the way the generator looks them up. */
export function indexFactMastery(rows: readonly FactMastery[]): Map<string, FactMastery> {
  return new Map(rows.map((row) => [factMasteryKey(row.structureId, row.promptKind), row]));
}

/** Recognition until the student has shown they can do without the options. */
export function pickOinaFormat(fact: FactMastery | undefined): 'select' | 'typed' {
  return fact?.typed ? 'typed' : 'select';
}

/**
 * Whether to show the fact's flashcard immediately before the question:
 * while it is still new, and any time the last attempt was wrong. Both
 * halves matter — the first teaches, the second re-teaches rather than
 * asking the same unanswerable question again.
 *
 * `attempts` of 0 turns teaching off completely, including the re-teach — a
 * student who asked for no cards means it.
 */
export function shouldPrecedeWithLearnCard(
  fact: FactMastery | undefined,
  attempts: number = FACT_MASTERY_CONFIG.learnCardAttempts,
): boolean {
  if (attempts <= 0) return false;
  if (!fact) return true;
  return fact.attemptsTotal < attempts || !fact.lastCorrect;
}

export interface FactAttemptInput {
  userId: string;
  structureId: string;
  promptKind: OinaPromptKind;
  correct: boolean;
  now?: Date;
}

/**
 * Folds one OINA answer into a fact's progress, promoting to typed recall or
 * demoting back to recognition as the thresholds above are crossed.
 *
 * Demotion deliberately clears the correct-streak too: a student who has
 * dropped back to recognition should have to earn the promotion again rather
 * than bounce between formats on alternate answers.
 */
export function updateFactMasteryAfterAttempt(
  existing: FactMastery | undefined,
  input: FactAttemptInput,
  config = FACT_MASTERY_CONFIG,
): FactMastery {
  const now = input.now ?? new Date();
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (input.correct ? 1 : 0);
  const streak = input.correct ? (existing?.streak ?? 0) + 1 : 0;
  const missStreak = input.correct ? 0 : (existing?.missStreak ?? 0) + 1;
  const accuracy = attemptsCorrect / attemptsTotal;

  const wasTyped = existing?.typed ?? false;
  let typed = wasTyped;
  if (typed) {
    if (missStreak >= config.demotionStreak) typed = false;
  } else if (streak >= config.promotionStreak && accuracy >= config.promotionAccuracy) {
    typed = true;
  }
  const demoted = wasTyped && !typed;

  return {
    userId: input.userId,
    structureId: input.structureId,
    promptKind: input.promptKind,
    attemptsTotal,
    attemptsCorrect,
    // A demotion resets the ladder rather than leaving a stale streak behind.
    streak: demoted ? 0 : streak,
    missStreak,
    lastCorrect: input.correct,
    lastAttemptAt: now.toISOString(),
    typed,
  };
}
