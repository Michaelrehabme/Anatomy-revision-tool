import type { OinaPromptKind, QuestionType } from '../types/question';
import type { AnatomyStructure } from '../types/structure';
import { correctValuesFor } from './questionGenerators/oina';

/**
 * How many fact cards an uncapped session would hold, and across how many
 * structures: one card per fact a structure actually has. Muscles have all
 * four muscle facts; since 29 Sep 2026 bones, joints and ligaments have
 * blood-supply facts too, and a few structures have a primary artery but no
 * others — so this is counted, not multiplied.
 */
export function factCardCount(
  structures: readonly AnatomyStructure[],
  kinds: readonly OinaPromptKind[],
): { structures: number; cards: number } {
  let withFacts = 0;
  let cards = 0;
  for (const s of structures) {
    if (!s.eligibility.mcq) continue;
    const n = kinds.filter((k) => correctValuesFor(s, k).length > 0).length;
    if (n > 0) withFacts++;
    cards += n;
  }
  return { structures: withFacts, cards };
}

/**
 * Why a setup screen's Begin button is disabled when the pool is non-empty
 * but no question can be built from it. Null when there is nothing to
 * explain. The locate case gets its own sentence because it is the one a
 * student will hit: bones, landmarks and joints have no traced hotspots yet
 * (README, "Adding hotspots"), so Locate plus Bones is a dead end that the
 * old check — "is the pool non-empty?" — waved through.
 */
export function unbuildableSessionReason(params: {
  types: readonly QuestionType[];
  poolSize: number;
  available: number;
}): string | null {
  const { types, poolSize, available } = params;
  if (types.length === 0 || poolSize === 0 || available > 0) return null;
  if (types.every((t) => t === 'locate')) {
    return 'Locate questions need an image with traced hotspots, and bones, landmarks and joints do not have those yet. Add another format, or set the category to Muscles.';
  }
  if (types.every((t) => t === 'oina')) {
    return 'Nothing in this pool has the facts picked. Origin, insertion, nerve and action are muscles only, and landmarks have no blood supply questions. Widen the category, pick other facts, or add another format.';
  }
  return 'Nothing in this pool can be asked in these formats. Try adding a format or widening the category.';
}
