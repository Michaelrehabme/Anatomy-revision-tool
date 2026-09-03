import { isMuscle, isBone, isJoint, areaOf, JOINT_TYPE_LABELS } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { MCQQuestion, PromptKind } from '../../types/question';
import type { StructureIndexes } from '../indexes';
import { pickNameDistractors, pickTextFieldDistractors, pickKeyDistractors } from '../distractors';
import { buildIdentifyClue, summarizeStructure } from '../facts';
import { shuffle, sample, type Rng } from '../rng';

export interface McqGenOptions {
  /** Total choices including the correct answer. Default 4. */
  choiceCount?: number;
  /** Which prompt kinds to generate per category. Omit for all supported kinds. */
  promptKinds?: PromptKind[];
}

const MUSCLE_KINDS: PromptKind[] = ['identify', 'origin', 'insertion', 'nerve', 'action'];
// Bones are image/spatial-recognition only for now: no text-only attachment/articulation
// detail questions, and buildOne() below also skips the text-clue identify variant for bones.
const BONE_KINDS: PromptKind[] = ['identify'];
// Attachment/articulation detail now lives in fill-blank questions (see fillBlank.ts) — one
// statement at a time is far more answerable than the old joined-string MCQ choice was.
const LANDMARK_KINDS: PromptKind[] = ['identify'];
// Joints (CR-014): identify by text clue (no image/hotspot content exists for joints yet,
// so no image-based identify variant fires — see eligibility.locate: false on joint entries),
// plus a classification question exercising the ball-and-socket/hinge/pivot/etc. taxonomy.
const JOINT_KINDS: PromptKind[] = ['identify', 'joint-type'];

function kindsFor(structure: AnatomyStructure, requested?: PromptKind[]): PromptKind[] {
  const supported = isMuscle(structure)
    ? MUSCLE_KINDS
    : isBone(structure)
      ? BONE_KINDS
      : isJoint(structure)
        ? JOINT_KINDS
        : LANDMARK_KINDS;
  return requested ? supported.filter((k) => requested.includes(k)) : supported;
}

function buildChoices(
  correctValue: string,
  distractors: string[],
  choiceCount: number,
  rng: Rng,
): { choices: string[]; correctIndex: number } {
  // De-duplicate the whole pool, not just against the correct value: distinct
  // structures can share identical text (extensor carpi radialis longus and
  // brevis have the same actionText), which would otherwise render the same
  // answer twice and make the question unanswerable.
  const pool = [...new Set([correctValue, ...distractors])].slice(0, choiceCount);
  const choices = shuffle(pool, rng);
  return { choices, correctIndex: choices.indexOf(correctValue) };
}

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: areaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
    type: 'mcq' as const,
  };
}

/**
 * Builds MCQ questions for every eligible structure across the prompt kinds
 * supported by its category. Image-based "identify" variants are emitted
 * whenever a matching image exists — single-structure images need no
 * highlight (the whole image *is* the answer), atlas-slide images need a
 * populated hotspot for that structure so the UI can draw the highlight.
 */
export function buildMcqQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  rng: Rng,
  options: McqGenOptions = {},
): MCQQuestion[] {
  const { choiceCount = 4 } = options;
  const distractorCount = choiceCount - 1;
  const questions: MCQQuestion[] = [];

  for (const structure of structures) {
    if (!structure.eligibility.mcq) continue;

    for (const promptKind of kindsFor(structure, options.promptKinds)) {
      const built = buildOne(structure, structures, images, indexes, promptKind, distractorCount, choiceCount, rng);
      questions.push(...built);
    }
  }

  return questions;
}

function buildOne(
  structure: AnatomyStructure,
  all: AnatomyStructure[],
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  promptKind: PromptKind,
  distractorCount: number,
  choiceCount: number,
  rng: Rng,
): MCQQuestion[] {
  const out: MCQQuestion[] = [];

  if (promptKind === 'identify') {
    const distractors = pickNameDistractors(structure, all, distractorCount, rng);

    // Text-based: clue built from the structure's own facts, answer = name.
    // Bones skip this variant — image/spatial recognition is the priority skill for them,
    // not recalling a structure from a text clue.
    if (!isBone(structure)) {
      const { choices, correctIndex } = buildChoices(structure.name, distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-identify-text`,
        prompt: `Name the structure: ${buildIdentifyClue(structure)}`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure),
      });
    }

    // Image-based variants (one per matching image).
    for (const image of images.filter((img) => imageDepicts(img, structure.id))) {
      const { choices: imgChoices, correctIndex: imgCorrectIndex } = buildChoices(
        structure.name,
        distractors,
        choiceCount,
        rng,
      );
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-identify-image-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        choices: imgChoices,
        correctIndex: imgCorrectIndex,
        explanation: summarizeStructure(structure),
      });
    }
    return out;
  }

  if (isMuscle(structure)) {
    if (promptKind === 'origin' || promptKind === 'insertion') {
      const field = promptKind === 'origin' ? structure.origin : structure.insertion;
      const correctValue = field.join('; ');
      const distractors = pickTextFieldDistractors(
        correctValue,
        structure,
        all,
        (s) => (isMuscle(s) ? (promptKind === 'origin' ? s.origin : s.insertion) : undefined),
        distractorCount,
        rng,
      );
      const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-${promptKind}`,
        prompt: `What is the ${promptKind} of ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure),
      });
    }

    if (promptKind === 'nerve') {
      const correctValue = structure.nerve.map((n) => n.name).join('; ');
      const distractors = pickKeyDistractors(
        structure.nerve.map((n) => n.name),
        indexes.byNerve,
        distractorCount,
        rng,
      );
      const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-nerve`,
        prompt: `What nerve innervates ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure),
      });
    }

    if (promptKind === 'action') {
      const correctValue = structure.actionText;
      const otherMuscleActionTexts = all.reduce<string[]>((acc, s) => {
        if (isMuscle(s) && s.id !== structure.id) acc.push(s.actionText);
        return acc;
      }, []);
      const otherActionTexts = sample(otherMuscleActionTexts, distractorCount, rng);
      const { choices, correctIndex } = buildChoices(correctValue, otherActionTexts, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-action`,
        prompt: `What is the action of ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure),
      });
    }
    return out;
  }

  if (isJoint(structure) && promptKind === 'joint-type') {
    const otherTypes = all.reduce<string[]>((acc, s) => {
      if (isJoint(s) && s.id !== structure.id) acc.push(JOINT_TYPE_LABELS[s.jointType]);
      return acc;
    }, []);
    const distractors = sample([...new Set(otherTypes)], distractorCount, rng);
    if (distractors.length > 0) {
      const { choices, correctIndex } = buildChoices(JOINT_TYPE_LABELS[structure.jointType], distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-joint-type`,
        prompt: `What type of joint is the ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure),
      });
    }
  }

  return out;
}

export function imageDepicts(image: AnatomyImageAsset, structureId: string): boolean {
  if (image.mode === 'single-structure') return image.structureId === structureId;
  return (image.hotspots ?? []).some((h) => h.structureId === structureId);
}
