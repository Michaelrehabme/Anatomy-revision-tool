import type { Category, Difficulty } from './structure';
import type { ImageMode } from './image';
import type { Region, SubRegion } from './region';

export type QuestionType = 'flashcard' | 'mcq' | 'locate' | 'fill-blank' | 'identify-typed' | 'multi-select';

export type PromptKind =
  | 'identify'
  | 'origin'
  | 'insertion'
  | 'nerve'
  | 'action'
  | 'attachment'
  | 'articulation'
  | 'group-membership'
  // --- Clinical layer (CR-010) ---
  | 'myotome'
  | 'palpation'
  | 'special-test'
  | 'injury-mechanism'
  | 'functional'
  // --- Joints (CR-014) ---
  | 'joint-type'
  | 'joint-movement';

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

export interface FillBlankQuestion extends RevisionQuestionBase {
  type: 'fill-blank';
  /** Text rendered before the blank. */
  before: string;
  /** Text rendered after the blank. */
  after: string;
  /** The blanked word/phrase the student must supply. */
  answer: string;
  /** The original, unblanked statement — shown as feedback after answering. */
  fullStatement: string;
}

export interface TypedIdentifyQuestion extends RevisionQuestionBase {
  type: 'identify-typed';
  prompt: string;
  promptImageId: string;
  /** Structure name plus any aliases — any of these count as correct. */
  acceptedAnswers: string[];
  explanation: string;
}

/**
 * "Select all that apply" — CR-010, built from the byNerve/byAction reverse
 * indexes (e.g. "select ALL muscles innervated by the ulnar nerve", or the
 * inverted "which of these does NOT contribute to shoulder abduction").
 * Scored partially, not all-or-nothing — see lib/multiSelectScoring.ts.
 */
export interface MultiSelectQuestion extends RevisionQuestionBase {
  type: 'multi-select';
  prompt: string;
  choices: string[];
  /** Indices into `choices` the student should select. */
  correctIndices: number[];
  explanation: string;
}

export type RevisionQuestion =
  | FlashcardQuestion
  | MCQQuestion
  | LocateQuestion
  | FillBlankQuestion
  | TypedIdentifyQuestion
  | MultiSelectQuestion;

export const isFlashcardQuestion = (q: RevisionQuestion): q is FlashcardQuestion => q.type === 'flashcard';
export const isMcqQuestion = (q: RevisionQuestion): q is MCQQuestion => q.type === 'mcq';
export const isLocateQuestion = (q: RevisionQuestion): q is LocateQuestion => q.type === 'locate';
export const isFillBlankQuestion = (q: RevisionQuestion): q is FillBlankQuestion => q.type === 'fill-blank';
export const isTypedIdentifyQuestion = (q: RevisionQuestion): q is TypedIdentifyQuestion =>
  q.type === 'identify-typed';
export const isMultiSelectQuestion = (q: RevisionQuestion): q is MultiSelectQuestion => q.type === 'multi-select';
