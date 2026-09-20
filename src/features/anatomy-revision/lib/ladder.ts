import type { StructureMastery } from '../types/attempt';
import type { QuestionType } from '../types/question';

/**
 * The difficulty ladder a structure climbs, one rung at a time:
 *
 *   flashcard  →  mcq  →  typed-hinted  →  typed-bare
 *
 * A structure the student has never met is shown, not asked: a flashcard.
 * Once met, it is recognised from options (MCQ). Three right in a row with a
 * sound overall accuracy and it is recalled by typing with the two hints
 * (letter count, first letter); three more and the hints go, which is the
 * strictest recall the app has and pays the most XP (lib/xp.ts). Two misses
 * in a row drop a rung, never below MCQ — the flashcard rung is only for
 * something never seen.
 *
 * Per structure, not per question: the same muscle has ten questions and the
 * point is that the DEMAND rises as the student learns the muscle, whichever
 * question asks about it. The thresholds copy OINA's per-fact promotion
 * (lib/factMastery.ts), which the student already lives with. Locate is
 * outside the ladder — it tests where a thing is, not what it is called —
 * and so are multi-select and OINA, which have shapes of their own.
 */
export type Rung = 'flashcard' | 'mcq' | 'typed-hinted' | 'typed-bare';

export const RUNGS: Rung[] = ['flashcard', 'mcq', 'typed-hinted', 'typed-bare'];

export const LADDER_CONFIG = {
  /** Consecutive correct answers before a structure climbs a rung. */
  promotionStreak: 3,
  /** ...and the all-time accuracy that must hold as well, so three lucky guesses after ten misses do not promote. */
  promotionAccuracy: 0.7,
  /** Consecutive misses before a structure drops a rung. */
  demotionStreak: 2,
};

type LadderConfig = typeof LADDER_CONFIG;

/** The formats the ladder decides between. Everything else is asked as requested. */
export const LADDER_TYPES: readonly QuestionType[] = ['flashcard', 'mcq', 'fill-blank', 'identify-typed'];

/**
 * Which rung a structure is on. A stored rung wins; a row without one (every
 * row written before the ladder existed) is placed by its accuracy, so a
 * student who had already earned typed recall is not sent back to options.
 */
export function rungFor(mastery: StructureMastery | undefined): Rung {
  if (!mastery) return 'flashcard';
  if (mastery.rung) return mastery.rung;
  if (mastery.attemptsTotal === 0) return 'mcq';
  const accuracy = mastery.attemptsCorrect / mastery.attemptsTotal;
  if (accuracy >= 0.85) return 'typed-bare';
  if (accuracy >= 0.6) return 'typed-hinted';
  return 'mcq';
}

/** The rung fields after one graded answer. */
export function promoteOrDemote(
  existing: StructureMastery | undefined,
  correct: boolean,
  config: LadderConfig = LADDER_CONFIG,
): Pick<StructureMastery, 'rung' | 'rungStreak' | 'rungMissStreak'> {
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (correct ? 1 : 0);
  // A graded answer means the structure has been met, whatever the row said.
  let rung: Rung = rungFor(existing);
  if (rung === 'flashcard') rung = 'mcq';
  let rungStreak = correct ? (existing?.rungStreak ?? 0) + 1 : 0;
  let rungMissStreak = correct ? 0 : (existing?.rungMissStreak ?? 0) + 1;

  const at = RUNGS.indexOf(rung);
  if (correct && rungStreak >= config.promotionStreak && attemptsCorrect / attemptsTotal >= config.promotionAccuracy && at < RUNGS.length - 1) {
    rung = RUNGS[at + 1];
    rungStreak = 0;
  } else if (!correct && rungMissStreak >= config.demotionStreak && at > RUNGS.indexOf('mcq')) {
    rung = RUNGS[at - 1];
    rungMissStreak = 0;
  }
  return { rung, rungStreak, rungMissStreak };
}

/**
 * The question format for a rung, from the formats the session asked for.
 * Falls back down (and, failing that, up) the ladder to something requested,
 * so a session of only MCQs still asks a typed-bare structure an MCQ.
 */
export function questionTypeForRung(rung: Rung, requested: readonly QuestionType[]): QuestionType | null {
  const order: Record<Rung, QuestionType[]> = {
    flashcard: ['flashcard', 'mcq', 'fill-blank', 'identify-typed'],
    mcq: ['mcq', 'fill-blank', 'flashcard', 'identify-typed'],
    'typed-hinted': ['identify-typed', 'fill-blank', 'mcq', 'flashcard'],
    'typed-bare': ['identify-typed', 'fill-blank', 'mcq', 'flashcard'],
  };
  return order[rung].find((t) => requested.includes(t)) ?? null;
}

export function hintsForRung(rung: Rung): 'full' | 'none' {
  return rung === 'typed-bare' ? 'none' : 'full';
}

/**
 * The mastery row a flashcard leaves behind: the structure has been SEEN,
 * so it leaves the flashcard rung, but nothing has been answered, so nothing
 * is scheduled and no accuracy exists. Only written when no row exists yet.
 */
export function markSeen(structureId: string, userId: string, now: Date = new Date()): StructureMastery {
  const iso = now.toISOString();
  return {
    structureId,
    userId,
    attemptsTotal: 0,
    attemptsCorrect: 0,
    lastAttemptAt: iso,
    firstSeenAt: iso,
    rung: 'mcq',
    rungStreak: 0,
    rungMissStreak: 0,
  };
}
