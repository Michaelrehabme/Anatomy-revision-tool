import type { StructureMastery, Confidence } from '../types/attempt';

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const DURATION_EWMA_ALPHA = 0.3;
const LAPSE_INTERVAL_THRESHOLD_DAYS = 7;
const LEECH_THRESHOLD_LAPSES = 4;
const LEECH_INTERVAL_CAP_DAYS = 7;

/**
 * SM-2-lite: confidence rating drives a simplified spaced-repetition
 * schedule. This intentionally does not implement full SM-2 (no quality
 * 0-5 scale, no per-attempt streak) — it's a lightweight approximation
 * suited to a 3-button confidence UI (easy/medium/hard).
 *
 * - "easy": grows the interval by the ease factor and nudges ease up.
 * - "medium": holds the interval steady, ease unchanged.
 * - "hard": resets the interval to 1 day and drops ease (floor MIN_EASE_FACTOR).
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
      nextInterval = Math.max(1, Math.round(currentInterval * easeFactor));
      nextEase = easeFactor + 0.15;
      break;
    case 'medium':
      nextInterval = Math.max(1, currentInterval);
      nextEase = easeFactor;
      break;
    case 'hard':
      nextInterval = 1;
      nextEase = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      break;
  }

  const dueAt = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000);
  return { intervalDays: nextInterval, easeFactor: nextEase, dueAt: dueAt.toISOString() };
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

export function updateMasteryAfterAttempt(
  existing: StructureMastery | undefined,
  params: { structureId: string; userId: string; correct: boolean; confidence?: Confidence; durationMs?: number },
  now: Date = new Date(),
): StructureMastery {
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (params.correct ? 1 : 0);

  // A lapse is a structure that had earned a 7+ day interval through prior
  // good performance, then got answered wrong — checked against the
  // pre-attempt interval, since an incorrect answer always resets the
  // interval to 1 (so checking the post-attempt interval could never fire).
  const hadLongInterval = (existing?.intervalDays ?? 0) >= LAPSE_INTERVAL_THRESHOLD_DAYS;
  const lapses = (existing?.lapses ?? 0) + (hadLongInterval && !params.correct ? 1 : 0);
  const isLeech = lapses >= LEECH_THRESHOLD_LAPSES;

  const resolvedConfidence = params.confidence ?? deriveImplicitConfidence(params.correct, params.durationMs, existing?.durationEwmaMs);

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
    lapses,
    isLeech,
    durationEwmaMs,
  };

  const { intervalDays, easeFactor, dueAt } = computeNextReview(existing, resolvedConfidence, now);
  const cappedIntervalDays = isLeech ? Math.min(intervalDays, LEECH_INTERVAL_CAP_DAYS) : intervalDays;
  const cappedDueAt =
    cappedIntervalDays === intervalDays
      ? dueAt
      : new Date(now.getTime() + cappedIntervalDays * 24 * 60 * 60 * 1000).toISOString();

  return { ...base, intervalDays: cappedIntervalDays, easeFactor, dueAt: cappedDueAt };
}
