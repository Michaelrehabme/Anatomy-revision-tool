import type { StructureMastery, Confidence } from '../types/attempt';
import { nextRecentAccuracy, promoteOrDemote, type Rung } from './ladder';

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const DURATION_EWMA_ALPHA = 0.3;
const LAPSE_INTERVAL_THRESHOLD_DAYS = 7;
const LEECH_THRESHOLD_LAPSES = 4;
const LEECH_INTERVAL_CAP_DAYS = 7;

/** The first step off a 1-day interval — what the buttons' "4 days" / "10 days" promise. */
const FIRST_INTERVAL_DAYS = { medium: 4, easy: 10 } as const;
/** Easy grows faster than Medium by this much on top of the ease factor. */
const EASY_BONUS = 1.3;
/**
 * The longest a structure can go unseen, however often it is rated Easy.
 * Compounding growth has no ceiling of its own — without one a well-known
 * muscle drifts out past the exam it was being revised for.
 */
export const MAX_INTERVAL_DAYS = 30;

/**
 * SM-2-lite: confidence rating drives a simplified spaced-repetition
 * schedule, suited to a 3-button confidence UI (easy/medium/hard).
 *
 * - "hard": resets the interval to 1 day and drops ease (floor MIN_EASE_FACTOR).
 * - "medium": 4 days off a 1-day interval, then grows by the ease factor.
 * - "easy": 10 days off a 1-day interval, then grows by ease × EASY_BONUS,
 *   and nudges ease up.
 *
 * Medium used to HOLD the interval, and every structure starts on 1 day — so
 * anything rated Medium came back every day however often it was answered
 * right, the due queue only grew, and it crowded new material out of the
 * daily review. Both non-Hard ratings now move a structure on; nothing goes
 * past MAX_INTERVAL_DAYS.
 */
export function computeNextReview(
  mastery: Pick<StructureMastery, 'intervalDays' | 'easeFactor'> | undefined,
  confidence: Confidence,
  now: Date = new Date(),
): { intervalDays: number; easeFactor: number; dueAt: string } {
  const easeFactor = mastery?.easeFactor ?? DEFAULT_EASE_FACTOR;
  const currentInterval = mastery?.intervalDays ?? 1;

  let nextInterval: number;
  let nextEase: number;

  switch (confidence) {
    case 'easy':
      nextInterval = currentInterval <= 1 ? FIRST_INTERVAL_DAYS.easy : Math.round(currentInterval * easeFactor * EASY_BONUS);
      nextEase = easeFactor + 0.15;
      break;
    case 'medium':
      nextInterval = currentInterval <= 1 ? FIRST_INTERVAL_DAYS.medium : Math.round(currentInterval * easeFactor);
      nextEase = easeFactor;
      break;
    case 'hard':
      nextInterval = 1;
      nextEase = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      break;
  }
  nextInterval = Math.min(MAX_INTERVAL_DAYS, nextInterval);

  const dueAt = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);
  return { intervalDays: nextInterval, easeFactor: nextEase, dueAt: dueAt.toISOString() };
}

/** Least share of a multi-part answer that counts as "mostly right" — see scheduleConfidence. */
export const PARTIAL_CREDIT_THRESHOLD = 0.5;

/**
 * What the schedule actually acts on, given the rating and the result.
 *
 * The rating used to be taken at its word, so a wrong answer rated Easy went
 * ten days out and a correct one rated Hard came back tomorrow. A wrong
 * answer now counts as Hard whatever was pressed — unless it was a
 * multi-part answer that was mostly right (two of three attachments), which
 * is a near miss rather than a blank and may count as Medium at most. A
 * correct answer keeps its rating: Hard on a correct answer is the student
 * saying it was a guess, and that is theirs to say.
 */
export function scheduleConfidence(correct: boolean, confidence: Confidence, partialCredit?: number): Confidence {
  if (correct) return confidence;
  if (partialCredit !== undefined && partialCredit >= PARTIAL_CREDIT_THRESHOLD) {
    return confidence === 'easy' ? 'medium' : confidence;
  }
  return 'hard';
}

/**
 * Derives a confidence rating from objective correctness and answer speed,
 * for question types (currently: fill-blank) that don't collect a self-rated
 * confidence. Explicit self-ratings always take priority over this — see
 * updateMasteryAfterAttempt.
 *
 * - incorrect -> 'hard', regardless of duration.
 * - correct but no duration/baseline to compare against yet -> 'medium'
 *   (can't judge "fast" with nothing to compare to, so don't guess 'easy').
 * - correct and faster than the structure's running duration baseline -> 'easy'.
 * - correct and at or slower than the baseline -> 'medium'.
 */
export function deriveImplicitConfidence(
  correct: boolean,
  durationMs: number | undefined,
  previousDurationEwmaMs: number | undefined,
): Confidence {
  if (!correct) return 'hard';
  if (durationMs === undefined || previousDurationEwmaMs === undefined) return 'medium';
  return durationMs < previousDurationEwmaMs ? 'easy' : 'medium';
}

/**
 * One review step on any scheduled row — a structure's naming row or one of
 * its fact rows — so the two can never drift apart in how they space things.
 * Lapses and the leech cap included.
 */
export function nextSchedule(
  existing: { intervalDays?: number; easeFactor?: number; lapses?: number } | undefined,
  correct: boolean,
  confidence: Confidence,
  now: Date = new Date(),
): { intervalDays: number; easeFactor: number; dueAt: string; lapses: number; isLeech: boolean } {
  // A lapse is a row that had earned a 7+ day interval and was then missed —
  // checked against the pre-attempt interval, since a miss always resets it.
  const hadLongInterval = (existing?.intervalDays ?? 0) >= LAPSE_INTERVAL_THRESHOLD_DAYS;
  const lapses = (existing?.lapses ?? 0) + (hadLongInterval && !correct ? 1 : 0);
  const isLeech = lapses >= LEECH_THRESHOLD_LAPSES;
  const { intervalDays, easeFactor, dueAt } = computeNextReview(existing, confidence, now);
  if (!isLeech || intervalDays <= LEECH_INTERVAL_CAP_DAYS) return { intervalDays, easeFactor, dueAt, lapses, isLeech };
  return {
    intervalDays: LEECH_INTERVAL_CAP_DAYS,
    easeFactor,
    dueAt: new Date(now.getTime() + LEECH_INTERVAL_CAP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    lapses,
    isLeech,
  };
}

export function updateMasteryAfterAttempt(
  existing: StructureMastery | undefined,
  params: {
    structureId: string;
    userId: string;
    correct: boolean;
    confidence?: Confidence;
    durationMs?: number;
    /**
     * Share of a multi-part answer that was right, 0-1 — multi-select and
     * OINA, where "wrong" can mean two of three. Softens how a wrong answer
     * is scheduled (scheduleConfidence); absent for single-answer formats.
     */
    partialCredit?: number;
    /**
     * The rung the question just answered asks at — `rungOfQuestion(type, hints)`.
     * null for a format outside the ladder (locate, multi-select, OINA), whose
     * answers move accuracy and the schedule but not the rung. Omitted, the
     * answer is credited at whatever rung the structure is already on.
     */
    askedRung?: Rung | null;
  },
  now: Date = new Date(),
): StructureMastery {
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (params.correct ? 1 : 0);

  const resolvedConfidence =
    params.confidence !== undefined
      ? scheduleConfidence(params.correct, params.confidence, params.partialCredit)
      : deriveImplicitConfidence(params.correct, params.durationMs, existing?.durationEwmaMs);

  // The duration baseline only exists to serve deriveImplicitConfidence, so
  // it's only updated on the implicit path — mixing in durations from
  // self-rated question types (very different interaction shapes) would make
  // "fast vs slow" meaningless.
  const durationEwmaMs =
    params.confidence !== undefined || params.durationMs === undefined
      ? existing?.durationEwmaMs
      : existing?.durationEwmaMs === undefined
        ? params.durationMs
        : DURATION_EWMA_ALPHA * params.durationMs + (1 - DURATION_EWMA_ALPHA) * existing.durationEwmaMs;

  const base: StructureMastery = {
    structureId: params.structureId,
    userId: params.userId,
    attemptsTotal,
    attemptsCorrect,
    lastAttemptAt: now.toISOString(),
    lastConfidence: params.confidence ?? existing?.lastConfidence,
    durationEwmaMs,
    firstSeenAt: existing?.firstSeenAt ?? now.toISOString(),
    recentAccuracy: nextRecentAccuracy(existing, params.correct),
    ...promoteOrDemote(existing, params.correct, params.askedRung),
  };

  return { ...base, ...nextSchedule(existing, params.correct, resolvedConfidence, now) };
}
