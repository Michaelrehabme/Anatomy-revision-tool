import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { FlashcardQuestion } from '../../types/question';
import { summarizeStructure } from '../facts';

export interface FlashcardGenOptions {
  /** Also emit an image-first variant when a single-structure image exists. Default true. */
  imageFirstWhenAvailable?: boolean;
}

/**
 * Builds flashcards for every eligible structure. Text-first cards always
 * generate (front = name, back = facts). When a matching single-structure
 * image exists, an additional image-first card is generated (front = image,
 * back = name + facts) — this is what lets a student practice recognising
 * a structure from its picture, not just recalling facts about its name.
 */
export function buildFlashcardQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  options: FlashcardGenOptions = {},
): FlashcardQuestion[] {
  const { imageFirstWhenAvailable = true } = options;
  const questions: FlashcardQuestion[] = [];

  for (const structure of structures) {
    if (!structure.eligibility.flashcard) continue;

    const backText = summarizeStructure(structure);
    const image = images.find(
      (img) => img.mode === 'single-structure' && img.structureId === structure.id,
    );

    questions.push({
      id: `flashcard-${structure.id}-text`,
      type: 'flashcard',
      structureId: structure.id,
      region: structure.region,
      subregion: structure.subregion,
      category: structure.category,
      difficulty: structure.difficulty,
      promptKind: 'identify',
      front: { text: structure.name },
      back: { text: backText, imageId: image?.id },
    });

    if (imageFirstWhenAvailable && image) {
      questions.push({
        id: `flashcard-${structure.id}-image`,
        type: 'flashcard',
        structureId: structure.id,
        region: structure.region,
        subregion: structure.subregion,
        category: structure.category,
        difficulty: structure.difficulty,
        promptKind: 'identify',
        front: { imageId: image.id },
        back: { text: `${structure.name}\n\n${backText}` },
      });
    }
  }

  return questions;
}
