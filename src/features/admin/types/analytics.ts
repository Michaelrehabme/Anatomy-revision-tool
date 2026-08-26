import type { Category } from '../../anatomy-revision/types/structure';
import type { QuestionType } from '../../anatomy-revision/types/question';
import type { Region } from '../../anatomy-revision/types/region';

/** Shared filter set for the weakness table (and, where applicable, other analytics screens). */
export interface AnalyticsFilters {
  region?: Region;
  category?: Category;
  questionType?: QuestionType;
}

export interface StructureWeaknessRow {
  structureId: string;
  name: string;
  region: Region;
  category: Category;
  totalAttempts: number;
  accuracyPct: number;
  /** Accuracy over only the attempts where attemptNumber === 1 — see firstAttemptAccuracyPct vs accuracyPct in the table for the "learning vs forgetting" read. */
  firstAttemptAccuracyPct: number | null;
  firstAttemptCount: number;
  distinctUsers: number;
  meanAnswerTimeMs: number | null;
}

export interface WrongAnswerCount {
  answer: string;
  count: number;
}

/** Per-question breakdown of wrong answers, for the highest-traffic distractor screen. */
export interface QuestionDistractorSummary {
  questionId: string;
  structureId: string;
  structureName: string;
  questionType: QuestionType;
  correctAnswer: string | null;
  totalAttempts: number;
  totalWrong: number;
  accuracyPct: number;
  topWrongAnswers: WrongAnswerCount[];
}

/** One (correctAnswer, selectedAnswer) confusion pair, ranked by frequency across the whole dataset. */
export interface ConfusionPair {
  correctAnswer: string;
  selectedAnswer: string;
  count: number;
  /** Structure ids the correct answer belongs to, when known — usually one, occasionally more if the same answer text is shared. */
  structureIds: string[];
}

export type QuestionHealthFlagType = 'low-accuracy' | 'no-discrimination' | 'slow-despite-accurate';

export interface QuestionHealthFlag {
  questionId: string;
  structureId: string;
  structureName: string;
  questionType: QuestionType;
  flagType: QuestionHealthFlagType;
  reason: string;
  totalAttempts: number;
  accuracyPct: number;
  meanAnswerTimeMs: number | null;
}

export interface RegionAccuracyBar {
  region: Region;
  total: number;
  correct: number;
  accuracyPct: number;
}

export interface ActiveUsersPoint {
  /** Calendar day, YYYY-MM-DD (UTC). */
  date: string;
  activeUsers: number;
}

export interface RetentionStats {
  /** Of users first seen at least 1/7/30 days before the dataset's latest activity, the share seen active again after that gap. */
  day1Pct: number | null;
  day7Pct: number | null;
  day30Pct: number | null;
}

export interface CohortOverview {
  activeUsersByDay: ActiveUsersPoint[];
  accuracyByRegion: RegionAccuracyBar[];
  retention: RetentionStats;
  meanSessionLengthMinutes: number | null;
  completionRatePct: number | null;
  totalSessions: number;
}

/** Firestore doc shape for questionReviews/{questionId} — see data/questionReviewsRepository.ts. */
export interface QuestionReview {
  questionId: string;
  reviewedBy: string;
  reviewedAt: string;
  flagType: QuestionHealthFlagType;
  notes?: string;
}
