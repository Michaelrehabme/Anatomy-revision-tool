import type { AnatomyStructure } from '../types/structure';
import { sample, type Rng } from './rng';

/**
 * Tiered anatomically-relevant distractor selection — an upgrade over the
 * old quiz.py prototype's flat random sampling. Each tier is tried in order
 * and results are merged (deduped) until `count` is reached, so distractors
 * favour the same subregion/group first and only fall back to "any other
 * structure" when the pool is too small (mirrors quiz.py's own fallback
 * behaviour for small pools).
 */
function tieredPool(correct: AnatomyStructure, all: AnatomyStructure[]): AnatomyStructure[][] {
  const others = all.filter((s) => s.id !== correct.id);
  const correctGroups = new Set(correct.groups ?? []);

  const sameSubregionAndGroup = others.filter(
    (s) =>
      s.subregion === correct.subregion &&
      (s.groups ?? []).some((g) => correctGroups.has(g)),
  );
  const sameRegionAndCategory = others.filter(
    (s) => s.region === correct.region && s.category === correct.category,
  );
  const sameCategory = others.filter((s) => s.category === correct.category);

  return [sameSubregionAndGroup, sameRegionAndCategory, sameCategory, others];
}

/** Picks `count` distractor structures (not values) for "which structure is X" questions. */
export function pickStructureDistractors(
  correct: AnatomyStructure,
  all: AnatomyStructure[],
  count: number,
  rng: Rng,
): AnatomyStructure[] {
  const picked = new Map<string, AnatomyStructure>();
  for (const tier of tieredPool(correct, all)) {
    if (picked.size >= count) break;
    const candidates = tier.filter((s) => !picked.has(s.id));
    for (const s of sample(candidates, count - picked.size, rng)) {
      picked.set(s.id, s);
    }
  }
  return [...picked.values()];
}

/** Picks `count` distractor name strings, convenience wrapper over pickStructureDistractors. */
export function pickNameDistractors(
  correct: AnatomyStructure,
  all: AnatomyStructure[],
  count: number,
  rng: Rng,
): string[] {
  return pickStructureDistractors(correct, all, count, rng).map((s) => s.name);
}

/**
 * Picks `count` distractor text values for a prose field (origin, insertion,
 * attachments, articulations), tiered the same way as pickNameDistractors,
 * joining multi-value fields with "; " to match the correct answer's format.
 */
export function pickTextFieldDistractors(
  correctValue: string,
  correct: AnatomyStructure,
  all: AnatomyStructure[],
  getField: (s: AnatomyStructure) => string[] | undefined,
  count: number,
  rng: Rng,
): string[] {
  const seen = new Set([correctValue]);
  const picked: string[] = [];

  for (const tier of tieredPool(correct, all)) {
    if (picked.length >= count) break;
    const candidateValues = tier
      .map((s) => getField(s)?.join('; '))
      .filter((v): v is string => !!v && !seen.has(v));
    const uniqueCandidates = [...new Set(candidateValues)];
    for (const v of sample(uniqueCandidates, count - picked.length, rng)) {
      picked.push(v);
      seen.add(v);
    }
  }
  return picked;
}

/**
 * Picks `count` distractor keys (nerve names / action tags) from a reverse
 * index, excluding the correct answer's own keys. Mirrors quiz.py's
 * distractors_nerve / distractors_action.
 */
export function pickKeyDistractors(
  correctKeys: string[],
  index: Map<string, string[]>,
  count: number,
  rng: Rng,
): string[] {
  const excluded = new Set(correctKeys);
  const candidates = [...index.keys()].filter((k) => !excluded.has(k));
  return sample(candidates, count, rng);
}
