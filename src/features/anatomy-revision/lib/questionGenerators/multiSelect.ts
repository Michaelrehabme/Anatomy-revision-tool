import {
  isMuscle,
  isJoint,
  areaOf,
  EQUIVALENT_MOVEMENT_GROUPS,
  UNIVERSAL_ACCESSORY_MOVEMENTS,
} from '../../types/structure';
import type { AnatomyStructure, JointMovement, JointStructure } from '../../types/structure';
import type { MultiSelectQuestion } from '../../types/question';
import type { StructureIndexes } from '../indexes';
import { pickStructureDistractors } from '../distractors';
import { shuffle, sample, type Rng } from '../rng';

const MAX_CORRECT = 4;
const MAX_DISTRACTORS = 3;
const MIN_ACTION_MATCHES = 3;

function slugify(key: string): string {
  return key.replace(/\s+/g, '-').toLowerCase();
}

function baseFields(structure: AnatomyStructure, promptKind: MultiSelectQuestion['promptKind']) {
  return {
    type: 'multi-select' as const,
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: areaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
  };
}

/**
 * "Select ALL muscles innervated by the ulnar nerve" — every nerve in the
 * (full-dataset) byNerve index with enough in-pool muscles to be a real
 * multiple-answer question, plus distractors from muscles NOT on that nerve.
 */
function buildNerveQuestions(pool: AnatomyStructure[], indexes: StructureIndexes, rng: Rng): MultiSelectQuestion[] {
  const poolById = new Map(pool.map((s) => [s.id, s]));
  const questions: MultiSelectQuestion[] = [];

  for (const [nerveName, muscleIds] of indexes.byNerve) {
    const innervated = new Set(muscleIds);
    const correctInPool = muscleIds.map((id) => poolById.get(id)).filter((s): s is AnatomyStructure => !!s);
    if (correctInPool.length < 2) continue;

    const distractorPool = pool.filter((s) => isMuscle(s) && !innervated.has(s.id));
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
    const sameGroup = candidatesFrom(others.filter((j) => areaOf(j) === areaOf(joint)));
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

export function buildMultiSelectQuestions(
  pool: AnatomyStructure[],
  indexes: StructureIndexes,
  rng: Rng,
): MultiSelectQuestion[] {
  return [
    ...buildNerveQuestions(pool, indexes, rng),
    ...buildActionExclusionQuestions(pool, indexes, rng),
    ...buildJointMovementQuestions(pool, rng),
  ];
}
