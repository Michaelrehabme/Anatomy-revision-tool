import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { QuestionType, RevisionQuestion } from '../../types/question';
import type { Region, SubRegion } from '../../types/region';
import type { StructureMastery } from '../../types/attempt';
import { buildIndexes, filterStructures, type StructureIndexes } from '../indexes';
import { createRng, sample, shuffle, type Rng } from '../rng';
import { selectAdaptiveStructures, pickAdaptiveQuestionType } from '../adaptiveSelection';
import { buildFlashcardQuestions } from './flashcards';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';
import { buildFillBlankQuestions } from './fillBlank';
import { buildIdentifyTypedQuestions } from './identifyTyped';
import { buildMultiSelectQuestions } from './multiSelect';
import { buildClinicalQuestions } from './clinical';

export interface RevisionSetConfig {
  types: readonly QuestionType[];
  region?: Region;
  /** OR-matched; takes precedence over `region` when non-empty. */
  regions?: Region[];
  subregion?: SubRegion;
  category?: Category;
  difficulty?: Difficulty;
  /**
   * practice = every eligible question once (shuffled), optionally capped at
   * `count`; assessment = a random sample of `count`; adaptive = `count`
   * structures blended ~70/30 weak-to-known by mastery data, each escalated
   * to the hardest requested question type its mastery supports (CR-009).
   */
  mode: 'practice' | 'assessment' | 'adaptive';
  /** Assessment/adaptive: required, sampled without repeats. Practice: optional cap on the shuffled set; omit for every eligible question. */
  count?: number;
  /** Restrict to specific structure ids — used by RevisionResults' "retry incorrect". */
  structureIds?: string[];
  /** Fixed seed for deterministic/testable generation. Defaults to time-based. */
  seed?: number;
  /**
   * Adaptive mode only. generateSet stays repository-free (CR-009 constraint)
   * — the caller fetches mastery and passes it in rather than this module
   * reaching into AnatomyRepository itself.
   */
  mastery?: StructureMastery[];
  /** Adaptive mode only. Injectable for deterministic tests; defaults to real time. */
  now?: Date;
}

function generateOneQuestionForStructure(
  structure: AnatomyStructure,
  type: QuestionType,
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  rng: Rng,
): RevisionQuestion | null {
  const pool = [structure];
  switch (type) {
    case 'flashcard':
      return buildFlashcardQuestions(pool, images)[0] ?? null;
    case 'mcq':
      return buildMcqQuestions(pool, images, indexes, rng)[0] ?? buildClinicalQuestions(pool, rng)[0] ?? null;
    case 'locate':
      return buildLocateQuestions(pool, images)[0] ?? null;
    case 'fill-blank':
      return buildFillBlankQuestions(pool, rng)[0] ?? null;
    case 'identify-typed':
      return buildIdentifyTypedQuestions(pool, images)[0] ?? null;
    case 'multi-select':
      // Multi-select is inherently a "compare several structures" question, not a
      // per-structure one — it doesn't fit the adaptive escalation ladder's shape.
      return null;
  }
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
    regions: config.regions,
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

  if (config.mode === 'adaptive') {
    const masteryByStructureId = new Map((config.mastery ?? []).map((m) => [m.structureId, m]));
    const desiredCount = config.count ?? pool.length;
    const selected = selectAdaptiveStructures(pool, masteryByStructureId, desiredCount, rng, config.now ?? new Date());

    const adaptiveQuestions: RevisionQuestion[] = [];
    for (const structure of selected) {
      const mastery = masteryByStructureId.get(structure.id);
      const preferredType = pickAdaptiveQuestionType(mastery, config.types);
      if (!preferredType) continue;
      const orderedTypes = [preferredType, ...config.types.filter((t) => t !== preferredType)];
      for (const type of orderedTypes) {
        const question = generateOneQuestionForStructure(structure, type, relevantImages, indexes, rng);
        if (question) {
          adaptiveQuestions.push(question);
          break;
        }
      }
    }
    return shuffle(adaptiveQuestions, rng);
  }

  const generated: RevisionQuestion[] = [];
  if (config.types.includes('flashcard')) {
    generated.push(...buildFlashcardQuestions(pool, relevantImages));
  }
  if (config.types.includes('mcq')) {
    generated.push(...buildMcqQuestions(pool, relevantImages, indexes, rng));
    // Clinical MCQs (CR-010) are just another mcq promptKind family, gated on the
    // structure actually having the relevant clinical field authored — same
    // convention as buildMcqQuestions itself generating several promptKinds at once.
    generated.push(...buildClinicalQuestions(pool, rng));
  }
  if (config.types.includes('locate')) {
    generated.push(...buildLocateQuestions(pool, relevantImages));
  }
  if (config.types.includes('fill-blank')) {
    generated.push(...buildFillBlankQuestions(pool, rng));
  }
  if (config.types.includes('identify-typed')) {
    generated.push(...buildIdentifyTypedQuestions(pool, relevantImages));
  }
  if (config.types.includes('multi-select')) {
    generated.push(...buildMultiSelectQuestions(pool, indexes, rng));
  }

  if (config.mode === 'assessment') {
    return sample(generated, config.count ?? generated.length, rng);
  }
  const shuffled = shuffle(generated, rng);
  return config.count ? shuffled.slice(0, config.count) : shuffled;
}
