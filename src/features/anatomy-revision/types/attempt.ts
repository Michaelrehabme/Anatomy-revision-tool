import type { Category } from './structure';
import type { QuestionType, PromptKind } from './question';
import type { Region } from './region';

export type Confidence = 'easy' | 'medium' | 'hard';

export interface UserAttempt {
  id: string;
  userId: string;
  sessionId: string;
  questionId: string;
  questionType: QuestionType;
  structureId: string;
  promptKind: PromptKind;
  region: Region;
  category: Category;
  correct: boolean;
  /** Flashcard self-rating. */
  confidence?: Confidence;
  /** Locate questions: normalized click-to-centroid distance, for analytics. */
  hitDistance?: number;
  timestamp: string;
  durationMs?: number;
}

/** SM-2-lite spaced-repetition state for one structure, per user. */
export interface StructureMastery {
  structureId: string;
  userId: string;
  attemptsTotal: number;
  attemptsCorrect: number;
  lastAttemptAt: string;
  lastConfidence?: Confidence;
  dueAt?: string;
  intervalDays?: number;
  easeFactor?: number;
}

export interface RevisionSessionSummary {
  id: string;
  userId: string;
  startedAt: string;
  finishedAt?: string;
  questionTypes: QuestionType[];
  regionFilter?: Region[];
  totalQuestions: number;
  correctCount: number;
  breakdownByCategory: Record<Category, { total: number; correct: number }>;
  breakdownByRegion: Partial<Record<Region, { total: number; correct: number }>>;
  missedStructureIds: string[];
}
