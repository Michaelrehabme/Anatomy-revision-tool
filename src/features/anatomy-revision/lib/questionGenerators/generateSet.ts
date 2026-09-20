import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { OinaPromptKind, QuestionType, RevisionQuestion } from '../../types/question';
import type { Area, Region, SubRegion } from '../../types/region';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import { buildIndexes, filterStructures, type StructureIndexes } from '../indexes';
import { areasOf } from '../../types/structure';
import { createRng, sample, shuffle, weightedShuffle, type Rng } from '../rng';
import { selectAdaptiveStructures, pickAdaptiveQuestionType } from '../adaptiveSelection';
import { buildWeightMap, UNSEEN_WEIGHT } from '../scheduling';
import { LADDER_TYPES, hintsForRung, questionTypeForRung, rungFor } from '../ladder';
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
  /**
   * THE PAYWALL, and the last line of it. Every area this person is entitled
   * to; questions are never generated outside it.
   *
   * Required rather than optional so that adding a new way to start a session
   * is a compile error until it says what the student may reach. The pickers
   * lock their chips too, but a lock on a picker is a lock on one door —
   * `structureIds` drills from the atlas and the progress screen never pass
   * `areas` at all, and would otherwise serve locked material happily.
   *
   * Pass AREAS for an unrestricted session (an educator preview, a test).
   */
  entitledAreas: readonly Area[];
  /** OR-matched against each structure's `groups` (CR-018) — how OINA sessions target "the hamstrings". */
  groups?: string[];
  category?: Category;
  /** OR-matched against each structure's category. Takes precedence over `category` when non-empty. */
  categories?: Category[];
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

/**
 * Deals a capped session evenly across the formats that were asked for.
 *
 * FORMATS DO NOT GENERATE AT THE SAME RATE, and shuffling the pool as one list
 * silently makes the session a vote on that. A muscle yields five MCQs and one
 * OINA card per fact, so "MCQ and OINA cards, twenty questions" came out twenty
 * MCQs and nothing else — which is the whole reason a student would pick two
 * formats. Locate and flashcards lose the same argument to MCQ for the same
 * reason.
 *
 * Interleaving before the cap rather than allocating quotas keeps the ordering
 * each type already earned — mastery weighting, the due queue — and lets a
 * short type run out without shrinking the session: the round robin simply
 * skips it, and whatever is left over goes to the formats that still have
 * material. The slice is shuffled afterwards so the session does not literally
 * alternate.
 */
function interleaveByType(
  ordered: RevisionQuestion[],
  types: readonly QuestionType[],
): RevisionQuestion[] {
  const queues = types
    .map((type) => ordered.filter((q) => q.type === type))
    .filter((queue) => queue.length > 0);
  // A question whose type was not requested — a clinical MCQ arrives as 'mcq',
  // but anything else would be dropped silently, so they go on the end.
  const dealt = new Set(queues.flat());
  const out: RevisionQuestion[] = [];
  for (let i = 0; out.length < dealt.size; i++) {
    const queue = queues[i % queues.length];
    const next = queue.shift();
    if (next) out.push(next);
  }
  return [...out, ...ordered.filter((q) => !dealt.has(q))];
}

/** Share of a session reserved for `priorityStructureIds` when enough of them exist. */
export const REVIEW_SHARE = 0.6;

/**
 * Reserves a share of the session for the priority list and fills the rest
 * from the wider pool, so due material and new material both get airtime.
 *
 * Restricting a session to the due queue outright — which is what passing those
 * ids as `structureIds` does — locks a daily user into whatever they saw first:
 * answering a due structure reschedules it, so the queue refills itself and no
 * new structure is ever reachable. Either side tops up when the other runs
 * short, so a thin queue on either side can't shrink the session.
 *
 * THE SHARE BUYS DISTINCT STRUCTURES, IN THE CALLER'S ORDER. The due pile used
 * to be sliced by question, and a structure asks several — MCQ, locate, typed,
 * four OINA facts — so one overdue muscle could take half the twelve due slots
 * while the tenth-most-overdue never appeared, and the session felt like it
 * was ignoring the review. The first pass takes one question per due
 * structure, walking the priority list in the order the caller gave it (Today
 * passes most-overdue first); only when every due structure has had its turn
 * do second questions fill what is left of the share.
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

  const byStructure = new Map<string, RevisionQuestion[]>();
  const rest: RevisionQuestion[] = [];
  for (const question of ordered) {
    if (!priority.has(question.structureId)) {
      rest.push(question);
      continue;
    }
    const queue = byStructure.get(question.structureId);
    if (queue) queue.push(question);
    else byStructure.set(question.structureId, [question]);
  }
  const rank = new Map(priorityStructureIds.map((id, i) => [id, i]));
  const structures = [...byStructure.keys()].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  const firstPass = structures.map((id) => byStructure.get(id)![0]);
  const secondPass = structures.flatMap((id) => byStructure.get(id)!.slice(1));
  const due = [...firstPass, ...secondPass];

  const fromDue = due.slice(0, Math.min(Math.round(count * share), due.length));
  const fromRest = rest.slice(0, count - fromDue.length);
  const topUp = due.slice(fromDue.length, fromDue.length + (count - fromDue.length - fromRest.length));
  return shuffle([...fromDue, ...fromRest, ...topUp], rng);
}

/**
 * Which name-recall format each structure is asked in a practice session
 * that knows the student: its rung on the difficulty ladder (lib/ladder.ts).
 *
 * Without the ladder a practice session builds every requested format for
 * every structure and shuffles, so a muscle met for the first time can open
 * as a typed question and one recalled perfectly for a month still arrives
 * as a flashcard. With mastery supplied and at least two ladder formats
 * requested, each structure gets the one format its rung calls for — a
 * flashcard when unseen, MCQ once met, typed with hints, then typed bare.
 * Locate, multi-select and OINA are outside the ladder and unchanged.
 *
 * Null (no ladder) when there is no mastery to climb by, or only one ladder
 * format was asked for — a session of only MCQs means MCQs.
 */
function ladderPlan(
  pool: AnatomyStructure[],
  config: RevisionSetConfig,
): { byType: Map<QuestionType, AnatomyStructure[]>; bare: Set<string> } | null {
  const requested = config.types.filter((t) => LADDER_TYPES.includes(t));
  if (config.mode !== 'practice' || !config.mastery || requested.length < 2) return null;
  const masteryById = new Map(config.mastery.map((m) => [m.structureId, m]));
  const byType = new Map<QuestionType, AnatomyStructure[]>();
  const bare = new Set<string>();
  for (const structure of pool) {
    const rung = rungFor(masteryById.get(structure.id));
    const type = questionTypeForRung(rung, requested);
    if (!type) continue;
    const list = byType.get(type);
    if (list) list.push(structure);
    else byType.set(type, [structure]);
    if (type === 'identify-typed' && hintsForRung(rung) === 'none') bare.add(structure.id);
  }
  return { byType, bare };
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
      return buildIdentifyTypedQuestions(pool, images, [...indexes.byId.values()])[0] ?? null;
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
 * Re-labels each question with the area the session actually asked for (CR-032).
 * A structure can belong to several areas — a pedicle revises under all three
 * spine levels and is stamped with the first of them by default — so in a session
 * filtered to the lumbar spine the header would otherwise contradict the chip the
 * user picked. A no-op for an unfiltered session, where the default already holds.
 */
export function stampRequestedArea(
  questions: RevisionQuestion[],
  byId: ReadonlyMap<string, AnatomyStructure>,
  requested: readonly Area[] | undefined,
): RevisionQuestion[] {
  if (!requested?.length) return questions;
  return questions.map((q) => {
    const structure = byId.get(q.structureId);
    const area = structure ? areasOf(structure).find((a) => requested.includes(a)) : undefined;
    return area && area !== q.area ? { ...q, area } : q;
  });
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

  // The requested areas, narrowed to the entitled ones. An unfiltered request
  // (no `areas`) becomes a request for everything the student may reach —
  // NOT for everything, which is what an empty area list means everywhere
  // else in this codebase and would hand the whole body to a free account.
  const askedFor = config.areas?.length ? config.areas : [...config.entitledAreas];
  const allowedAreas = askedFor.filter((a) => config.entitledAreas.includes(a));

  let pool = filterStructures(structures, {
    category: config.category,
    categories: config.categories,
    region: config.region,
    regions: config.regions,
    subregion: config.subregion,
    areas: allowedAreas,
    groups: config.groups,
    difficulty: config.difficulty,
  });
  if (config.structureIds?.length) {
    const allowed = new Set(config.structureIds);
    pool = pool.filter((s) => allowed.has(s.id));
  }
  // A second pass for the structureIds path above, which narrows the pool by
  // id and would otherwise smuggle in a locked structure: `areas` is usually
  // undefined on a drill, and a structure belongs to several areas.
  pool = pool.filter((s) => areasOf(s).some((a) => config.entitledAreas.includes(a)));

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
          adaptiveQuestions.push(
            question.type === 'identify-typed' ? { ...question, hints: hintsForRung(rungFor(mastery)) } : question,
          );
          break;
        }
      }
    }
    return stampRequestedArea(
      withLearnCards(shuffle(adaptiveQuestions, rng), indexes, config.factMastery, config.learnCardAttempts),
      indexes.byId,
      config.areas,
    );
  }

  const generated: RevisionQuestion[] = [];
  const ladder = ladderPlan(pool, config);
  const poolFor = (type: QuestionType) => (ladder ? (ladder.byType.get(type) ?? []) : config.types.includes(type) ? pool : []);

  const flashcardPool = poolFor('flashcard');
  if (flashcardPool.length) {
    generated.push(...buildFlashcardQuestions(flashcardPool, relevantImages));
  }
  const mcqPool = poolFor('mcq');
  if (mcqPool.length) {
    generated.push(...buildMcqQuestions(mcqPool, relevantImages, indexes, rng));
    // Clinical MCQs (CR-010) are just another mcq promptKind family, gated on the
    // structure actually having the relevant clinical field authored — same
    // convention as buildMcqQuestions itself generating several promptKinds at once.
    generated.push(...buildClinicalQuestions(mcqPool, rng));
  }
  if (config.types.includes('locate')) {
    generated.push(...buildLocateQuestions(pool, relevantImages));
  }
  const fillBlankPool = poolFor('fill-blank');
  if (fillBlankPool.length) {
    generated.push(...buildFillBlankQuestions(fillBlankPool, rng));
  }
  const typedPool = poolFor('identify-typed');
  if (typedPool.length) {
    generated.push(
      ...buildIdentifyTypedQuestions(typedPool, relevantImages, structures).map((q) =>
        ladder?.bare.has(q.structureId) ? { ...q, hints: 'none' as const } : q,
      ),
    );
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
  // Only a CAPPED session needs balancing — an uncapped one asks everything it
  // built, in whatever order the weighting chose.
  const balanced = count && config.types.length > 1 ? interleaveByType(ordered, config.types) : ordered;
  const selected = !count
    ? balanced
    : config.priorityStructureIds?.length
      ? blendPriorityWithRest(balanced, config.priorityStructureIds, count, config.reviewShare, rng)
      : shuffle(balanced.slice(0, count), rng);

  // An exam tests rather than teaches, so it never gets a learn card (CR-018).
  if (config.mode === 'assessment') return stampRequestedArea(selected, indexes.byId, config.areas);
  return stampRequestedArea(
    withLearnCards(selected, indexes, config.factMastery, config.learnCardAttempts),
    indexes.byId,
    config.areas,
  );
}
