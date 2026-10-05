import type { AnatomyImageAsset } from '../../types/image';
import type { MCQQuestion } from '../../types/question';
import type { StructureIndexEntry } from '../../types/structureIndex';
import { pickNameDistractors } from '../distractors';
import { shuffle, type Rng } from '../rng';
import { MCQ_CHOICE_COUNT, MCQ_MIN_CHOICES } from './mcq';
import { promptImagesFor } from './promptImages';
import { questionBase } from './questionBase';

/**
 * "Which structure is highlighted?" — built from the INDEX alone.
 *
 * A picture and four names: the one kind of question that states no fact, so
 * the one kind that can be asked about a structure whose facts are not on the
 * device. The ordinary MCQ generator makes these too (mcq.ts, the
 * 'identify' image variant), but it is handed full structures and builds its
 * other questions from their origins and nerves in the same pass; this is
 * that one variant on its own, for the case where there are no facts to hand
 * it.
 *
 * WHO CALLS IT: the diagnostic, and only when the sitter does not hold every
 * area (components/Diagnostic/DiagnosticScreen.tsx). The diagnostic asks
 * across the whole body whatever the account has paid for, and in a build
 * that fetches facts per area a free account has one area's facts and no
 * way to be asked the nerve of a muscle in another.
 *
 * THE IDS ARE THE ORDINARY ONES (`mcq-<structure>-identify-image-<image>`),
 * so a baseline sat on these questions can be replayed by a follow-up whether
 * or not the facts have arrived in between. The wrong answers are drawn from
 * the whole index here and from the session's loaded structures there, so a
 * replay may offer different wrong names beside the same picture and the same
 * right one.
 *
 * No explanation: there are no facts to write one from, and the diagnostic
 * shows none.
 */
export function buildPictureNameQuestions(
  index: readonly StructureIndexEntry[],
  images: readonly AnatomyImageAsset[],
  rng: Rng,
): MCQQuestion[] {
  const all = [...index];
  const questions: MCQQuestion[] = [];

  for (const structure of index) {
    if (!structure.eligibility.mcq) continue;
    const promptImages = promptImagesFor(structure, images);
    if (promptImages.length === 0) continue;

    const distractors = pickNameDistractors(structure, all, MCQ_CHOICE_COUNT - 1, rng);
    const pool = [...new Set([structure.name, ...distractors])].slice(0, MCQ_CHOICE_COUNT);
    if (pool.length < MCQ_MIN_CHOICES) continue;

    for (const image of promptImages) {
      const choices = shuffle(pool, rng);
      questions.push({
        ...questionBase(structure, 'identify'),
        type: 'mcq' as const,
        id: `mcq-${structure.id}-identify-image-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        choices,
        correctIndex: choices.indexOf(structure.name),
        explanation: '',
      });
    }
  }
  return questions;
}
