import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { QuestionType, RevisionQuestion } from '../../types/question';
import type { Region, SubRegion } from '../../types/region';
import type { StructureMastery } from '../../types/attempt';
import { buildIndexes, filterStructures } from '../indexes';
import type { Rng } from '../rng';
import { createRng, shuffle, weightedShuffle } from '../rng';
import { buildWeightMap, REVIEW_SHARE, UNSEEN_WEIGHT } from '../scheduling';
import { buildFlashcardQuestions } from './flashcards';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';
import { buildFillBlankQuestions } from './fillBlank';
import { buildIdentifyTypedQuestions } from './identifyTyped';

export interface RevisionSetConfig {
  types: readonly QuestionType[];
  region?: Region;
  /** OR-matched; takes precedence over `region` when non-empty. */
  regions?: Region[];
  subregion?: SubRegion;
  category?: Category;
  difficulty?: Difficulty;
  /** practice = every eligible question once (shuffled), optionally capped at `count`; assessment = a random sample of `count`. */
  mode: 'practice' | 'assessment';
  /** Assessment: required, sampled with repeats-free randomness. Practice: optional cap on the shuffled set; omit for every eligible question. */
  count?: number;
  /** Restrict to specific structure ids — used by RevisionResults' "retry incorrect". */
  structureIds?: string[];
  /**
   * Structures the review schedule says are due. Unlike `structureIds` this is
   * a priority, not a restriction: they get at most `reviewShare` of the set and
   * the remainder is drawn from the wider pool, so a due queue can never crowd
   * out new material. Ignored without a `count` — an uncapped set contains
   * everything anyway.
   */
  priorityStructureIds?: string[];
  /** Ceiling on the share of the set drawn from `priorityStructureIds`. Defaults to REVIEW_SHARE. */
  reviewShare?: number;
  /** Fixed seed for deterministic/testable generation. Defaults to time-based. */
  seed?: number;
  /**
   * The user's recorded per-structure performance. When supplied, question
   * order is weighted by it (see lib/scheduling.ts) instead of being uniformly
   * random: structures answered wrong resurface sooner, well-known ones later.
   * Omit for a signed-out or first-ever session — selection stays uniform.
   */
  mastery?: readonly StructureMastery[];
  /** Reference time for the due-date side of the weighting. Defaults to now. */
  now?: Date;
}

/**
 * Filters structures by the given criteria, generates every requested
 * question type from them, and returns a shuffled (practice) or randomly
 * sampled (assessment) set — mirroring the old quiz.py's practice-vs-
 * assessment distinction.
 *
 * Pass `config.mastery` to order by measured correctness rather than uniformly;
 * generation stays deterministic under `config.seed` either way.
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
  if (config.types.includes('fill-blank')) {
    generated.push(...buildFillBlankQuestions(pool, rng));
  }
  if (config.types.includes('identify-typed')) {
    generated.push(...buildIdentifyTypedQuestions(pool, relevantImages));
  }

  // Both modes order the pool then take from the front; assessment differs only
  // in that `count` is expected rather than optional.
  const weights = config.mastery?.length ? buildWeightMap(config.mastery, config.now) : null;
  const ordered = weights
    ? weightedShuffle(generated, (q) => weights.get(q.structureId) ?? UNSEEN_WEIGHT, rng)
    : shuffle(generated, rng);

  if (!config.count) return ordered;
  if (!config.priorityStructureIds?.length) return ordered.slice(0, config.count);

  return blendReviewWithNew(ordered, config.priorityStructureIds, config.count, config.reviewShare, rng);
}

/**
 * Caps the due queue's share of a session and fills the rest from the wider
 * pool, so review and new material both get airtime.
 *
 * Restricting a session to the due queue outright — which is what passing those
 * ids as `structureIds` does — locks a daily user into whatever they saw first:
 * answering a due structure reschedules it, so the queue refills itself and no
 * new structure is ever reachable.
 *
 * Both halves keep the weighted order they arrived in; the result is reshuffled
 * so review questions aren't all bunched at the front.
 */
function blendReviewWithNew(
  ordered: RevisionQuestion[],
  priorityStructureIds: string[],
  count: number,
  reviewShare: number | undefined,
  rng: Rng,
): RevisionQuestion[] {
  const priority = new Set(priorityStructureIds);
  const share = Math.min(1, Math.max(0, reviewShare ?? REVIEW_SHARE));

  const due: RevisionQuestion[] = [];
  const rest: RevisionQuestion[] = [];
  for (const question of ordered) {
    (priority.has(question.structureId) ? due : rest).push(question);
  }

  const fromDue = due.slice(0, Math.min(Math.round(count * share), due.length));
  // Whatever the due queue could not fill goes to the wider pool, and vice
  // versa — a short pool on either side must not shrink the session.
  const fromRest = rest.slice(0, count - fromDue.length);
  const topUp = due.slice(fromDue.length, fromDue.length + (count - fromDue.length - fromRest.length));

  return shuffle([...fromDue, ...fromRest, ...topUp], rng);
}
