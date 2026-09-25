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
 *
 * EVERY RUNG IS EARNED, AT THE RUNG. Two things used to let a structure skip
 * one, and the result was a bare typed question on something barely met:
 *
 *   - the streak counted any correct answer, so three right locate taps or
 *     three OINA facts could carry a muscle from options to typed recall
 *     without the student ever having typed its name. `rungOfQuestion` says
 *     what a question asks at, and only an answer at the structure's own rung
 *     or harder earns promotion credit (see promoteOrDemote);
 *   - a row from before the ladder had no stored rung and was placed by
 *     accuracy alone, so one lucky first answer read as 100% and landed on
 *     typed-bare. `legacyMinAttempts` now asks for as many answers as
 *     climbing would have taken.
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
  /**
   * How many graded answers a row with NO stored rung must carry before its
   * accuracy may place it above MCQ — one entry per rung that can be inferred.
   *
   * Only rows written before the ladder existed take that path, but they are
   * most of the rows on a long-standing account, and accuracy over one or two
   * answers is not accuracy: a single correct first answer reads as 100% and
   * put the structure on typed-bare, which is how a student met a no-hint
   * typed question on something they had barely seen. The figures are what
   * climbing would have cost — promotionStreak to reach typed-hinted, and
   * another promotionStreak on top to reach typed-bare.
   */
  legacyMinAttempts: {
    'typed-hinted': 3,
    'typed-bare': 6,
  } as Record<'typed-hinted' | 'typed-bare', number>,
};

type LadderConfig = typeof LADDER_CONFIG;

/** The formats the ladder decides between. Everything else is asked as requested. */
export const LADDER_TYPES: readonly QuestionType[] = ['flashcard', 'mcq', 'fill-blank', 'identify-typed'];

/**
 * Which rung a structure is on. A stored rung wins; a row without one (every
 * row written before the ladder existed) is placed by its accuracy, so a
 * student who had already earned typed recall is not sent back to options —
 * but only once it carries enough answers for that accuracy to mean anything
 * (LADDER_CONFIG.legacyMinAttempts). A thin row starts at MCQ and climbs from
 * there like any other.
 */
export function rungFor(mastery: StructureMastery | undefined, config: LadderConfig = LADDER_CONFIG): Rung {
  if (!mastery) return 'flashcard';
  if (mastery.rung) return mastery.rung;
  if (mastery.attemptsTotal === 0) return 'mcq';
  const accuracy = mastery.attemptsCorrect / mastery.attemptsTotal;
  if (accuracy >= 0.85 && mastery.attemptsTotal >= config.legacyMinAttempts['typed-bare']) return 'typed-bare';
  if (accuracy >= 0.6 && mastery.attemptsTotal >= config.legacyMinAttempts['typed-hinted']) return 'typed-hinted';
  return 'mcq';
}

/**
 * What a question ASKS AT — the demand it makes of the student — or null for a
 * format outside the ladder, whose answers must move it neither way.
 *
 * This is what keeps the climb linear. Without it the streak that promotes a
 * structure counted every correct answer about it, so a muscle could reach
 * typed-bare on locate taps and OINA facts alone and then ask for its name
 * from nothing, with no hints.
 *
 * Fill-blank is typed, but the sentence around the gap carries most of the
 * answer's context, so it asks no more than hinted recall.
 */
export function rungOfQuestion(type: QuestionType, hints?: 'full' | 'none'): Rung | null {
  switch (type) {
    case 'flashcard':
      return 'flashcard';
    case 'mcq':
      return 'mcq';
    case 'fill-blank':
      return 'typed-hinted';
    case 'identify-typed':
      return hints === 'none' ? 'typed-bare' : 'typed-hinted';
    default:
      // locate, multi-select, OINA — outside the ladder by design.
      return null;
  }
}

/**
 * The rung fields after one graded answer.
 *
 * `asked` is the rung the question just answered asks at — from
 * `rungOfQuestion`. Three cases, and the middle one is the whole point:
 *
 *   - null: a format outside the ladder. The answer still counts towards
 *     accuracy and the schedule, but it leaves the rung and both streaks
 *     exactly as they were. A wrong locate tap must not wipe two right MCQs
 *     off the promotion streak, any more than three right ones should fill it.
 *   - easier than the structure's rung: a session offering only MCQs asking a
 *     typed-hinted structure. Getting it right clears the miss streak — right
 *     is right — but earns no promotion, because the student was not asked to
 *     do the harder thing. Getting it wrong counts in full: failing an easier
 *     question is a clearer signal, not a weaker one.
 *   - at the rung or harder: counts both ways, which is the ordinary climb.
 *
 * `undefined` means the caller does not know what was asked, and the answer is
 * credited at the structure's current rung.
 */
export function promoteOrDemote(
  existing: StructureMastery | undefined,
  correct: boolean,
  asked?: Rung | null,
  config: LadderConfig = LADDER_CONFIG,
): Pick<StructureMastery, 'rung' | 'rungStreak' | 'rungMissStreak'> {
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (correct ? 1 : 0);
  // A graded answer means the structure has been met, whatever the row said —
  // true of a locate question too, which is why this precedes the null check.
  let rung: Rung = rungFor(existing, config);
  if (rung === 'flashcard') rung = 'mcq';

  if (asked === null) {
    return { rung, rungStreak: existing?.rungStreak ?? 0, rungMissStreak: existing?.rungMissStreak ?? 0 };
  }

  const at = RUNGS.indexOf(rung);
  const earnsCredit = asked === undefined || RUNGS.indexOf(asked) >= at;

  let rungStreak = existing?.rungStreak ?? 0;
  let rungMissStreak = existing?.rungMissStreak ?? 0;
  if (correct) {
    rungMissStreak = 0;
    if (earnsCredit) rungStreak += 1;
  } else {
    rungStreak = 0;
    rungMissStreak += 1;
  }

  if (
    correct &&
    earnsCredit &&
    rungStreak >= config.promotionStreak &&
    attemptsCorrect / attemptsTotal >= config.promotionAccuracy &&
    at < RUNGS.length - 1
  ) {
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
