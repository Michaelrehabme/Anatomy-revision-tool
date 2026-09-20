import type { Category } from './structure';
import type { QuestionType, PromptKind, OinaPromptKind } from './question';
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
  /** Locate questions: normalized distance from the tap to the target, for analytics. */
  hitDistance?: number;
  /**
   * Locate questions on a landmark: the archery score, 1-10 in, 0 outside.
   *
   * Comparable across questions in a way `hitDistance` is not — that is a
   * fraction of an image, so the same number means a different distance on the
   * femur than on the atlas, and a different one again at a different crop.
   * This is normalized to the landmark's own size by construction.
   */
  accuracy?: number;
  /**
   * The literal choice text (MCQ) or typed string (fill-blank, identify-typed)
   * the student submitted. Never an index — choices are shuffled per session,
   * so an index means nothing once detached from that session's ordering.
   */
  selectedAnswer?: string;
  /** Denormalised canonical answer, so analytics never needs a question lookup. */
  correctAnswer?: string;
  /** 1 = first time this user has ever attempted this questionId. See recordQuestionExposure. */
  attemptNumber: number;
  timestamp: string;
  durationMs?: number;
  /**
   * False for an exposure that carries no judgement — a flashcard, which
   * since CR-018 is purely for learning and has no answer to be right or
   * wrong about. Absent means graded, so existing rows keep their meaning.
   * Anything computing accuracy must exclude `graded === false`; the row is
   * still recorded so that analytics can see what was studied.
   */
  graded?: boolean;
}

/**
 * Per-(muscle, fact) recall progress — the axis StructureMastery deliberately
 * does not have (CR-018). StructureMastery is keyed on structureId alone, so
 * it cannot express "knows the nerve supply of biceps femoris but not its
 * insertion", which is exactly the distinction OINA escalates on.
 *
 * Kept alongside StructureMastery rather than folded into it: SM-2 scheduling
 * is per-structure by design, and one row per (structure, fact) would either
 * quadruple that collection or need an unbounded map on the mastery doc.
 */
export interface FactMastery {
  userId: string;
  structureId: string;
  promptKind: OinaPromptKind;
  attemptsTotal: number;
  attemptsCorrect: number;
  /** Consecutive fully-correct answers — the promotion trigger. */
  streak: number;
  /** Consecutive wrong answers — the demotion trigger. */
  missStreak: number;
  /** Whether the last attempt was correct; drives the learn-card rule. */
  lastCorrect: boolean;
  lastAttemptAt: string;
  /** True once this fact has been promoted from select to typed recall. */
  typed: boolean;
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
  /** Running per-structure answer-speed baseline (EWMA), used to derive an implicit confidence. */
  durationEwmaMs?: number;
  /** Times a structure that had reached a 7+ day interval was then answered incorrectly. */
  lapses?: number;
  /** True once lapses reaches the leech threshold; interval growth is capped while true. */
  isLeech?: boolean;
  /**
   * The difficulty ladder (lib/ladder.ts). Absent on rows written before it
   * existed, which rungFor places by accuracy. A flashcard writes a row with
   * firstSeenAt and no attempts, so a structure only ever shown still counts
   * as seen and leaves the flashcard rung.
   */
  rung?: 'flashcard' | 'mcq' | 'typed-hinted' | 'typed-bare';
  /** Consecutive correct answers on the current rung — the promotion trigger. */
  rungStreak?: number;
  /** Consecutive misses on the current rung — the demotion trigger. */
  rungMissStreak?: number;
  /** When the student first met this structure, by any question or a flashcard. */
  firstSeenAt?: string;
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
  /**
   * Set when the session was an attempt at a class assignment, and only then —
   * a "retry the missed" follow-up is not an attempt, since scoring four
   * re-asked questions would pass anything. The educator's completion figures
   * read sessions carrying their assignment's id; see
   * educator/lib/assignmentCompletion.ts.
   */
  assignmentId?: string;
}
