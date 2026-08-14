import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { QuestionType, RevisionQuestion } from '../../types/question';
import type { Region, SubRegion } from '../../types/region';
import { buildIndexes, filterStructures } from '../indexes';
import { createRng, sample, shuffle } from '../rng';
import { buildFlashcardQuestions } from './flashcards';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';

export interface RevisionSetConfig {
  types: readonly QuestionType[];
  region?: Region;
  subregion?: SubRegion;
  category?: Category;
  difficulty?: Difficulty;
  /** practice = every eligible question once (shuffled); assessment = a random sample of `count`. */
  mode: 'practice' | 'assessment';
  /** Required for 'assessment' mode; ignored in 'practice' mode. */
  count?: number;
  /** Restrict to specific structure ids — used by RevisionResults' "retry incorrect". */
  structureIds?: string[];
  /** Fixed seed for deterministic/testable generation. Defaults to time-based. */
  seed?: number;
}

/**
 * Filters structures by the given criteria, generates every requested
 * question type from them, and returns a shuffled (practice) or randomly
 * sampled (assessment) set — mirroring the old quiz.py's practice-vs-
 * assessment distinction.
 */
export function generateRevisionSet(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  config: RevisionSetConfig,
): RevisionQuestion[] {
  const rng = createRng(config.seed);

  let pool = filterStructures(structures, {
    category: config.category,
    region: config.region,
    subregion: config.subregion,
    difficulty: config.difficulty,
  });
  if (config.structureIds?.length) {
    const allowed = new Set(config.structureIds);
    pool = pool.filter((s) => allowed.has(s.id));
  }

  const indexes = buildIndexes(structures); // built over the FULL dataset so distractor pools stay rich
  const relevantImages = images.filter((img) => {
    if (img.mode === 'single-structure') return !!img.structureId && pool.some((s) => s.id === img.structureId);
    return (img.hotspots ?? []).some((h) => pool.some((s) => s.id === h.structureId));
  });

  const generated: RevisionQuestion[] = [];
  if (config.types.includes('flashcard')) {
    generated.push(...buildFlashcardQuestions(pool, relevantImages));
  }
  if (config.types.includes('mcq')) {
    generated.push(...buildMcqQuestions(pool, relevantImages, indexes, rng));
  }
  if (config.types.includes('locate')) {
    generated.push(...buildLocateQuestions(pool, relevantImages));
  }

  if (config.mode === 'assessment') {
    return sample(generated, config.count ?? generated.length, rng);
  }
  return shuffle(generated, rng);
}
