import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { TypedIdentifyQuestion } from '../../types/question';
import { summarizeStructure } from '../facts';
import { imageDepicts } from './mcq';

/**
 * Builds a typed-answer counterpart to MCQ's image-based "identify"
 * variant — same population (every mcq-eligible structure with a matching
 * image), but graded by fuzzy string match instead of picking a choice.
 * Atlas-slide images still need a populated hotspot for that structure to
 * match, same current gap as the MCQ/locate image variants.
 */
export function buildIdentifyTypedQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
): TypedIdentifyQuestion[] {
  const questions: TypedIdentifyQuestion[] = [];

  for (const structure of structures) {
    if (!structure.eligibility.mcq) continue;

    for (const image of images.filter((img) => imageDepicts(img, structure.id))) {
      questions.push({
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        type: 'identify-typed',
        id: `identify-typed-${structure.id}-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        acceptedAnswers: [structure.name, ...structure.aliases],
        explanation: summarizeStructure(structure),
      });
    }
  }

  return questions;
}
