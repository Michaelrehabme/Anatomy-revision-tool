import type { QuestionType } from '../types/question';

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
    return 'OINA cards cover origin, insertion, nerve and action, which only muscles have. Set the category to Muscles or All, or add another format.';
  }
  return 'Nothing in this pool can be asked in these formats. Try adding a format or widening the category.';
}
