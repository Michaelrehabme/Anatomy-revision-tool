import { isMuscle, isBone, isLandmark } from '../../types/structure';
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
const BONE_KINDS: PromptKind[] = ['identify', 'attachment', 'articulation'];
const LANDMARK_KINDS: PromptKind[] = ['identify', 'attachment'];

function kindsFor(structure: AnatomyStructure, requested?: PromptKind[]): PromptKind[] {
  const supported = isMuscle(structure) ? MUSCLE_KINDS : isBone(structure) ? BONE_KINDS : LANDMARK_KINDS;
  return requested ? supported.filter((k) => requested.includes(k)) : supported;
}

function buildChoices(
  correctValue: string,
  distractors: string[],
  choiceCount: number,
  rng: Rng,
): { choices: string[]; correctIndex: number } {
  const pool = [correctValue, ...distractors.filter((d) => d !== correctValue)].slice(0, choiceCount);
  const choices = shuffle(pool, rng);
  return { choices, correctIndex: choices.indexOf(correctValue) };
}

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
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
    // Text-based: clue built from the structure's own facts, answer = name.
    const distractors = pickNameDistractors(structure, all, distractorCount, rng);
    const { choices, correctIndex } = buildChoices(structure.name, distractors, choiceCount, rng);
    out.push({
      ...baseFields(structure, promptKind),
      id: `mcq-${structure.id}-identify-text`,
      prompt: `Name the structure: ${buildIdentifyClue(structure)}`,
      choices,
      correctIndex,
      explanation: summarizeStructure(structure),
    });

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

  if ((isBone(structure) || isLandmark(structure)) && promptKind === 'attachment') {
    const correctValue = structure.attachments.join('; ');
    const distractors = pickTextFieldDistractors(
      correctValue,
      structure,
      all,
      (s) => (isBone(s) || isLandmark(s) ? s.attachments : undefined),
      distractorCount,
      rng,
    );
    const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
    out.push({
      ...baseFields(structure, promptKind),
      id: `mcq-${structure.id}-attachment`,
      prompt: `What attaches to the ${structure.name}?`,
      choices,
      correctIndex,
      explanation: summarizeStructure(structure),
    });
  }

  if (isBone(structure) && promptKind === 'articulation') {
    const correctValue = structure.articulations.join('; ');
    const distractors = pickTextFieldDistractors(
      correctValue,
      structure,
      all,
      (s) => (isBone(s) ? s.articulations : undefined),
      distractorCount,
      rng,
    );
    const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
    out.push({
      ...baseFields(structure, promptKind),
      id: `mcq-${structure.id}-articulation`,
      prompt: `Which joint(s) does the ${structure.name} form?`,
      choices,
      correctIndex,
      explanation: summarizeStructure(structure),
    });
  }

  return out;
}

function imageDepicts(image: AnatomyImageAsset, structureId: string): boolean {
  if (image.mode === 'single-structure') return image.structureId === structureId;
  return (image.hotspots ?? []).some((h) => h.structureId === structureId);
}
