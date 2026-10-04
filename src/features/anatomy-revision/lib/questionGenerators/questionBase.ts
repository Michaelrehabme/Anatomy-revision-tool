import { primaryAreaOf } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { PromptKind } from '../../types/question';

/**
 * The header every question carries: which structure it is about, and where
 * that structure sits.
 *
 * One function rather than the copy each generator used to keep. Seven
 * near-identical object literals were seven chances for a new header field to
 * reach six formats, and about 600 bytes of the entry chunk that bought
 * nothing — which is what paid for the vocabulary fallbacks added beside them
 * (sources.ts) without the chunk growing.
 *
 * It takes an index entry because everything in the header IS index data: a
 * question's header never states a fact, so it never needs one loaded.
 *
 * The key order is the order the generators wrote, and callers spread it where
 * their own literal used to sit, so a question serialises exactly as before.
 */
export function questionBase<K extends PromptKind>(structure: StructureIndexEntry, promptKind: K) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: primaryAreaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
  };
}
