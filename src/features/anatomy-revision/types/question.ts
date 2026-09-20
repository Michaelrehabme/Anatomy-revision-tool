import type { Category, Difficulty } from './structure';
import type { ImageMode } from './image';
import type { Area, Region, SubRegion } from './region';

export type QuestionType = 'flashcard' | 'mcq' | 'locate' | 'fill-blank' | 'identify-typed' | 'multi-select' | 'oina';

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
  /** The area this question belongs to (CR-017) — what session headers show, since areas
   * are what the user filtered by. Region is too coarse to name here: a knee question
   * labelled "Lower Leg & Foot" contradicts the "Knee" chip they picked. */
  area?: Area;
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
  /** The opening picture — for a rotation set, the angle where the target shows best. */
  imageId: string;
  imageMode: ImageMode;
  targetStructureId: string;
  /**
   * The other angles of the same picture the student may turn to, in angle
   * order, `imageId` included. Present only for images rendered as a rotation
   * set (the ligament plates first). One question per structure, not one per
   * angle: a student who turns the joint to find the ligament has answered
   * one question, and the scheduler should count it once. Each frame carries
   * its own hotspots, so the hit test runs against whichever angle is showing.
   */
  frameImageIds?: string[];
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
  /**
   * One extra box per attachment, for ligaments: a two-attachment ligament
   * gets two, graded order-independently by lib/oinaAnswer's gradeTypedSlots.
   * The question is correct only when the name AND every attachment are.
   * Absent for everything that is not a ligament.
   */
  attachmentSlots?: { label: string; accepted: string[] }[];
  /**
   * Whether the letter-count and first-letter hints are shown. 'none' is the
   * top rung of the difficulty ladder (lib/ladder.ts) and pays more XP.
   * Absent means 'full', so every existing question keeps its hints.
   */
  hints?: 'full' | 'none';
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

/** The four facts OINA Cards drill (CR-018). */
export const OINA_PROMPT_KINDS = ['origin', 'insertion', 'nerve', 'action'] as const;
export type OinaPromptKind = (typeof OINA_PROMPT_KINDS)[number];

interface OinaQuestionBase extends RevisionQuestionBase {
  type: 'oina';
  promptKind: OinaPromptKind;
  prompt: string;
  /**
   * Scoped to the fact being asked — NOT summarizeStructure, which prints
   * origin, insertion, nerve and action together. OINA emits four questions
   * per muscle and a shuffled session routinely places them near each other,
   * so the full summary would hand over the next three answers.
   */
  explanation: string;
}

/**
 * Recognition phase: "select every origin of X". Unlike MultiSelectQuestion
 * this is scored all-or-nothing — the whole point is knowing the complete
 * set, so partial credit would defeat it. Any number of choices may be
 * correct, up to all of them.
 */
export interface OinaSelectQuestion extends OinaQuestionBase {
  format: 'select';
  choices: string[];
  /** Indices into `choices`; every one must be selected and nothing else. */
  correctIndices: number[];
}

/**
 * Recall phase: one box per authored value, so biceps femoris' two origins
 * are two boxes. Graded order-independently — see lib/oinaAnswer.ts.
 */
export interface OinaTypedQuestion extends OinaQuestionBase {
  format: 'typed';
  slots: { label: string; accepted: string[] }[];
}

/**
 * One QuestionType with the format as a nested discriminant, rather than two
 * members. The format is never a user choice — it escalates per (muscle,
 * fact) with the student's own accuracy (see lib/factMastery.ts) — and two
 * members would have to be selected together everywhere, while silently
 * breaking adaptive mode: pickAdaptiveQuestionType's ladder is a flat
 * QuestionType[], so neither member would appear in any tier and every
 * adaptive session would fall through to the first one requested.
 */
export type OinaQuestion = OinaSelectQuestion | OinaTypedQuestion;

export type RevisionQuestion =
  | FlashcardQuestion
  | MCQQuestion
  | LocateQuestion
  | FillBlankQuestion
  | TypedIdentifyQuestion
  | MultiSelectQuestion
  | OinaQuestion;

export const isFlashcardQuestion = (q: RevisionQuestion): q is FlashcardQuestion => q.type === 'flashcard';
export const isMcqQuestion = (q: RevisionQuestion): q is MCQQuestion => q.type === 'mcq';
export const isLocateQuestion = (q: RevisionQuestion): q is LocateQuestion => q.type === 'locate';
export const isFillBlankQuestion = (q: RevisionQuestion): q is FillBlankQuestion => q.type === 'fill-blank';
export const isTypedIdentifyQuestion = (q: RevisionQuestion): q is TypedIdentifyQuestion =>
  q.type === 'identify-typed';
export const isMultiSelectQuestion = (q: RevisionQuestion): q is MultiSelectQuestion => q.type === 'multi-select';
export const isOinaQuestion = (q: RevisionQuestion): q is OinaQuestion => q.type === 'oina';
