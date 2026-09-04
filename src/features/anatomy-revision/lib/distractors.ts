import type { AnatomyStructure } from '../types/structure';
import { sample, type Rng } from './rng';

/**
 * Tiered anatomically-relevant distractor selection — an upgrade over the
 * old quiz.py prototype's flat random sampling. Each tier is tried in order
 * and results are merged (deduped) until `count` is reached, so distractors
 * favour the same subregion/group first and only fall back to "any other
 * structure" when the pool is too small (mirrors quiz.py's own fallback
 * behaviour for small pools).
 *
 * The shared-group tier (CR-018) sits second because a distractor from
 * outside the muscle group is answerable without knowing the anatomy: asked
 * for the nerve supply of a hamstring, "Median nerve" is eliminable on the
 * grounds that it belongs to the arm. Tier one is still narrower — same
 * subregion AND a shared group — so the closest neighbours are preferred.
 */
function tieredPool(correct: AnatomyStructure, all: AnatomyStructure[]): AnatomyStructure[][] {
  const others = all.filter((s) => s.id !== correct.id);
  const correctGroups = new Set(correct.groups ?? []);

  const sharesGroup = (s: AnatomyStructure) => (s.groups ?? []).some((g) => correctGroups.has(g));
  const sameSubregionAndGroup = others.filter((s) => s.subregion === correct.subregion && sharesGroup(s));
  const sameGroup = others.filter(sharesGroup);
  const sameRegionAndCategory = others.filter(
    (s) => s.region === correct.region && s.category === correct.category,
  );
  const sameCategory = others.filter((s) => s.category === correct.category);

  return [sameSubregionAndGroup, sameGroup, sameRegionAndCategory, sameCategory, others];
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
 * Like pickTextFieldDistractors, but treats each authored value as its own
 * candidate rather than joining a structure's whole field into one string —
 * what OINA's per-item select-all questions need (CR-018).
 *
 * `reject` filters candidates that name the same site as one of the correct
 * answers in different words; without it, "Greater trochanter" appears as a
 * distractor against "Greater trochanter of the femur" and the question has
 * two right answers, only one of which counts.
 */
export function pickItemDistractors(
  correctValues: string[],
  correct: AnatomyStructure,
  all: AnatomyStructure[],
  getField: (s: AnatomyStructure) => string[] | undefined,
  normalizeValue: (value: string) => string,
  count: number,
  rng: Rng,
  reject: (correctValue: string, candidate: string) => boolean,
): string[] {
  const picked: string[] = [];
  const seen = new Set(correctValues);
  const usable = (value: string) =>
    !seen.has(value) && !correctValues.some((correctValue) => reject(correctValue, value));

  for (const tier of tieredPool(correct, all)) {
    if (picked.length >= count) break;
    const candidates = new Set<string>();
    for (const s of tier) {
      for (const raw of getField(s) ?? []) {
        const value = normalizeValue(raw);
        if (value && usable(value)) candidates.add(value);
      }
    }
    for (const value of sample([...candidates], count - picked.length, rng)) {
      picked.push(value);
      seen.add(value);
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

/**
 * Picks `count` distractor keys (nerve names, action tags) drawn from the
 * muscles nearest the one being asked about, rather than from the whole
 * dataset (CR-018).
 *
 * Sampling a reverse index globally is what the pre-OINA generators did, and
 * it makes a question answerable without the anatomy: "what nerve innervates
 * biceps femoris" offering the median nerve can be eliminated on region
 * alone. Tiering by the same pool as every other distractor keeps the
 * alternatives inside the group the question is about, so the student has to
 * actually know which of the neighbouring nerves it is.
 */
export function pickTieredKeyDistractors(
  correctKeys: string[],
  correct: AnatomyStructure,
  all: AnatomyStructure[],
  keysOf: (s: AnatomyStructure) => string[],
  count: number,
  rng: Rng,
  reject: (correctKey: string, candidate: string) => boolean,
): string[] {
  const picked: string[] = [];
  const seen = new Set(correctKeys);
  const usable = (key: string) => !seen.has(key) && !correctKeys.some((correctKey) => reject(correctKey, key));

  for (const tier of tieredPool(correct, all)) {
    if (picked.length >= count) break;
    const candidates = new Set<string>();
    for (const s of tier) {
      for (const key of keysOf(s)) {
        if (key && usable(key)) candidates.add(key);
      }
    }
    for (const key of sample([...candidates], count - picked.length, rng)) {
      picked.push(key);
      seen.add(key);
    }
  }
  return picked;
}
