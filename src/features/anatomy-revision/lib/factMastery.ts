import type { FactMastery } from '../types/attempt';
import type { FactKind } from '../types/question';
import { MUSCLE_FACT_KINDS } from '../types/question';
import { isMuscle, type AnatomyStructure } from '../types/structure';

/**
 * All OINA escalation tuning in one place, matching the convention
 * ADAPTIVE_CONFIG and DEFAULT_XP_CONFIG set.
 */
export const FACT_MASTERY_CONFIG = {
  /**
   * Consecutive fully-correct answers before a fact moves up a stage: select
   * to typed with hints, and typed with hints to typed without. "How rich" has
   * no typed form; it is complete after this many right in a row.
   */
  promotionStreak: 3,
  /** ...and the all-time accuracy floor that must hold as well, so a fact answered 3 right after 12 wrong isn't promoted. */
  promotionAccuracy: 0.7,
  /** Consecutive misses before a fact drops a stage: without hints to with, with hints to select. */
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

export function factMasteryKey(structureId: string, promptKind: FactKind): string {
  return `${structureId}__${promptKind}`;
}

/** Indexes fact mastery rows the way the generator looks them up. */
export function indexFactMastery(rows: readonly FactMastery[]): Map<string, FactMastery> {
  return new Map(rows.map((row) => [factMasteryKey(row.structureId, row.promptKind), row]));
}

/**
 * The fact's stage, the naming ladder's shape: recognise it among options,
 * recall it with the letter-count and first-letter hints, then recall it bare.
 */
export type FactStage = 'select' | 'typed-hinted' | 'typed-bare';

export function factStage(fact: FactMastery | undefined): FactStage {
  if (!fact?.typed) return 'select';
  // Absent `bare` on a typed row is a row from before the hinted stage, when
  // typed recall never showed hints: it has already earned the bare stage.
  return fact.bare === false ? 'typed-hinted' : 'typed-bare';
}

/** Recognition until the student has shown they can do without the options. */
export function pickOinaFormat(fact: FactMastery | undefined): 'select' | 'typed' {
  return factStage(fact) === 'select' ? 'select' : 'typed';
}

/** Hints on the first typed stage, none once recall without them is earned. */
export function factHints(fact: FactMastery | undefined): 'full' | 'none' {
  return factStage(fact) === 'typed-hinted' ? 'full' : 'none';
}

/**
 * The facts a structure must know to be mastered (owner, 29 Sep 2026): a
 * muscle's origin, insertion, nerve and action, and — outside landmarks —
 * its blood supply: the primary artery where one is named, the assisting
 * arteries where there are any, and how rich the supply is.
 */
export function requiredFactKinds(structure: AnatomyStructure): FactKind[] {
  const kinds: FactKind[] = isMuscle(structure) ? [...MUSCLE_FACT_KINDS] : [];
  const b = structure.category === 'landmark' ? undefined : structure.bloodSupply;
  if (b) {
    if (b.primary) kinds.push('blood-supply');
    if (b.primary && b.assisting.length) kinds.push('blood-supply-assisting');
    kinds.push('blood-supply-rating');
  }
  return kinds;
}

/** Whether a fact is at its final stage: typed without hints, or for "how rich", right three times running. */
export function factComplete(kind: FactKind, fact: FactMastery | undefined, config = FACT_MASTERY_CONFIG): boolean {
  if (!fact) return false;
  if (kind === 'blood-supply-rating') return fact.streak >= config.promotionStreak;
  return factStage(fact) === 'typed-bare';
}

/** The required facts not yet at their final stage. */
export function outstandingFacts(
  structure: AnatomyStructure,
  factsByKey: ReadonlyMap<string, FactMastery>,
): FactKind[] {
  return requiredFactKinds(structure).filter((k) => !factComplete(k, factsByKey.get(factMasteryKey(structure.id, k))));
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
  promptKind: FactKind;
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
  let streak = input.correct ? (existing?.streak ?? 0) + 1 : 0;
  const missStreak = input.correct ? 0 : (existing?.missStreak ?? 0) + 1;
  const accuracy = attemptsCorrect / attemptsTotal;

  const before = factStage(existing);
  let stage = before;
  // "How rich" is multiple choice only: its streak simply counts, and
  // factComplete reads it. Every other fact climbs the three stages.
  if (input.promptKind !== 'blood-supply-rating') {
    if (missStreak >= config.demotionStreak && before !== 'select') {
      stage = before === 'typed-bare' ? 'typed-hinted' : 'select';
    } else if (input.correct && streak >= config.promotionStreak && before !== 'typed-bare') {
      if (before === 'typed-hinted' || accuracy >= config.promotionAccuracy) {
        stage = before === 'select' ? 'typed-hinted' : 'typed-bare';
      }
    }
  }
  // A change of stage in either direction starts the streak again: each
  // stage is earned AT that stage, as on the naming ladder.
  if (stage !== before) streak = 0;

  return {
    userId: input.userId,
    structureId: input.structureId,
    promptKind: input.promptKind,
    attemptsTotal,
    attemptsCorrect,
    streak,
    missStreak: stage !== before ? 0 : missStreak,
    lastCorrect: input.correct,
    lastAttemptAt: now.toISOString(),
    typed: stage !== 'select',
    bare: stage === 'typed-bare',
  };
}
