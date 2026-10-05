import type { Confidence, FactMastery } from '../types/attempt';
import type { FactKind, PromptKind, QuestionType } from '../types/question';
import { MUSCLE_FACT_KINDS, OINA_PROMPT_KINDS } from '../types/question';
import { nextSchedule, scheduleConfidence } from './mastery';
import type { BloodSupply } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';

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
export function requiredFactKinds(structure: StructureIndexEntry): FactKind[] {
  // An index entry whose facts are not on the device carries the answer,
  // worked out by this same function when the index was cut (split.ts). A full
  // structure has no such field and is read from its facts, below.
  if (structure.factKinds) return [...structure.factKinds];
  const kinds: FactKind[] = structure.category === 'muscle' ? [...MUSCLE_FACT_KINDS] : [];
  const supply = (structure as { bloodSupply?: BloodSupply }).bloodSupply;
  const b = structure.category === 'landmark' ? undefined : supply;
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
  structure: StructureIndexEntry,
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
  /** The student's rating; absent, a right answer counts as Medium and a wrong one as Hard. */
  confidence?: Confidence;
  /** Share of a multi-part answer that was right — softens a near miss (scheduleConfidence). */
  partialCredit?: number;
  /**
   * The stage the question asked at: 'select' for an OINA select or a plain
   * MCQ on the fact, the typed stages for typed OINA. An answer asked BELOW
   * the fact's stage schedules it but earns no promotion — the naming
   * ladder's askedRung rule. Omitted, it is credited at the current stage.
   */
  askedStage?: FactStage;
  now?: Date;
}

const STAGES: readonly FactStage[] = ['select', 'typed-hinted', 'typed-bare'];

/** Kinds with typed forms, which climb select → typed with hints → typed without. The rest are multiple choice only. */
export function isStagedFactKind(kind: FactKind): boolean {
  return (OINA_PROMPT_KINDS as readonly string[]).includes(kind);
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far out a fact row from before facts were scheduled is read as due, by stage. */
const LEGACY_FACT_INTERVAL_DAYS: Record<FactStage, number> = { select: 1, 'typed-hinted': 4, 'typed-bare': 10 };

/**
 * When a fact is next due. A row written before facts had their own schedule
 * (2 Oct 2026) has none; reading those as due now would put every fact ever
 * answered into one day's review, so they are spaced from their last answer
 * by the stage they reached.
 */
export function factDueAt(fact: FactMastery): string {
  if (fact.dueAt) return fact.dueAt;
  const days = LEGACY_FACT_INTERVAL_DAYS[factStage(fact)];
  return new Date(new Date(fact.lastAttemptAt).getTime() + days * DAY_MS).toISOString();
}

/** The interval a fact is on, legacy rows included. */
export function factIntervalDays(fact: FactMastery): number {
  return fact.intervalDays ?? LEGACY_FACT_INTERVAL_DAYS[factStage(fact)];
}

/**
 * Folds one answer into a fact's progress: its stage (OINA kinds only) and,
 * since 2 Oct 2026, its own review schedule.
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
  const accuracy = attemptsCorrect / attemptsTotal;

  const before = factStage(existing);
  const earnsCredit = input.askedStage === undefined || STAGES.indexOf(input.askedStage) >= STAGES.indexOf(before);
  // Right is right, so a correct easier answer clears the miss streak; it just
  // doesn't count towards climbing. A miss counts in full either way.
  let streak = input.correct ? (existing?.streak ?? 0) + (earnsCredit ? 1 : 0) : 0;
  const missStreak = input.correct ? 0 : (existing?.missStreak ?? 0) + 1;

  let stage = before;
  // Multiple-choice-only kinds ("how rich", the clinical and joint questions)
  // just count their streak. The OINA kinds climb the three stages.
  if (isStagedFactKind(input.promptKind)) {
    if (missStreak >= config.demotionStreak && before !== 'select') {
      stage = before === 'typed-bare' ? 'typed-hinted' : 'select';
    } else if (input.correct && earnsCredit && streak >= config.promotionStreak && before !== 'typed-bare') {
      if (before === 'typed-hinted' || accuracy >= config.promotionAccuracy) {
        stage = before === 'select' ? 'typed-hinted' : 'typed-bare';
      }
    }
  }
  // A change of stage in either direction starts the streak again: each
  // stage is earned AT that stage, as on the naming ladder.
  if (stage !== before) streak = 0;

  const confidence =
    input.confidence !== undefined
      ? scheduleConfidence(input.correct, input.confidence, input.partialCredit)
      : input.correct
        ? 'medium'
        : 'hard';
  // A legacy row's schedule is read the way factDueAt reads it, so its first
  // new answer grows from the interval it was already treated as being on.
  const previous = existing ? { ...existing, intervalDays: factIntervalDays(existing) } : undefined;
  const { intervalDays, easeFactor, dueAt, lapses } = nextSchedule(previous, input.correct, confidence, now);

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
    dueAt,
    intervalDays,
    easeFactor,
    lapses,
    lastConfidence: input.confidence ?? existing?.lastConfidence,
  };
}

/**
 * Which question type an answer belongs to (2 Oct 2026). Naming — a
 * flashcard, a locate tap, any question asking for the structure itself — is
 * the structure's own ladder and schedule; every other kind is a fact with
 * its own row, whatever format asked it, so "the origin of deltoid" as an MCQ
 * and as OINA move the same origin row.
 */
export function skillOf(type: QuestionType, promptKind: PromptKind): 'identify' | FactKind {
  if (type === 'flashcard' || type === 'locate' || promptKind === 'identify') return 'identify';
  return promptKind;
}
