import { isMuscle } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { FlashcardQuestion, PromptKind } from '../../types/question';
import { summarizeStructure } from '../facts';

export interface FlashcardGenOptions {
  /** Also emit an image-first variant when a single-structure image exists. Default true. */
  imageFirstWhenAvailable?: boolean;
}

const MUSCLE_FIELD_KINDS: PromptKind[] = ['origin', 'insertion', 'nerve', 'action'];

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
    type: 'flashcard' as const,
  };
}

function fieldBackText(structure: AnatomyStructure, promptKind: PromptKind): string {
  if (!isMuscle(structure)) return '';
  switch (promptKind) {
    case 'origin':
      return structure.origin.join('; ');
    case 'insertion':
      return structure.insertion.join('; ');
    case 'nerve':
      return structure.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ');
    case 'action':
      return structure.actionText;
    default:
      return '';
  }
}

/**
 * Builds flashcards for every eligible structure. Text-first "identify"
 * cards always generate (front = name, back = facts). When a matching
 * single-structure image exists, an additional image-first card is
 * generated (front = image, back = name + facts) — this is what lets a
 * student practice recognising a structure from its picture, not just
 * recalling facts about its name.
 *
 * Muscles additionally get one card per field (origin/insertion/nerve/
 * action) so a student can be quizzed on a single fact at a time rather
 * than always recalling everything about a muscle at once.
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
      ...baseFields(structure, 'identify'),
      id: `flashcard-${structure.id}-text`,
      front: { text: structure.name },
      back: { text: backText, imageId: image?.id },
    });

    if (imageFirstWhenAvailable && image) {
      questions.push({
        ...baseFields(structure, 'identify'),
        id: `flashcard-${structure.id}-image`,
        front: { imageId: image.id },
        back: { text: `${structure.name}\n\n${backText}` },
      });
    }

    if (isMuscle(structure)) {
      for (const promptKind of MUSCLE_FIELD_KINDS) {
        questions.push({
          ...baseFields(structure, promptKind),
          id: `flashcard-${structure.id}-${promptKind}`,
          front: { text: `What is the ${promptKind === 'nerve' ? 'nerve supply' : promptKind} of ${structure.name}?` },
          back: { text: fieldBackText(structure, promptKind) },
        });
      }
    }
  }

  return questions;
}
