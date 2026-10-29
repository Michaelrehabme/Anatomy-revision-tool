import { ownPictureOf } from './promptImages';
import type { AnatomyStructure, Category, Difficulty } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { OinaPromptKind, QuestionType, RevisionQuestion } from '../../types/question';
import type { Area, Region, SubRegion } from '../../types/region';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import { buildIndexes, filterStructures, type StructureIndexes } from '../indexes';
import { areasOf } from '../../types/structure';
import { createRng, sample, shuffle, weightedShuffle, type Rng } from '../rng';
import { selectAdaptiveStructures, pickAdaptiveQuestionType } from '../adaptiveSelection';
import { buildWeightMap, structureWeight, UNSEEN_WEIGHT } from '../scheduling';
import type { ReviewItem } from '../reviewQueue';
import { LADDER_TYPES, hintsForRung, questionTypeForRung, rungFor } from '../ladder';
import { buildFlashcardQuestions, buildFieldFlashcard, buildRelearnCard } from './flashcards';
import { buildMcqQuestions } from './mcq';
import { buildLocateQuestions } from './locate';
import { buildFillBlankQuestions } from './fillBlank';
import { buildIdentifyTypedQuestions } from './identifyTyped';
import { buildMultiSelectQuestions } from './multiSelect';
import { buildBloodSupplyRatingMcqs } from './bloodSupply';
import { BLOOD_SUPPLY_SCORED } from '../../types/question';
import { buildClinicalQuestions } from './clinical';
import { buildOinaQuestions } from './oina';
import { factDueAt, factIntervalDays, factMasteryKey, indexFactMastery, shouldPrecedeWithLearnCard, skillOf } from '../factMastery';
import { isMcqQuestion, isOinaQuestion } from '../../types/question';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { DistractorVocabulary } from '../../data/content/vocabulary';
import { vocabularyWhenPartial, type DistractorSources } from './sources';

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
  /**
   * The daily review (2 Oct 2026): question TYPES due or pulled forward, in
   * order (lib/reviewQueue.ts). Takes precedence over priorityStructureIds.
   * Each item is answered by a question of that type — a due "deltoid origin"
   * yields an origin question, not a naming one — and the rest of the session
   * is new structures only: nothing well known and not due is drawn to fill
   * it, and a session with too little to ask ends short rather than repeat.
   *
   * `areas` does not narrow these (owner, 11 Oct 2026): what is due is asked
   * whatever area it is in, and `areas` only chooses where the NEW structures
   * come from. Narrowed, a student who had saved one area was asked that area
   * alone, while Today went on counting everything else as due.
   */
  reviewItems?: readonly ReviewItem[];
  /**
   * Most questions one structure may contribute to a capped session. Defaults
   * to MAX_QUESTIONS_PER_STRUCTURE; ignored by an uncapped practice session,
   * which means "ask me everything" and gets it.
   */
  maxPerStructure?: number;
  /** Share of a `reviewItems` session kept for structures never answered. Defaults to NEW_SHARE. */
  newShare?: number;
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
  /**
   * How much more (or less) often a structure the student has NEVER answered
   * is drawn — the questionnaire's "unsure about ligaments" made a weight
   * (lib/studyProfile.ts newStructureBias). Multiplies UNSEEN_WEIGHT only, so
   * anything with a graded answer is weighted by its answers alone.
   */
  newStructureBias?: (structure: AnatomyStructure) => number;
  /**
   * Relative share of each question type when a capped session deals its
   * types out in turn (interleaveByType). 1 when absent. A preference leans
   * the mix; no type that was asked for is ever left out.
   */
  typeWeights?: Partial<Record<QuestionType, number>>;
  /**
   * A structure never seen opens on multiple choice instead of a flashcard
   * (lib/studyProfile.ts skipsFlashcard). Never moves a structure above MCQ:
   * typed recall is still earned at the rung.
   */
  skipFlashcard?: (structure: AnatomyStructure) => boolean;
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
  weights?: Partial<Record<QuestionType, number>>,
): RevisionQuestion[] {
  const queues = types
    .map((type) => ({ type, queue: ordered.filter((q) => q.type === type), credit: 0 }))
    .filter(({ queue }) => queue.length > 0);
  // A question whose type was not requested — a clinical MCQ arrives as 'mcq',
  // but anything else would be dropped silently, so they go on the end.
  const dealt = new Set(queues.flatMap(({ queue }) => queue));
  const out: RevisionQuestion[] = [];
  // Each turn a type earns its weight in credit and is dealt one question per
  // whole credit, so a weight of 1.5 comes out one, two, one, two. Unweighted,
  // every type earns exactly one a turn — the plain alternation it always was.
  // The floor keeps every requested type in the session: a lean, never a removal.
  for (let i = 0; out.length < dealt.size; i++) {
    const slot = queues[i % queues.length];
    slot.credit += Math.max(0.25, weights?.[slot.type] ?? 1);
    while (slot.credit >= 1 && slot.queue.length) {
      out.push(slot.queue.shift()!);
      slot.credit -= 1;
    }
  }
  return [...out, ...ordered.filter((q) => !dealt.has(q))];
}

/** Share of a session reserved for `priorityStructureIds` when enough of them exist. */
export const REVIEW_SHARE = 0.6;

/**
 * Share of a prioritised session reserved for structures never answered —
 * no mastery row, or only a flashcard's "seen" row with nothing graded yet.
 *
 * Without it new material only got whatever the weighted draw left over, and
 * a seen structure that was weak or nearly due outweighed an unseen one — so
 * a student with a long review history could go days meeting nothing new.
 * Twenty questions: twelve review, five new, three from the weighted rest.
 */
export const NEW_SHARE = 0.25;

/**
 * Most questions any one structure may contribute to a capped session.
 *
 * A structure asks many questions — MCQ, locate, typed, four OINA facts, a
 * fill-blank per attachment — so a fifteen-question review could come out six
 * questions about the deltoid, and the ordering that produced it was working
 * as designed: the deltoid was the most overdue thing in the pool, so the
 * weighting put its whole family at the front. Depth on one muscle is not what
 * a revision session is for. Two is enough to catch a structure from two
 * angles and still leave room for ten others.
 */
export const MAX_QUESTIONS_PER_STRUCTURE = 2;

/**
 * Takes up to `count` questions in the order given, letting no structure
 * exceed `cap` of them.
 *
 * `counts` is shared between calls so the due side and the wider pool spend
 * one budget per structure rather than a cap each. `relax` raises the limit a
 * step at a time once the list has nothing left within it: a session scoped to
 * five structures cannot deal twenty questions two at a time, and a session
 * short of the length it promised is worse than a repetitive one. The callers
 * that can top up from elsewhere pass `relax: false` and let the other side
 * try first.
 */
function takeWithStructureCap(
  ordered: readonly RevisionQuestion[],
  count: number,
  cap: number,
  counts: Map<string, number> = new Map(),
  relax = false,
): RevisionQuestion[] {
  if (count <= 0) return [];
  const taken: RevisionQuestion[] = [];
  const used = new Set<RevisionQuestion>();
  for (let limit = cap; ; limit++) {
    for (const question of ordered) {
      if (taken.length >= count) break;
      if (used.has(question)) continue;
      const already = counts.get(question.structureId) ?? 0;
      if (already >= limit) continue;
      counts.set(question.structureId, already + 1);
      used.add(question);
      taken.push(question);
    }
    if (!relax || taken.length >= count || used.size === ordered.length) break;
  }
  return taken;
}

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
 * do second questions fill what is left of the share — and no more than `cap`
 * of them, which is where the fifteen-question review that was six questions
 * about one muscle used to come from (MAX_QUESTIONS_PER_STRUCTURE).
 */
function blendPriorityWithRest(
  ordered: RevisionQuestion[],
  priorityStructureIds: string[],
  count: number,
  reviewShare: number | undefined,
  rng: Rng,
  cap: number,
  newStructureIds: ReadonlySet<string> | null,
): RevisionQuestion[] {
  const priority = new Set(priorityStructureIds);
  const share = Math.min(1, Math.max(0, reviewShare ?? REVIEW_SHARE));

  const byStructure = new Map<string, RevisionQuestion[]>();
  const fresh: RevisionQuestion[] = [];
  const rest: RevisionQuestion[] = [];
  for (const question of ordered) {
    if (!priority.has(question.structureId)) {
      (newStructureIds?.has(question.structureId) ? fresh : rest).push(question);
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

  // One budget per structure across both sides, since the top-up below draws
  // from either and must not hand a structure a second cap's worth.
  const counts = new Map<string, number>();
  const fromDue = takeWithStructureCap(due, Math.min(Math.round(count * share), due.length), cap, counts);
  const fromNew = takeWithStructureCap(fresh, Math.min(Math.round(count * NEW_SHARE), count - fromDue.length), cap, counts);
  const fromRest = takeWithStructureCap(rest, count - fromDue.length - fromNew.length, cap, counts);
  // Neither side could fill the session within the cap — a narrow pool, not a
  // greedy structure — so now, and only now, the cap gives.
  const picked = new Set([...fromDue, ...fromNew, ...fromRest]);
  const topUp = takeWithStructureCap(
    [...due, ...fresh, ...rest].filter((q) => !picked.has(q)),
    count - picked.size,
    cap,
    counts,
    true,
  );
  return shuffle([...fromDue, ...fromNew, ...fromRest, ...topUp], rng);
}

/**
 * The daily review's blend (2 Oct 2026). Due types first, most overdue first,
 * up to what NEW_SHARE leaves; then new structures; then the weak types
 * pulled forward; then, if room remains, more due types and more new ones.
 * Nothing else: a question type the student knows well and is not due is
 * never drawn to fill the session.
 */
function blendReviewItems(
  ordered: RevisionQuestion[],
  items: readonly ReviewItem[],
  count: number,
  rng: Rng,
  cap: number,
  newIds: ReadonlySet<string> | null,
  newShare: number = NEW_SHARE,
): RevisionQuestion[] {
  const byKey = new Map<string, RevisionQuestion[]>();
  for (const q of ordered) {
    const key = `${q.structureId}|${skillOf(q.type, q.promptKind)}`;
    const list = byKey.get(key);
    if (list) list.push(q);
    else byKey.set(key, [q]);
  }
  const counts = new Map<string, number>();
  const picked: RevisionQuestion[] = [];
  const take = (list: readonly ReviewItem[], limit: number) => {
    for (const item of list) {
      if (picked.length >= limit) return;
      if ((counts.get(item.structureId) ?? 0) >= cap) continue;
      const q = byKey.get(`${item.structureId}|${item.kind}`)?.find((c) => !picked.includes(c));
      if (!q) continue;
      picked.push(q);
      counts.set(item.structureId, (counts.get(item.structureId) ?? 0) + 1);
    }
  };
  const fresh = ordered.filter((q) => newIds?.has(q.structureId) && !items.some((i) => i.structureId === q.structureId));
  const due = items.filter((i) => i.due);
  const forward = items.filter((i) => !i.due);
  const newSlots = Math.min(Math.round(count * Math.min(1, Math.max(0, newShare))), fresh.length);

  take(due, count - newSlots);
  for (const q of takeWithStructureCap(fresh, Math.min(newSlots, count - picked.length), cap, counts)) picked.push(q);
  take(forward, count);
  take(due, count);
  for (const q of takeWithStructureCap(fresh.filter((q) => !picked.includes(q)), count - picked.length, cap, counts)) picked.push(q);
  return shuffle(picked, rng);
}

/**
 * The pool's structures with nothing graded yet, for NEW_SHARE. Null without
 * mastery: with no history there is no telling new from known, and every
 * structure is new anyway.
 */
function newStructureIds(
  pool: AnatomyStructure[],
  mastery: readonly StructureMastery[] | undefined,
  facts: readonly FactMastery[] = [],
): Set<string> | null {
  if (!mastery) return null;
  // Answered at all — its name or any fact — is not new.
  const answered = new Set([
    ...mastery.filter((m) => m.attemptsTotal > 0).map((m) => m.structureId),
    ...facts.filter((f) => f.attemptsTotal > 0).map((f) => f.structureId),
  ]);
  return new Set(pool.filter((s) => !answered.has(s.id)).map((s) => s.id));
}


/**
 * The index by id, for naming a ligament's attachments ("Greater Trochanter
 * of the femur"). Kept per index array: the adaptive mode builds one question
 * at a time and would otherwise rebuild the map for each.
 */
const SITE_LOOKUPS = new WeakMap<readonly StructureIndexEntry[], ReadonlyMap<string, StructureIndexEntry>>();
function siteLookup(names: readonly StructureIndexEntry[]): ReadonlyMap<string, StructureIndexEntry> {
  let lookup = SITE_LOOKUPS.get(names);
  if (!lookup) SITE_LOOKUPS.set(names, (lookup = new Map(names.map((s) => [s.id, s]))));
  return lookup;
}

/** Facts asked only as multiple choice, so only to a structure the ladder puts on MCQ. */
const MCQ_ONLY_FACT_KINDS: ReadonlySet<string> = new Set([
  'myotome',
  'palpation',
  'special-test',
  'injury-mechanism',
  'functional',
  'joint-type',
]);

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
    const row = masteryById.get(structure.id);
    // Only the never-seen flashcard rung can be passed over, and only on the
    // student's word that they have met this kind of structure before.
    const rung = !row && config.skipFlashcard?.(structure) ? 'mcq' : rungFor(row);
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
  config: RevisionSetConfig,
  names: readonly StructureIndexEntry[],
  vocabulary: DistractorVocabulary | undefined,
  /** The session's pool: the neighbours a practice question about this structure would be set against. */
  sessionPool: AnatomyStructure[],
  /** Every loaded structure the student is entitled to. */
  entitled: AnatomyStructure[],
): RevisionQuestion | null {
  // ONE STRUCTURE IS ASKED ABOUT; IT IS NOT THE POOL ITS WRONG ANSWERS COME
  // FROM. Until 4 Oct 2026 the list of one below was handed to the builders as
  // both, so every adaptive MCQ had nobody to be confused with and came out
  // with the right answer as its only choice: about six in twenty in a
  // session seeded from real mastery, where the rest are flashcards and typed.
  const pool = [structure];
  switch (type) {
    case 'flashcard':
      return buildFlashcardQuestions(pool, images, { sites: siteLookup(names) })[0] ?? null;
    case 'mcq':
      return (
        buildMcqQuestions(pool, images, indexes, rng, { vocabulary, distractorPool: sessionPool, fallbackPool: entitled, sites: siteLookup(names) })[0] ??
        buildClinicalQuestions(pool, rng)[0] ??
        null
      );
    case 'locate':
      return buildLocateQuestions(pool, images)[0] ?? null;
    case 'fill-blank':
      return buildFillBlankQuestions(pool, rng)[0] ?? null;
    case 'identify-typed':
      return buildIdentifyTypedQuestions(pool, images, names)[0] ?? null;
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
        promptKinds: config.oinaPromptKinds,
        factMastery: config.factMastery,
        forceFormat: config.oinaForceFormat,
        vocabulary,
        neighbours: entitled,
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
 *
 * `structures` are the ones whose facts are in hand. While the seed is bundled
 * that is all of them and `sources` is left out. Once facts are loaded per
 * area it is the loaded areas only, and `sources` supplies what lies beyond
 * them: every structure's name, and wrong answers that belong to no structure
 * (sources.ts). A question is only ever ASKED about a loaded structure — the
 * pool below is cut from `structures` — so nothing here can state a fact that
 * was not served.
 */
export function generateRevisionSet(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  config: RevisionSetConfig,
  sources?: DistractorSources,
): RevisionQuestion[] {
  const rng = createRng(config.seed);
  const names = sources?.index ?? structures;
  const vocabulary = vocabularyWhenPartial(structures, sources);

  // The requested areas, narrowed to the entitled ones. An unfiltered request
  // (no `areas`) becomes a request for everything the student may reach —
  // NOT for everything, which is what an empty area list means everywhere
  // else in this codebase and would hand the whole body to a free account.
  const askedFor = config.areas?.length ? config.areas : [...config.entitledAreas];
  const allowedAreas = askedFor.filter((a) => config.entitledAreas.includes(a));

  const filtered = (areas: Area[]) =>
    filterStructures(structures, {
      category: config.category,
      categories: config.categories,
      region: config.region,
      regions: config.regions,
      subregion: config.subregion,
      areas,
      groups: config.groups,
      difficulty: config.difficulty,
    });
  // Where new structures come from: the areas asked for, and nothing else.
  const areaPool = filtered(allowedAreas);
  let pool = areaPool;
  // The daily review also asks what is due outside those areas (see
  // `reviewItems`), so those structures need questions built for them too.
  if (config.reviewItems?.length) {
    const inAreas = new Set(areaPool.map((s) => s.id));
    const reviewed = new Set(config.reviewItems.map((i) => i.structureId));
    pool = filtered([...config.entitledAreas]).filter((s) => inAreas.has(s.id) || reviewed.has(s.id));
  }
  if (config.structureIds?.length) {
    const allowed = new Set(config.structureIds);
    pool = pool.filter((s) => allowed.has(s.id));
  }
  // A second pass for the structureIds path above, which narrows the pool by
  // id and would otherwise smuggle in a locked structure: `areas` is usually
  // undefined on a drill, and a structure belongs to several areas.
  pool = pool.filter((s) => areasOf(s).some((a) => config.entitledAreas.includes(a)));

  const indexes = buildIndexes(structures); // built over every LOADED structure, not the pool, so distractor pools stay rich
  // Where an MCQ looks for wrong answers when its own pool cannot fill the
  // choices. Loaded AND entitled: while the seed is bundled `structures` holds
  // every area, and a free account's knee question must not be topped up with
  // a shoulder muscle's origin. Once facts are served per area the two are the
  // same list.
  const entitled = structures.filter((s) => areasOf(s).some((a) => config.entitledAreas.includes(a)));
  const relevantImages = images.filter((img) => {
    if (img.mode === 'single-structure') return !!img.structureId && pool.some((s) => s.id === img.structureId);
    return (img.hotspots ?? []).some((h) => pool.some((s) => s.id === h.structureId));
  });

  if (config.mode === 'adaptive') {
    const masteryByStructureId = new Map((config.mastery ?? []).map((m) => [m.structureId, m]));
    const desiredCount = config.count ?? pool.length;
    const selected = selectAdaptiveStructures(pool, masteryByStructureId, desiredCount, rng, config.now ?? new Date());

    const adaptiveQuestions: RevisionQuestion[] = [];
    // A structure can have no question of any requested kind: since 17 Oct
    // 2026 a ligament whose attachment list another ligament shares has no
    // naming question at all (ligamentClue.ts). Its place is taken by the next
    // structure the selection would have chosen, so twenty asked is twenty
    // given. The first pass is exactly the old one; only a short session draws
    // again, from structures not yet tried.
    const tried = new Set<string>();
    let candidates = selected;
    while (candidates.length && adaptiveQuestions.length < desiredCount) {
      for (const structure of candidates) {
        if (adaptiveQuestions.length >= desiredCount) break;
        tried.add(structure.id);
        const mastery = masteryByStructureId.get(structure.id);
        const preferredType = pickAdaptiveQuestionType(mastery, config.types);
        if (!preferredType) continue;
        const orderedTypes = [preferredType, ...config.types.filter((t) => t !== preferredType)];
        for (const type of orderedTypes) {
          const question = generateOneQuestionForStructure(structure, type, relevantImages, indexes, rng, config, names, vocabulary, pool, entitled);
          if (question) {
            adaptiveQuestions.push(
              question.type === 'identify-typed' ? { ...question, hints: hintsForRung(rungFor(mastery)) } : question,
            );
            break;
          }
        }
      }
      if (adaptiveQuestions.length >= desiredCount) break;
      const rest = pool.filter((s) => !tried.has(s.id));
      candidates = rest.length
        ? selectAdaptiveStructures(rest, masteryByStructureId, desiredCount - adaptiveQuestions.length, rng, config.now ?? new Date())
        : [];
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
    generated.push(...buildFlashcardQuestions(flashcardPool, relevantImages, { sites: siteLookup(names) }));
  }
  const mcqPool = poolFor('mcq');
  if (mcqPool.length) {
    generated.push(...buildMcqQuestions(mcqPool, relevantImages, indexes, rng, { vocabulary, fallbackPool: entitled, sites: siteLookup(names) }));
    // Clinical MCQs (CR-010) are just another mcq promptKind family, gated on the
    // structure actually having the relevant clinical field authored — same
    // convention as buildMcqQuestions itself generating several promptKinds at once.
    generated.push(...buildClinicalQuestions(mcqPool, rng));
    // "How rich" is the one blood-supply question that stays multiple choice;
    // the arteries themselves are facts on the fact track (oina.ts). Neither
    // is asked while blood supply is unscored (types/question.ts).
    if (BLOOD_SUPPLY_SCORED) generated.push(...buildBloodSupplyRatingMcqs(mcqPool));
  }
  // Clinical facts and a joint's type are multiple choice only, so above they
  // are built just for structures the ladder still asks by MCQ. A structure
  // that has climbed to typed recall keeps those facts on their own schedule,
  // and until 28 Oct 2026 one falling due was never asked and stayed due for
  // good (lib/reviewQueue.ts isReviewedKind). The review builds the due ones.
  if (ladder && config.reviewItems?.length && config.types.includes('mcq')) {
    const onMcq = new Set(mcqPool.map((s) => s.id));
    const wanted = new Set(
      config.reviewItems
        .filter((i) => i.due && MCQ_ONLY_FACT_KINDS.has(i.kind) && !onMcq.has(i.structureId))
        .map((i) => `${i.structureId}|${i.kind}`),
    );
    // Clinical wrong answers come from the structures passed in, and one area
    // can hold a single muscle with a myotome, so these are built over every
    // structure the account may reach and only the due ones kept.
    if (wanted.size) {
      generated.push(
        ...[
          ...buildMcqQuestions(pool, relevantImages, indexes, rng, {
            vocabulary,
            fallbackPool: entitled,
            sites: siteLookup(names),
            promptKinds: ['joint-type'],
          }),
          ...buildClinicalQuestions(entitled, rng),
        ].filter((q) => wanted.has(`${q.structureId}|${q.promptKind}`)),
      );
    }
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
      ...buildIdentifyTypedQuestions(typedPool, relevantImages, names).map((q) =>
        ladder?.bare.has(q.structureId) ? { ...q, hints: 'none' as const } : q,
      ),
    );
  }
  if (config.types.includes('multi-select')) {
    generated.push(...buildMultiSelectQuestions(pool, indexes, rng, names));
  }
  if (config.types.includes('oina')) {
    generated.push(
      ...buildOinaQuestions(pool, structures, indexes, rng, {
        promptKinds: config.oinaPromptKinds,
        factMastery: config.factMastery,
        forceFormat: config.oinaForceFormat,
        vocabulary,
      }),
    );
  }

  // Weighted per QUESTION TYPE (2 Oct 2026): a naming question by the
  // structure's naming row, a fact question by that fact's own row — so a
  // shaky origin is drawn often while the well-known name of the same muscle
  // is not.
  const weights = config.mastery?.length ? buildWeightMap(config.mastery, config.now) : null;
  const factsByKey = config.factMastery?.length ? indexFactMastery(config.factMastery) : null;
  // The questionnaire's lean towards some new structures over others
  // (lib/studyProfile.ts). Only for a structure with no graded answer at all:
  // the moment it has one, its answers weight it and the questionnaire does not.
  const answered = new Set([
    ...(config.mastery ?? []).filter((m) => m.attemptsTotal > 0).map((m) => m.structureId),
    ...(config.factMastery ?? []).filter((f) => f.attemptsTotal > 0).map((f) => f.structureId),
  ]);
  const unseenWeight = (structureId: string): number => {
    if (!config.newStructureBias || answered.has(structureId)) return UNSEEN_WEIGHT;
    const structure = indexes.byId.get(structureId);
    return structure ? UNSEEN_WEIGHT * config.newStructureBias(structure) : UNSEEN_WEIGHT;
  };
  const weightOf = (q: RevisionQuestion): number => {
    const skill = skillOf(q.type, q.promptKind);
    if (skill === 'identify') return weights?.get(q.structureId) ?? unseenWeight(q.structureId);
    const fact = factsByKey?.get(factMasteryKey(q.structureId, skill));
    return fact
      ? structureWeight({ ...fact, dueAt: factDueAt(fact), intervalDays: factIntervalDays(fact) }, config.now)
      : unseenWeight(q.structureId);
  };
  const ordered = weights || factsByKey || config.newStructureBias ? weightedShuffle(generated, weightOf, rng) : shuffle(generated, rng);

  const count = config.mode === 'assessment' ? (config.count ?? generated.length) : config.count;
  // Only a CAPPED session needs balancing — an uncapped one asks everything it
  // built, in whatever order the weighting chose.
  const balanced = count && config.types.length > 1 ? interleaveByType(ordered, config.types, config.typeWeights) : ordered;
  const cap = Math.max(1, config.maxPerStructure ?? MAX_QUESTIONS_PER_STRUCTURE);
  const selected = !count
    ? balanced
    : config.reviewItems
      ? blendReviewItems(balanced, config.reviewItems, count, rng, cap, newStructureIds(areaPool, config.mastery ?? [], config.factMastery), config.newShare)
    : config.priorityStructureIds?.length
      ? blendPriorityWithRest(balanced, config.priorityStructureIds, count, config.reviewShare, rng, cap, newStructureIds(pool, config.mastery))
      : // Breadth over depth here too: the mastery weighting front-loads a weak
        // structure's whole question family, so a plain slice is as lopsided as
        // the due blend was.
        shuffle(takeWithStructureCap(balanced, count, cap, new Map(), true), rng);

  // An exam tests rather than teaches, so it never gets a learn card (CR-018).
  if (config.mode === 'assessment') return stampRequestedArea(selected, indexes.byId, config.areas);
  return stampRequestedArea(
    withRelearnCards(withLearnCards(selected, indexes, config.factMastery, config.learnCardAttempts), indexes, images),
    indexes.byId,
    config.areas,
  );
}

/**
 * Gives each MCQ the card the session shows if the student misses it a third
 * time running (lib/relearn.ts). Built here, where the structures and pictures
 * are, so the session can place it the moment the miss is recorded.
 */
function withRelearnCards(questions: RevisionQuestion[], indexes: StructureIndexes, images: AnatomyImageAsset[]): RevisionQuestion[] {
  const ownImage = new Map<string, string>();
  for (const image of images) {
    if (image.mode === 'single-structure' && image.structureId && !ownImage.has(image.structureId)) {
      ownImage.set(image.structureId, ownPictureOf(image.structureId, images)!.id);
    }
  }
  return questions.map((question) => {
    if (!isMcqQuestion(question)) return question;
    const structure = indexes.byId.get(question.structureId);
    return structure ? { ...question, relearnCard: buildRelearnCard(structure, question, ownImage.get(structure.id), indexes.byId) } : question;
  });
}
