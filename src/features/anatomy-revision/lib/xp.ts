import type { QuestionType } from '../types/question';

/**
 * All XP tuning in one place, per CR-008 ("Put all tuning constants in one
 * exported config object so they can be adjusted without hunting through
 * the code"). Typed recall (fill-blank/identify-typed) pays more than
 * recognition (mcq), which pays more than a self-rated flashcard — locate
 * sits between mcq and typed recall, since it demands spatial recall but no
 * typing.
 */
export interface XpConfig {
  baseXpByQuestionType: Record<QuestionType, number>;
  /** Bonus for a structure's first correct answer within a session. */
  firstCorrectBonus: number;
  /** Flat bonus for finishing a session (vs. abandoning it mid-way). */
  sessionCompletionBonus: number;
  /** Streak multiplier grows by this fraction per streak day... */
  streakMultiplierPerDay: number;
  /** ...capped at this multiple. */
  streakMultiplierCap: number;
}

export const DEFAULT_XP_CONFIG: XpConfig = {
  baseXpByQuestionType: {
    flashcard: 5,
    mcq: 8,
    locate: 10,
    'fill-blank': 12,
    'identify-typed': 12,
    'multi-select': 10,
  },
  firstCorrectBonus: 10,
  sessionCompletionBonus: 20,
  streakMultiplierPerDay: 0.02,
  streakMultiplierCap: 2,
};

/** XP for one answer — 0 if incorrect, regardless of question type or bonuses. */
export function xpForAnswer(
  correct: boolean,
  questionType: QuestionType,
  isFirstCorrectInSession: boolean,
  config: XpConfig = DEFAULT_XP_CONFIG,
): number {
  if (!correct) return 0;
  return config.baseXpByQuestionType[questionType] + (isFirstCorrectInSession ? config.firstCorrectBonus : 0);
}

/** 1x at no streak, growing toward the cap — the streak a student walks INTO a session with, not one inflated by the session itself. */
export function streakMultiplier(streakDays: number, config: XpConfig = DEFAULT_XP_CONFIG): number {
  return Math.min(config.streakMultiplierCap, 1 + Math.max(0, streakDays) * config.streakMultiplierPerDay);
}

export interface SessionXpParams {
  /** Per-answer XP, already including the first-correct bonus, BEFORE the streak multiplier. */
  answerXp: number[];
  streakDays: number;
  /** False for a session ended early (e.g. "End session" mid-way) — no completion bonus. */
  completed: boolean;
  config?: XpConfig;
}

/** Total XP for a finished (or abandoned) session: summed answer XP, streak-multiplied, plus completion bonus. */
export function computeSessionXp(params: SessionXpParams): number {
  const config = params.config ?? DEFAULT_XP_CONFIG;
  const base = params.answerXp.reduce((sum, xp) => sum + xp, 0);
  const multiplied = Math.round(base * streakMultiplier(params.streakDays, config));
  return multiplied + (params.completed ? config.sessionCompletionBonus : 0);
}
