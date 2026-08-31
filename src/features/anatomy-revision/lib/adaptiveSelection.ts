import type { StructureMastery } from '../types/attempt';
import type { QuestionType } from '../types/question';
import type { Rng } from './rng';
import { shuffle } from './rng';

/**
 * All adaptive-selection tuning in one place, per CR-009 ("roughly 70/30
 * weak to known, tunable in one place").
 */
export const ADAPTIVE_CONFIG = {
  /** Fraction of a session drawn from the weak/due bucket; the rest comes from well-known structures. */
  weakRatio: 0.7,
  /** Flat multiplier applied to a leech's weight — surfaced more, not exclusively. */
  leechWeightMultiplier: 1.5,
  /** A structure answered within this many minutes ago is heavily downweighted, to avoid immediate repeats. */
  recentAnswerPenaltyMinutes: 30,
  recentAnswerPenaltyFactor: 0.1,
  /** Overdue-ness stops adding weight past this many days — a structure overdue by a year isn't 50x more urgent than one overdue by a week. */
  overdueDaysCap: 5,
  accuracyWeightScale: 3,
};

type AdaptiveConfig = typeof ADAPTIVE_CONFIG;

/** Higher = more urgently needs practice. Never-attempted structures get a neutral baseline weight of 1. */
export function adaptiveWeight(mastery: StructureMastery | undefined, now: Date, config: AdaptiveConfig = ADAPTIVE_CONFIG): number {
  if (!mastery) return 1;
  let weight = 1;

  if (mastery.dueAt) {
    const overdueDays = (now.getTime() - Date.parse(mastery.dueAt)) / 86_400_000;
    if (overdueDays > 0) weight += Math.min(config.overdueDaysCap, overdueDays);
  }

  if (mastery.attemptsTotal > 0) {
    const accuracy = mastery.attemptsCorrect / mastery.attemptsTotal;
    weight += (1 - accuracy) * config.accuracyWeightScale;
  }

  if (mastery.isLeech) weight *= config.leechWeightMultiplier;

  if (mastery.lastAttemptAt) {
    const minutesSince = (now.getTime() - Date.parse(mastery.lastAttemptAt)) / 60_000;
    if (minutesSince >= 0 && minutesSince < config.recentAnswerPenaltyMinutes) weight *= config.recentAnswerPenaltyFactor;
  }

  return Math.max(0.01, weight);
}

/** The "known" side of the 70/30 blend: attempted, accurate, not overdue, not a leech. Never-attempted structures are never "known". */
export function isWellKnown(mastery: StructureMastery | undefined, now: Date): boolean {
  if (!mastery || mastery.attemptsTotal === 0) return false;
  const accuracy = mastery.attemptsCorrect / mastery.attemptsTotal;
  const overdue = mastery.dueAt !== undefined && Date.parse(mastery.dueAt) < now.getTime();
  return accuracy >= 0.8 && !overdue && !mastery.isLeech;
}

/** Weighted sampling without replacement (repeatedly pick-and-remove, renormalizing over what's left). */
function weightedSampleWithoutReplacement<T>(items: T[], weights: number[], count: number, rng: Rng): T[] {
  const pool = items.map((item, i) => ({ item, weight: weights[i] }));
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    picked.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return picked;
}

/**
 * Picks `count` structures blended ~70/30 weak-to-known (see ADAPTIVE_CONFIG),
 * weighted within each bucket by due-ness/accuracy/leech/recency. A session
 * that's only weaknesses is demoralising, per CR-009 — the known bucket is a
 * deliberate, guaranteed slice, not left to emerge from weighting alone.
 */
export function selectAdaptiveStructures<T extends { id: string }>(
  structures: T[],
  masteryByStructureId: Map<string, StructureMastery>,
  count: number,
  rng: Rng,
  now: Date = new Date(),
  config: AdaptiveConfig = ADAPTIVE_CONFIG,
): T[] {
  const weak: T[] = [];
  const known: T[] = [];
  for (const s of structures) {
    (isWellKnown(masteryByStructureId.get(s.id), now) ? known : weak).push(s);
  }

  const weakTarget = Math.round(count * config.weakRatio);
  const knownTarget = count - weakTarget;

  const pickedWeak = weightedSampleWithoutReplacement(
    weak,
    weak.map((s) => adaptiveWeight(masteryByStructureId.get(s.id), now, config)),
    weakTarget,
    rng,
  );
  const pickedKnown = weightedSampleWithoutReplacement(
    known,
    known.map((s) => adaptiveWeight(masteryByStructureId.get(s.id), now, config)),
    knownTarget,
    rng,
  );

  let combined = [...pickedWeak, ...pickedKnown];
  if (combined.length < count) {
    // One bucket ran short (e.g. almost nothing is "known" yet) — backfill from whatever's left over.
    const usedIds = new Set(combined.map((s) => s.id));
    const leftover = structures.filter((s) => !usedIds.has(s.id));
    const leftoverPicked = weightedSampleWithoutReplacement(
      leftover,
      leftover.map((s) => adaptiveWeight(masteryByStructureId.get(s.id), now, config)),
      count - combined.length,
      rng,
    );
    combined = combined.concat(leftoverPicked);
  }

  return shuffle(combined, rng); // undo the weak-then-known concatenation order
}

/**
 * Escalates retrieval demand with mastery: recognition (mcq) first, then
 * cued recall (fill-blank), then free recall (identify-typed) — per CR-009.
 * Falls back down the ladder to whatever the session actually requested.
 */
export function pickAdaptiveQuestionType(
  mastery: StructureMastery | undefined,
  requestedTypes: readonly QuestionType[],
): QuestionType | null {
  const accuracy = mastery && mastery.attemptsTotal > 0 ? mastery.attemptsCorrect / mastery.attemptsTotal : 0;
  const ladder: QuestionType[] =
    accuracy >= 0.85
      ? ['identify-typed', 'fill-blank', 'mcq', 'flashcard', 'locate']
      : accuracy >= 0.6
        ? ['fill-blank', 'mcq', 'identify-typed', 'flashcard', 'locate']
        : ['mcq', 'flashcard', 'locate', 'fill-blank', 'identify-typed'];

  return ladder.find((t) => requestedTypes.includes(t)) ?? requestedTypes[0] ?? null;
}
