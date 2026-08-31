import type { StructureMastery } from '../types/attempt';

/**
 * Turns recorded per-structure performance into selection weights, so a
 * session spends its questions where they are worth spending.
 *
 * This is the read side of the same data lib/mastery.ts writes: mastery rows
 * carry attemptsTotal/attemptsCorrect (measured correctness) and the SM-2-lite
 * dueAt/intervalDays (self-rated confidence). Both feed the weight — measured
 * correctness decides how much a structure is worth revisiting at all, and the
 * review schedule decides whether now is the moment.
 *
 * Weights are relative, not probabilities: a structure with weight 4 is drawn
 * roughly four times as often as one with weight 1. Nothing is ever weighted to
 * zero — a well-known structure still surfaces occasionally, which is what stops
 * a long-running account from permanently retiring most of the dataset.
 */

/**
 * A structure with no attempt history. Above a well-known structure (needs
 * exposure) but below a recently-failed one (a known gap beats an unknown).
 */
export const UNSEEN_WEIGHT = 2;

/**
 * Ceiling on how much of a session the due-review queue may take. The rest is
 * drawn from the wider pool, so new material always gets in — without a cap the
 * queue is self-refilling and a daily user never meets a structure they did not
 * see on day one.
 */
export const REVIEW_SHARE = 0.6;

/** Weight range contributed by correctness: 100% correct -> 1, 0% correct -> 1 + this. */
const ACCURACY_SPREAD = 3;

/** Nothing drops below this, so every structure stays reachable. */
const MIN_WEIGHT = 0.05;

/** Overdue boost saturates here — a year overdue is no more urgent than a fortnight. */
const MAX_OVERDUE_DAYS = 14;

/** Multiplier for a structure reviewed just now, i.e. maximally far from due. */
const FRESHLY_REVIEWED_FACTOR = 0.25;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Laplace-smoothed accuracy: (correct + 1) / (total + 2).
 *
 * Smoothing matters here because early attempt counts are tiny — without it a
 * single lucky first answer reads as 100% mastered and buries the structure,
 * and a single unlucky one pins it to the top of every session for days.
 */
function smoothedAccuracy(mastery: StructureMastery): number {
  return (mastery.attemptsCorrect + 1) / (mastery.attemptsTotal + 2);
}

/**
 * How much the SM-2-lite review schedule wants this structure right now.
 * Returns 1 for a structure with no schedule yet (confidence never rated).
 */
function dueFactor(mastery: StructureMastery, now: Date): number {
  if (!mastery.dueAt) return 1;

  const dueAt = new Date(mastery.dueAt).getTime();
  if (Number.isNaN(dueAt)) return 1;

  const daysUntilDue = (dueAt - now.getTime()) / MS_PER_DAY;
  if (daysUntilDue <= 0) {
    const overdue = Math.min(-daysUntilDue, MAX_OVERDUE_DAYS);
    return 1 + overdue / MAX_OVERDUE_DAYS;
  }

  // Not yet due: damp towards FRESHLY_REVIEWED_FACTOR, easing back to ~1 as the
  // due date approaches. Measured against this structure's own interval, so a
  // 30-day interval is not treated as more urgent than a 2-day one at the same
  // absolute distance.
  const interval = Math.max(1, mastery.intervalDays ?? 1);
  const remaining = Math.min(1, daysUntilDue / interval);
  return FRESHLY_REVIEWED_FACTOR + (1 - FRESHLY_REVIEWED_FACTOR) * (1 - remaining);
}

/** Selection weight for one structure. `undefined` mastery means never attempted. */
export function structureWeight(mastery: StructureMastery | undefined, now: Date = new Date()): number {
  if (!mastery || mastery.attemptsTotal <= 0) return UNSEEN_WEIGHT;

  const accuracyFactor = 1 + (1 - smoothedAccuracy(mastery)) * ACCURACY_SPREAD;
  return Math.max(MIN_WEIGHT, accuracyFactor * dueFactor(mastery, now));
}

/**
 * Weight per structureId for a user's whole mastery set. Structures absent from
 * the map have never been attempted — callers should fall back to UNSEEN_WEIGHT.
 */
export function buildWeightMap(
  mastery: readonly StructureMastery[],
  now: Date = new Date(),
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of mastery) {
    weights.set(row.structureId, structureWeight(row, now));
  }
  return weights;
}
