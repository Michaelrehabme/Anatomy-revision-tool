import {
  isMuscle,
  isJoint,
  isLigament,
  reviewedAttachmentIds,
  areasOf,
  EQUIVALENT_MOVEMENT_GROUPS,
  UNIVERSAL_ACCESSORY_MOVEMENTS,
} from '../../types/structure';
import type { AnatomyStructure, JointMovement, JointStructure } from '../../types/structure';
import type { StructureIndexEntry } from '../../types/structureIndex';
import type { MultiSelectQuestion } from '../../types/question';
import type { StructureIndexes } from '../indexes';
import { pickStructureDistractors } from '../distractors';
import { canonicalNerveNames, conflictsWith } from '../oinaValues';
import { containerIds, siteLabel } from '../attachmentSites';
import { shuffle, sample, type Rng } from '../rng';
import { questionBase } from './questionBase';

const MAX_CORRECT = 4;
const MAX_DISTRACTORS = 3;
const MIN_ACTION_MATCHES = 3;
/**
 * The fewest choices any question here is built with: a hinge joint's two
 * movements and one that does not belong. Every builder below either reaches
 * it or emits nothing.
 */
export const MULTI_SELECT_MIN_CHOICES = 3;

function slugify(key: string): string {
  return key.replace(/\s+/g, '-').toLowerCase();
}

function baseFields(structure: AnatomyStructure, promptKind: MultiSelectQuestion['promptKind']) {
  return { type: 'multi-select' as const, ...questionBase(structure, promptKind) };
}

/**
 * "Select ALL muscles innervated by the ulnar nerve" — every nerve in the
 * (full-dataset) byNerve index with enough in-pool muscles to be a real
 * multiple-answer question, plus distractors from muscles NOT on that nerve.
 */
function buildNerveQuestions(pool: AnatomyStructure[], indexes: StructureIndexes, rng: Rng): MultiSelectQuestion[] {
  const poolById = new Map(pool.map((s) => [s.id, s]));
  const questions: MultiSelectQuestion[] = [];

  // By the nerve, not by how it was written down. The index keys on the
  // authored string, so "Tibial nerve (long head)" was a different nerve from
  // "Tibial nerve" and biceps femoris was marked wrong for it; the same for
  // the lumbricals, adductor magnus and "Deep fibular (peroneal) nerve"
  // (8 Oct 2026).
  const byCanonicalNerve = new Map<string, string[]>();
  for (const s of indexes.byId.values()) {
    if (!isMuscle(s)) continue;
    for (const name of canonicalNerveNames(s.nerve)) byCanonicalNerve.set(name, [...(byCanonicalNerve.get(name) ?? []), s.id]);
  }

  for (const [nerveName, muscleIds] of byCanonicalNerve) {
    const innervated = new Set(muscleIds);
    const correctInPool = muscleIds.map((id) => poolById.get(id)).filter((s): s is AnatomyStructure => !!s);
    if (correctInPool.length < 2) continue;

    // Nor a muscle the nerve reaches only sometimes, or under a longer name:
    // not a right answer, and not a fair wrong one.
    const distractorPool = pool.filter(
      (s) => isMuscle(s) && !innervated.has(s.id) && !s.nerve.some((n) => conflictsWith(nerveName, n.name)),
    );
    if (distractorPool.length < 2) continue;

    const chosenCorrect = sample(correctInPool, Math.min(MAX_CORRECT, correctInPool.length), rng);
    const distractors = pickStructureDistractors(chosenCorrect[0], distractorPool, Math.min(MAX_DISTRACTORS, distractorPool.length), rng);
    if (distractors.length < 2) continue;

    const allChoices = shuffle([...chosenCorrect, ...distractors], rng);
    const correctIds = new Set(chosenCorrect.map((s) => s.id));

    questions.push({
      ...baseFields(chosenCorrect[0], 'nerve'),
      id: `multiselect-nerve-${slugify(nerveName)}`,
      prompt: `Select ALL muscles innervated by the ${nerveName}.`,
      choices: allChoices.map((s) => s.name),
      correctIndices: allChoices.reduce<number[]>((acc, s, i) => (correctIds.has(s.id) ? [...acc, i] : acc), []),
      explanation: `Innervated by the ${nerveName}: ${chosenCorrect.map((s) => s.name).join(', ')}.`,
    });
  }

  return questions;
}

/**
 * "Which of these does NOT contribute to shoulder abduction" — the inverse
 * shape: most choices share the action, exactly one (the correct answer to
 * select) doesn't.
 */
function buildActionExclusionQuestions(pool: AnatomyStructure[], indexes: StructureIndexes, rng: Rng): MultiSelectQuestion[] {
  const poolById = new Map(pool.map((s) => [s.id, s]));
  const questions: MultiSelectQuestion[] = [];

  for (const [action, muscleIds] of indexes.byAction) {
    const hasAction = new Set(muscleIds);
    const matchingInPool = muscleIds.map((id) => poolById.get(id)).filter((s): s is AnatomyStructure => !!s);
    if (matchingInPool.length < MIN_ACTION_MATCHES) continue;

    const withoutAction = pool.filter((s) => isMuscle(s) && !hasAction.has(s.id));
    const oddOneOut = sample(withoutAction, 1, rng)[0];
    if (!oddOneOut) continue;

    const chosenMatching = sample(matchingInPool, Math.min(3, matchingInPool.length), rng);
    const allChoices = shuffle([...chosenMatching, oddOneOut], rng);

    questions.push({
      ...baseFields(oddOneOut, 'action'),
      id: `multiselect-action-exclude-${slugify(action)}`,
      prompt: `Which of these does NOT contribute to ${action.replace(/-/g, ' ')}?`,
      choices: allChoices.map((s) => s.name),
      correctIndices: allChoices.reduce<number[]>((acc, s, i) => (s.id === oddOneOut.id ? [...acc, i] : acc), []),
      explanation: `${chosenMatching.map((s) => s.name).join(', ')} all contribute to ${action.replace(/-/g, ' ')}; ${oddOneOut.name} does not.`,
    });
  }

  return questions;
}

/**
 * Movements that cannot honestly serve as an odd-one-out for `joint` (CR-017).
 * Two ways a naive `!joint.movements.includes(m)` string test lies:
 *
 * 1. Accessory movements. Gliding occurs at essentially every synovial joint,
 *    so "gliding is NOT possible at the tibiofemoral joint" is false even
 *    though the tibiofemoral entry only bothers to list flexion/extension/
 *    rotation.
 * 2. Regional synonyms. Wrist radial deviation *is* abduction, so offering
 *    "Abduction" against the radiocarpal joint (which lists 'Radial deviation')
 *    asserts something untrue.
 */
function isTruthfulOddOneOut(movement: JointMovement, joint: JointStructure): boolean {
  if (UNIVERSAL_ACCESSORY_MOVEMENTS.includes(movement)) return false;
  const equivalents = EQUIVALENT_MOVEMENT_GROUPS.find((g) => g.includes(movement)) ?? [movement];
  return !equivalents.some((m) => joint.movements.includes(m));
}

/**
 * "Which of these movements is NOT possible at the humeroulnar joint" (CR-014)
 * — same odd-one-out shape as buildActionExclusionQuestions, but computed
 * directly from each joint's own `movements` list rather than a reverse index
 * (29 joints still isn't enough to justify a dataset-wide byMovement index).
 *
 * CR-017 scopes the odd-one-out to the joint's own group first. Drawing from
 * all 29 joints made the question trivial — "which movement is NOT possible at
 * the atlantoaxial joint? Plantarflexion" tests nothing. Within a group the
 * wrong answer is a movement that plausibly belongs to a neighbouring joint,
 * which is the discrimination actually worth practising.
 */
function buildJointMovementQuestions(pool: AnatomyStructure[], rng: Rng): MultiSelectQuestion[] {
  const joints = pool.filter(isJoint);
  const questions: MultiSelectQuestion[] = [];

  for (const joint of joints) {
    // A hinge/pivot joint has only 2 movements (e.g. flexion/extension) — still a valid
    // question with 2 correct + 1 odd-one-out choice, so 2 is the floor, not 3.
    if (joint.movements.length < 2) continue;

    const candidatesFrom = (others: JointStructure[]) => [
      ...new Set(
        others
          .flatMap((j) => j.movements)
          .filter((m) => isTruthfulOddOneOut(m, joint)),
      ),
    ];
    const others = joints.filter((j) => j.id !== joint.id);
    // Neighbouring joints share any area, not just their first one — a facet joint
    // spans all three spine areas, so a costovertebral joint counts as its neighbour.
    const jointAreas = areasOf(joint);
    const sameGroup = candidatesFrom(others.filter((j) => areasOf(j).some((a) => jointAreas.includes(a))));
    // Groups where every other joint is a gliding-only plane joint (the hip group's
    // sacroiliac + pubic symphysis, for instance) yield nothing — fall back to the
    // whole dataset rather than dropping the question entirely.
    const otherMovements = sameGroup.length > 0 ? sameGroup : candidatesFrom(others);
    const oddOneOut = sample(otherMovements, 1, rng)[0];
    if (!oddOneOut) continue;

    const chosenMatching = sample(joint.movements, Math.min(3, joint.movements.length), rng);
    const allChoices = shuffle([...chosenMatching, oddOneOut], rng);

    questions.push({
      ...baseFields(joint, 'joint-movement'),
      id: `multiselect-joint-movement-${joint.id}`,
      prompt: `Which of these movements is NOT possible at the ${joint.name}?`,
      choices: allChoices,
      correctIndices: allChoices.reduce<number[]>((acc, m, i) => (m === oddOneOut ? [...acc, i] : acc), []),
      explanation: `${chosenMatching.join(', ')} all occur at the ${joint.name}; ${oddOneOut} does not.`,
    });
  }

  return questions;
}

/**
 * "Select all the bones the anterior cruciate ligament attaches to" — the
 * recognition phase of a ligament's attachments. The correct set is the
 * ligament's attachmentStructureIds; the distractors are other bones of the
 * same area, so the wrong answers are the neighbours a student would
 * actually confuse (fibula for the ACL), not the scapula.
 *
 * Attachments are named through the pool where possible and from the id
 * otherwise — a knee pool carries the femur, but a wrist ligament's "radius"
 * may be filtered out of a hand-only pool, and the question must still read.
 */
/**
 * "the collateral ligaments attaches to" is the sort of thing a student
 * notices and a generator does not. Several entries are plural groups rather
 * than one strap, so the verb has to follow the head noun — which is not the
 * last word either ("interosseous membrane of forearm" is singular).
 */
function attachVerb(name: string): string {
  const head = name.toLowerCase();
  return /ligaments|membranes|plates|retinacula/.test(head) ? 'attach' : 'attaches';
}

function buildLigamentAttachmentQuestions(
  pool: AnatomyStructure[],
  names: readonly StructureIndexEntry[],
  rng: Rng,
): MultiSelectQuestion[] {
  // Names AND distractors come from every structure there is, not the pool.
  // Drawing them from the pool looked right until the app was run: a
  // student narrowing a session to ligaments has a pool with no bones in it,
  // so there were no distractors to offer and every attachment question
  // vanished from the one session that is entirely about attachments.
  //
  // And from index entries, not loaded structures, for the same reason one
  // step further out: a bone's name, category, parent and areas are all this
  // reads, and the bone may be in an area whose facts are not loaded.
  const byId = new Map(names.map((s) => [s.id, s]));
  const isBony = (s: StructureIndexEntry) => s.category === 'bone' || s.category === 'landmark';
  // "Greater Trochanter of the femur": the part, and the bone it is on.
  const nameOf = (id: string) => {
    const site = byId.get(id);
    return site ? siteLabel(site, byId) : id.replace(/-/g, ' ').replace(/^[a-z]/, (c) => c.toUpperCase());
  };
  const questions: MultiSelectQuestion[] = [];

  for (const lig of pool.filter(isLigament)) {
    // The question asks for BONES, so only bony attachments are right answers
    // to it. The transverse ligament of the knee joins the two menisci and
    // attaches to no bone at all; offering "Medial meniscus" as the answer to
    // "select all the bones" would teach the wrong category. Such a ligament is
    // still asked its attachments by name, just not by this question.
    const attachments = reviewedAttachmentIds(lig).filter((id) => {
      const s = byId.get(id);
      return !s || isBony(s);
    });
    if (!attachments.length) continue;
    const correct = new Set(attachments);
    // A distractor must not be a different name for a correct answer. The
    // ATFL attaches to the fibula; offering "lateral malleolus" beside it
    // punishes the student who knows more precisely where. So a correct
    // landmark rules out its parent bone and a correct bone rules out every
    // landmark on it, and only whole bones remain as wrong answers.
    //
    // Since 10 Oct 2026 the right answers are mostly parts of bones, so parts
    // of bones are offered as wrong answers too — a list of whole bones with
    // one "…of the femur" in it marks its own answer. But never a part of a
    // bone this ligament reaches: the attachments name the site the source
    // names, and the lesser trochanter may be a few fibres from the greater.
    const related = new Set<string>();
    const reached = new Set<string>(attachments);
    for (const id of attachments) {
      const site = byId.get(id);
      if (!site) continue;
      for (const container of containerIds(site)) reached.add(container);
      // The whole bone a correct part is on is never a wrong answer.
      if (site.category === 'landmark' && site.parentBoneId) related.add(site.parentBoneId);
    }
    for (const s of names) {
      if (s.category !== 'landmark') continue;
      const onReachedBone = !!s.parentBoneId && s.parentBoneId !== 'pelvis' && reached.has(s.parentBoneId);
      if (onReachedBone || containerIds(s).some((container) => reached.has(container))) related.add(s.id);
    }
    for (const container of reached) related.add(container);
    const ligAreas = areasOf(lig);
    const wholeBonesOnly = attachments.every((id) => byId.get(id)?.category !== 'landmark');
    const distractorPool = names.filter(
      (s) =>
        (s.category === 'bone' || (!wholeBonesOnly && s.category === 'landmark')) &&
        !correct.has(s.id) &&
        !related.has(s.id) &&
        areasOf(s).some((a) => ligAreas.includes(a)),
    );
    const distractors = sample(distractorPool, Math.min(MAX_DISTRACTORS, distractorPool.length), rng);
    if (distractors.length < 2) continue;

    const correctNames = attachments.map(nameOf);
    const choices = shuffle([...correctNames, ...distractors.map((s) => siteLabel(s, byId))], rng);
    const correctSet = new Set(correctNames);
    questions.push({
      ...baseFields(lig, 'attachment'),
      id: `multiselect-ligament-attachment-${lig.id}`,
      prompt: `Select ALL the ${wholeBonesOnly ? 'bones' : 'sites'} the ${lig.name} ${attachVerb(lig.name)} to.`,
      choices,
      correctIndices: choices.reduce<number[]>((acc, c, i) => (correctSet.has(c) ? [...acc, i] : acc), []),
      explanation: `The ${lig.name} ${attachVerb(lig.name)} to: ${correctNames.join(', ')}.`,
    });
  }
  return questions;
}

export function buildMultiSelectQuestions(
  pool: AnatomyStructure[],
  indexes: StructureIndexes,
  rng: Rng,
  /** Every structure, for naming attachments. Defaults to the structures the indexes were built over. */
  names: readonly StructureIndexEntry[] = [...indexes.byId.values()],
): MultiSelectQuestion[] {
  return [
    ...buildNerveQuestions(pool, indexes, rng),
    ...buildActionExclusionQuestions(pool, indexes, rng),
    ...buildJointMovementQuestions(pool, rng),
    ...buildLigamentAttachmentQuestions(pool, names, rng),
  ];
}
