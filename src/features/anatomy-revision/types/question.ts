import type { Category, Difficulty } from './structure';
import type { ImageMode } from './image';
import type { Region, SubRegion } from './region';

export type QuestionType = 'flashcard' | 'mcq' | 'locate';

export type PromptKind =
  | 'identify'
  | 'origin'
  | 'insertion'
  | 'nerve'
  | 'action'
  | 'attachment'
  | 'articulation'
  | 'group-membership';

interface RevisionQuestionBase {
  id: string;
  type: QuestionType;
  structureId: string;
  region: Region;
  subregion?: SubRegion;
  category: Category;
  difficulty: Difficulty;
  promptKind: PromptKind;
}

export interface FlashcardQuestion extends RevisionQuestionBase {
  type: 'flashcard';
  front: { text?: string; imageId?: string };
  back: { text: string; imageId?: string };
}

export interface MCQQuestion extends RevisionQuestionBase {
  type: 'mcq';
  prompt: string;
  /**
   * Set for "which structure is highlighted" style questions. The UI looks
   * up the matching HotspotPolygon on this image for structureId to draw the
   * highlight — polygon data is never duplicated onto the question itself.
   */
  promptImageId?: string;
  /** 4 shuffled choices (1 correct + up to 3 distractors; may be fewer if the pool is small). */
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface LocateQuestion extends RevisionQuestionBase {
  type: 'locate';
  imageId: string;
  imageMode: ImageMode;
  targetStructureId: string;
  /** Multiplies the target polygon's hit area for a slightly forgiving click radius. */
  toleranceMultiplier?: number;
  prompt: string;
}

export type RevisionQuestion = FlashcardQuestion | MCQQuestion | LocateQuestion;

export const isFlashcardQuestion = (q: RevisionQuestion): q is FlashcardQuestion => q.type === 'flashcard';
export const isMcqQuestion = (q: RevisionQuestion): q is MCQQuestion => q.type === 'mcq';
export const isLocateQuestion = (q: RevisionQuestion): q is LocateQuestion => q.type === 'locate';
