import type { QuestionType } from '../types/question';

/**
 * Two tiers per CR-008: "records" are personal bests that keep moving (the
 * value updates and earnedAt refreshes every time it's beaten — the thing a
 * user chases indefinitely), "milestones" are one-time unlocks (earned once,
 * never re-evaluated after).
 */
export type AchievementTier = 'record' | 'milestone';

export type AchievementId =
  | 'record-longest-streak'
  | 'record-most-xp-in-a-day'
  | 'record-fastest-correct-answer-ms'
  | 'record-most-structures-mastered-in-a-week'
  | 'milestone-first-region-completed'
  | 'milestone-all-muscles-attempted'
  | 'milestone-50-structures-mastered'
  | 'milestone-30-day-streak'
  | 'milestone-all-question-types-used';

export interface AchievementDefinition {
  id: AchievementId;
  tier: AchievementTier;
  title: string;
  description: string;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: 'record-longest-streak', tier: 'record', title: 'Longest streak', description: 'Your longest consecutive-day study streak.' },
  { id: 'record-most-xp-in-a-day', tier: 'record', title: 'Most XP in a day', description: 'The most XP earned in a single day.' },
  { id: 'record-fastest-correct-answer-ms', tier: 'record', title: 'Fastest correct answer', description: 'Your quickest correct answer.' },
  {
    id: 'record-most-structures-mastered-in-a-week',
    tier: 'record',
    title: 'Best week',
    description: 'Most structures reaching mastery in a single 7-day window.',
  },
  { id: 'milestone-first-region-completed', tier: 'milestone', title: 'Region complete', description: 'Mastered every structure in one region.' },
  { id: 'milestone-all-muscles-attempted', tier: 'milestone', title: 'Full muscle survey', description: 'Attempted every muscle at least once.' },
  { id: 'milestone-50-structures-mastered', tier: 'milestone', title: 'Half-century', description: '50 structures at mastery.' },
  { id: 'milestone-30-day-streak', tier: 'milestone', title: 'Thirty days', description: 'A 30-day study streak.' },
  {
    id: 'milestone-all-question-types-used',
    tier: 'milestone',
    title: 'Every angle',
    description: 'Answered a flashcard, MCQ, locate, fill-blank, and typed-identify question.',
  },
];

export interface AchievementDoc {
  id: AchievementId;
  earnedAt: string;
  /** Only present for 'record' tier achievements — the record's current value (lower is better for the fastest-answer record, higher for the rest). */
  value?: number;
}

export interface AchievementStats {
  currentStreak: number;
  xpToday: number;
  /** null when no correct, timed answer exists to compare (e.g. locate questions with no duration). */
  fastestCorrectAnswerMs: number | null;
  structuresMasteredThisWeek: number;
  attemptedMuscleCount: number;
  totalMuscleCount: number;
  masteredStructureCount: number;
  completedRegionCount: number;
  questionTypesUsedEver: Set<QuestionType>;
}

const ALL_QUESTION_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed'];

/**
 * Diffs current stats against previously-earned achievements, returning
 * only the docs that are new or improved — the caller persists these and
 * toasts them. Pure and side-effect-free: fetching stats/existing docs and
 * writing the result both happen at the call site (useRevisionSession).
 */
export function evaluateAchievements(
  stats: AchievementStats,
  existing: Map<AchievementId, AchievementDoc>,
  now: Date = new Date(),
): AchievementDoc[] {
  const updates: AchievementDoc[] = [];
  const earnedAt = now.toISOString();

  function maybeHigherIsBetterRecord(id: AchievementId, value: number) {
    if (value <= 0) return;
    const prev = existing.get(id);
    if (!prev || value > (prev.value ?? -Infinity)) {
      updates.push({ id, earnedAt, value });
    }
  }

  function maybeMilestone(id: AchievementId, met: boolean) {
    if (met && !existing.has(id)) {
      updates.push({ id, earnedAt });
    }
  }

  maybeHigherIsBetterRecord('record-longest-streak', stats.currentStreak);
  maybeHigherIsBetterRecord('record-most-xp-in-a-day', stats.xpToday);
  maybeHigherIsBetterRecord('record-most-structures-mastered-in-a-week', stats.structuresMasteredThisWeek);

  if (stats.fastestCorrectAnswerMs !== null) {
    const prev = existing.get('record-fastest-correct-answer-ms');
    if (!prev || stats.fastestCorrectAnswerMs < (prev.value ?? Infinity)) {
      updates.push({ id: 'record-fastest-correct-answer-ms', earnedAt, value: stats.fastestCorrectAnswerMs });
    }
  }

  maybeMilestone('milestone-first-region-completed', stats.completedRegionCount > 0);
  maybeMilestone('milestone-all-muscles-attempted', stats.totalMuscleCount > 0 && stats.attemptedMuscleCount >= stats.totalMuscleCount);
  maybeMilestone('milestone-50-structures-mastered', stats.masteredStructureCount >= 50);
  maybeMilestone('milestone-30-day-streak', stats.currentStreak >= 30);
  maybeMilestone(
    'milestone-all-question-types-used',
    ALL_QUESTION_TYPES.every((t) => stats.questionTypesUsedEver.has(t)),
  );

  return updates;
}
