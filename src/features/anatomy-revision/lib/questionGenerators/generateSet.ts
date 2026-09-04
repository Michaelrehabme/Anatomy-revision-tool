import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { OinaPromptKind, QuestionType, RevisionQuestion } from '../../types/question';
import type { Area, Region, SubRegion } from '../../types/region';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import { buildIndexes, filterStructures, type StructureIndexes } from '../indexes';
import { createRng, sample, shuffle, weightedShuffle, type Rng } from '../rng';
import { selectAdaptiveStructures, pickAdaptiveQuestionType } from '../adaptiveSelection';
import { buildWeightMap, UNSEEN_WEIGHT } from '../scheduling';
import { buildFlashcardQuestions, buildFieldFlashcard } from './flashcards';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';
import { buildFillBlankQuestions } from './fillBlank';
import { buildIdentifyTypedQuestions } from './identifyTyped';
import { buildMultiSelectQuestions } from './multiSelect';
import { buildClinicalQuestions } from './clinical';
import { buildOinaQuestions } from './oina';
import { indexFactMastery, shouldPrecedeWithLearnCard } from '../factMastery';
import { isOinaQuestion } from '../../types/question';

export interface RevisionSetConfig {
  types: readonly QuestionType[];
  region?: Region;
  /** OR-matched; takes precedence over `region` when non-empty. */
  regions?: Region[];
  subregion?: SubRegion;
  /** OR-matched against each structure's area (CR-017). Empty/undefined = all areas. */
  areas?: Area[];
  /** OR-matched against each structure's `groups` (CR-018) — how OINA sessions target "the hamstrings". */
  groups?: string[];
  category?: Category;
  difficulty?: Difficulty;
  /**
   * practice = every eligible question once (shuffled, or mastery-weighted — see
   * `mastery` below), optionally capped at `count`; assessment = a random sample
   * of `count`; adaptive = `count` structures blended ~70/30 weak-to-known by
   * mastery data, each escalated to the hardest requested question type its
   * mastery supports (CR-009).
   */
  mode: 'practice' | 'assessment' | 'adaptive';
  /** Assessment/adaptive: required, sampled without repeats. Practice: optional cap on the shuffled set; omit for every eligible question. */
  count?: number;
  /** Restrict to specific structure ids — used by RevisionResults' "retry incorrect". */
  structureIds?: string[];
  /**
   * Prefer these structures without restricting the session to them — the due
   * queue, typically. Capped at `reviewShare` so new material always has room:
   * answering a due structure reschedules it, so a hard restriction lets the
   * queue refill itself and nothing new is ever reachable. Ignored in adaptive
   * mode, which already weights due-ness across the whole pool.
   */
  priorityStructureIds?: string[];
  /** Ceiling on the share of the set drawn from `priorityStructureIds`. Defaults to REVIEW_SHARE. */
  reviewShare?: number;
  /** Fixed seed for deterministic/testable generation. Defaults to time-based. */
  seed?: number;
  /**
   * The user's recorded per-structure performance. In practice/assessment mode
   * it weights question order (see lib/scheduling.ts) so structures answered
   * wrong resurface sooner and well-known ones later — omit for a signed-out or
   * first-ever session to keep selection uniform. In adaptive mode it instead
   * drives selectAdaptiveStructures' weak/known blend (CR-009). generateSet
   * stays repository-free either way (CR-009 constraint) — the caller fetches
   * mastery and passes it in rather than this module reaching into
   * AnatomyRepository itself.
   */
  mastery?: readonly StructureMastery[];
  /** Reference time for due-date weighting / adaptive selection. Defaults to now. */
  now?: Date;
  /**
   * OINA only (CR-018). Same repository-free contract as `mastery`: the
   * caller fetches it and passes it in. Drives both the per-(muscle, fact)
   * select/typed escalation and whether a question is preceded by its
   * teaching flashcard. Omitted, every OINA question is select and every one
   * gets a learn card — which is the right behaviour for a new student.
   */
  factMastery?: FactMastery[];
  /** OINA only. Which of the four facts to ask about; omit for all four. */
  oinaPromptKinds?: readonly OinaPromptKind[];
  /** OINA only. Overrides the mastery-driven escalation with an explicit difficulty. */
  oinaForceFormat?: 'select' | 'typed';
  /**
   * OINA only. How many attempts at a fact are preceded by its teaching
   * flashcard; 0 turns them off. The student's own setting — see
   * lib/preferences.ts. Omitted, FACT_MASTERY_CONFIG's default applies.
   */
  learnCardAttempts?: number;
}

/**
 * Puts each OINA question's teaching flashcard immediately in front of it,
 * for facts the student is still learning or last got wrong.
 *
 * Runs after the shuffle/sample/slice below rather than inside the generator,
 * for two reasons: the pairing has to survive shuffling, and learn cards must
 * not consume the `count` budget — a 20-question session means 20 questions
 * to answer, plus however many cards are needed to teach them.
 */
function withLearnCards(
  questions: RevisionQuestion[],
  indexes: StructureIndexes,
  factMastery: readonly FactMastery[] | undefined,
  attempts: number | undefined,
): RevisionQuestion[] {
  if (attempts !== undefined && attempts <= 0) return questions;
  const masteryByKey = indexFactMastery(factMastery ?? []);
  const out: RevisionQuestion[] = [];
  for (const question of questions) {
    if (isOinaQuestion(question)) {
      const structure = indexes.byId.get(question.structureId);
      const fact = masteryByKey.get(`${question.structureId}__${question.promptKind}`);
      if (structure && shouldPrecedeWithLearnCard(fact, attempts)) {
        const card = buildFieldFlashcard(structure, question.promptKind);
        if (card) out.push(card);
      }
    }
    out.push(question);
  }
  return out;
}

/** Share of a session reserved for `priorityStructureIds` when enough of them exist. */
export const REVIEW_SHARE = 0.6;

/**
 * Caps the priority list's share of a session and fills the rest from the
 * wider pool, so priority and new material both get airtime.
 *
 * Restricting a session to the due queue outright — which is what passing those
 * ids as `structureIds` does — locks a daily user into whatever they saw first:
 * answering a due structure reschedules it, so the queue refills itself and no
 * new structure is ever reachable. Either side tops up when the other runs
 * short, so a thin queue on either side can't shrink the session.
 */
function blendPriorityWithRest(
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
  for (const question of ordered) (priority.has(question.structureId) ? due : rest).push(question);

  const fromDue = due.slice(0, Math.min(Math.round(count * share), due.length));
  const fromRest = rest.slice(0, count - fromDue.length);
  const topUp = due.slice(fromDue.length, fromDue.length + (count - fromDue.length - fromRest.length));
  return shuffle([...fromDue, ...fromRest, ...topUp], rng);
}

function generateOneQuestionForStructure(
  structure: AnatomyStructure,
  type: QuestionType,
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  rng: Rng,
  config?: RevisionSetConfig,
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
    case 'oina': {
      // OINA runs its own per-(muscle, fact) escalation, so the adaptive
      // ladder's per-structure accuracy has no say in the format here — it
      // only decides whether an OINA question is asked at all. A random one
      // of the requested facts, since the ladder wants one question per
      // structure, not four.
      const questions = buildOinaQuestions(pool, [...indexes.byId.values()], indexes, rng, {
        promptKinds: config?.oinaPromptKinds,
        factMastery: config?.factMastery,
        forceFormat: config?.oinaForceFormat,
      });
      return sample(questions, 1, rng)[0] ?? null;
    }
  }
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
    areas: config.areas,
    groups: config.groups,
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
        const question = generateOneQuestionForStructure(structure, type, relevantImages, indexes, rng, config);
        if (question) {
          adaptiveQuestions.push(question);
          break;
        }
      }
    }
    return withLearnCards(shuffle(adaptiveQuestions, rng), indexes, config.factMastery, config.learnCardAttempts);
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
  if (config.types.includes('oina')) {
    generated.push(
      ...buildOinaQuestions(pool, structures, indexes, rng, {
        promptKinds: config.oinaPromptKinds,
        factMastery: config.factMastery,
        forceFormat: config.oinaForceFormat,
      }),
    );
  }

  const weights = config.mastery?.length ? buildWeightMap(config.mastery, config.now) : null;
  const ordered = weights
    ? weightedShuffle(generated, (q) => weights.get(q.structureId) ?? UNSEEN_WEIGHT, rng)
    : shuffle(generated, rng);

  const count = config.mode === 'assessment' ? (config.count ?? generated.length) : config.count;
  const selected = !count
    ? ordered
    : config.priorityStructureIds?.length
      ? blendPriorityWithRest(ordered, config.priorityStructureIds, count, config.reviewShare, rng)
      : ordered.slice(0, count);

  // An exam tests rather than teaches, so it never gets a learn card (CR-018).
  if (config.mode === 'assessment') return selected;
  return withLearnCards(selected, indexes, config.factMastery, config.learnCardAttempts);
}
