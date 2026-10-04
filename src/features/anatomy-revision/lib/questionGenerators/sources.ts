import type { AnatomyStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { DistractorVocabulary } from '../../data/content/vocabulary';

/**
 * What the generators may draw on beyond the structures whose facts are
 * loaded (docs/DESIGN-CONTENT-BEHIND-SERVER.md, "Distractors").
 *
 * A generator is handed the structures it has facts for. Once facts are
 * served per area that is no longer every structure, and two things a
 * question needs lie outside it:
 *
 * NAMES. A wrist ligament attaches to the radius, and the radius is an elbow
 * bone. A student holding the wrist alone must still be asked for "Radius" and
 * be offered other bones as wrong answers, so names come from the index, which
 * holds every structure and is bundled.
 *
 * WRONG ANSWERS FROM ELSEWHERE. Where a generator's pool was "this value across
 * the whole dataset" — every nerve, every action, every artery outside the
 * structure's own areas — the vocabulary stands in for the part of the dataset
 * that is not loaded (data/content/vocabulary.ts).
 *
 * Omitted, the loaded structures are taken to be all there are, which is the
 * case for as long as the seed is bundled.
 */
export interface DistractorSources {
  /** Every structure, with or without its facts. */
  index: readonly StructureIndexEntry[];
  vocabulary?: DistractorVocabulary;
}

/**
 * The vocabulary, IF anything is missing for it to stand in for.
 *
 * With every structure's facts loaded the vocabulary holds nothing those facts
 * do not, so it is not consulted at all — which is what keeps a session built
 * from the bundled seed exactly what it was before the vocabulary existed, and
 * a fully entitled student's questions drawn from real neighbours rather than
 * from a list.
 */
export function vocabularyWhenPartial(
  loaded: readonly AnatomyStructure[],
  sources: DistractorSources | undefined,
): DistractorVocabulary | undefined {
  return sources && sources.index.length > loaded.length ? sources.vocabulary : undefined;
}
