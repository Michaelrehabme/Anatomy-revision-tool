import type { StructureMastery, Confidence } from '../types/attempt';

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

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

export function updateMasteryAfterAttempt(
  existing: StructureMastery | undefined,
  params: { structureId: string; userId: string; correct: boolean; confidence?: Confidence },
  now: Date = new Date(),
): StructureMastery {
  const attemptsTotal = (existing?.attemptsTotal ?? 0) + 1;
  const attemptsCorrect = (existing?.attemptsCorrect ?? 0) + (params.correct ? 1 : 0);

  const base: StructureMastery = {
    structureId: params.structureId,
    userId: params.userId,
    attemptsTotal,
    attemptsCorrect,
    lastAttemptAt: now.toISOString(),
    lastConfidence: params.confidence ?? existing?.lastConfidence,
  };

  if (!params.confidence) {
    return { ...existing, ...base, intervalDays: existing?.intervalDays, easeFactor: existing?.easeFactor };
  }

  const { intervalDays, easeFactor, dueAt } = computeNextReview(existing, params.confidence, now);
  return { ...base, intervalDays, easeFactor, dueAt };
}
