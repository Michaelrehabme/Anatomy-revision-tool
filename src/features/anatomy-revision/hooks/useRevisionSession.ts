import { useCallback, useReducer, useRef } from 'react';
import type { RevisionQuestion } from '../types/question';
import type { Category, Difficulty } from '../types/structure';
import { isMuscle } from '../types/structure';
import type { Region, SubRegion } from '../types/region';
import { REGIONS } from '../types/region';
import type { Confidence, RevisionSessionSummary, UserAttempt } from '../types/attempt';
import type { QuestionType } from '../types/question';
import type { AnatomyRepository } from '../data/repository';
import { updateMasteryAfterAttempt } from '../lib/mastery';
import { ALL_STRUCTURES } from '../data/seed';
import { toDayKey, computeStreak } from '../lib/streak';
import { reconcileStreakFreezes } from '../lib/streakFreeze';
import { xpForAnswer, computeSessionXp } from '../lib/xp';
import { levelForXp } from '../lib/levels';
import { evaluateAchievements, type AchievementDoc, type AchievementId, type AchievementStats } from '../lib/achievements';

const MASTERED_INTERVAL_THRESHOLD_DAYS = 21;

export type SessionPhase = 'setup' | 'in-progress' | 'results';

export interface AnswerRecord {
  questionId: string;
  structureId: string;
  correct: boolean;
  confidence?: Confidence;
  hitDistance?: number;
  selectedAnswer?: string;
  correctAnswer?: string;
  durationMs?: number;
}

export interface RevisionSetupParams {
  types: QuestionType[];
  region?: Region;
  regions?: Region[];
  subregion?: SubRegion;
  category?: Category;
  difficulty?: Difficulty;
  /** practice/adaptive = study session (immediate feedback); assessment = exam session (no feedback until the end). See CR-009. */
  mode: 'practice' | 'assessment' | 'adaptive';
  /** Exam mode only. Session auto-finishes when it elapses. Absent = untimed. */
  timerMinutes?: number;
}

/** Everything a results screen needs to show the CR-008 payoff for one finished session. */
export interface GamificationResult {
  xpEarned: number;
  xpTotal: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  freezeConsumed: boolean;
  freezeEarned: boolean;
  newAchievements: AchievementDoc[];
}

interface SessionState {
  phase: SessionPhase;
  sessionId: string;
  questions: RevisionQuestion[];
  currentIndex: number;
  answers: AnswerRecord[];
  startedAt: string | null;
  setupParams: RevisionSetupParams | null;
  summary: RevisionSessionSummary | null;
  persistError: string | null;
  gamification: GamificationResult | null;
}

type Action =
  | { type: 'START'; questions: RevisionQuestion[]; setupParams: RevisionSetupParams; sessionId: string }
  | { type: 'ANSWER'; record: AnswerRecord }
  | { type: 'NEXT' }
  | { type: 'FINISH'; summary: RevisionSessionSummary }
  | { type: 'GAMIFICATION_RESULT'; result: GamificationResult }
  | { type: 'PERSIST_ERROR'; message: string }
  | { type: 'CLEAR_PERSIST_ERROR' }
  | { type: 'RESET' };

const initialState: SessionState = {
  phase: 'setup',
  sessionId: '',
  questions: [],
  currentIndex: 0,
  answers: [],
  startedAt: null,
  setupParams: null,
  summary: null,
  persistError: null,
  gamification: null,
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState,
        phase: 'in-progress',
        sessionId: action.sessionId,
        questions: action.questions,
        startedAt: new Date().toISOString(),
        setupParams: action.setupParams,
      };
    case 'ANSWER':
      return { ...state, answers: [...state.answers, action.record] };
    case 'NEXT':
      return { ...state, currentIndex: state.currentIndex + 1 };
    case 'FINISH':
      return { ...state, phase: 'results', summary: action.summary, gamification: null };
    case 'GAMIFICATION_RESULT':
      return { ...state, gamification: action.result };
    case 'PERSIST_ERROR':
      return { ...state, persistError: action.message };
    case 'CLEAR_PERSIST_ERROR':
      return { ...state, persistError: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

function buildSummary(state: SessionState, userId: string): RevisionSessionSummary {
  const breakdownByCategory: RevisionSessionSummary['breakdownByCategory'] = {
    muscle: { total: 0, correct: 0 },
    bone: { total: 0, correct: 0 },
    landmark: { total: 0, correct: 0 },
    joint: { total: 0, correct: 0 },
  };
  const breakdownByRegion: RevisionSessionSummary['breakdownByRegion'] = {};
  const missed = new Set<string>();

  for (const answer of state.answers) {
    const question = state.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    breakdownByCategory[question.category].total += 1;
    if (answer.correct) breakdownByCategory[question.category].correct += 1;

    const regionBucket = breakdownByRegion[question.region] ?? { total: 0, correct: 0 };
    regionBucket.total += 1;
    if (answer.correct) regionBucket.correct += 1;
    breakdownByRegion[question.region] = regionBucket;

    if (!answer.correct) missed.add(answer.structureId);
  }

  return {
    id: state.sessionId,
    userId,
    startedAt: state.startedAt ?? new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    questionTypes: state.setupParams?.types ?? [],
    regionFilter:
      state.setupParams?.regions ?? (state.setupParams?.region ? [state.setupParams.region] : undefined),
    totalQuestions: state.questions.length,
    correctCount: state.answers.filter((a) => a.correct).length,
    breakdownByCategory,
    breakdownByRegion,
    missedStructureIds: [...missed],
  };
}

/**
 * Computes XP/level/streak/achievement payoff for one finished session and
 * persists the updated profile + any newly-earned achievements. Called
 * BEFORE this session's own summary is saved, so "prior streak"/"studied
 * days" reflect history up to (not including) today's session — today's
 * contribution is folded in explicitly below, since it can't appear in
 * listSessionSummaries yet.
 */
async function computeGamification(
  repository: AnatomyRepository,
  userId: string,
  answers: AnswerRecord[],
  questions: RevisionQuestion[],
  now: Date = new Date(),
): Promise<GamificationResult> {
  const seenCorrectStructures = new Set<string>();
  const answerXp = answers.map((a) => {
    const question = questions.find((q) => q.id === a.questionId);
    if (!question) return 0;
    const isFirstCorrect = a.correct && !seenCorrectStructures.has(a.structureId);
    if (a.correct) seenCorrectStructures.add(a.structureId);
    return xpForAnswer(a.correct, question.type, isFirstCorrect);
  });

  const priorSummaries = await repository.listSessionSummaries(userId, 400);
  const studiedDayKeys = new Set(priorSummaries.map((s) => toDayKey(s.startedAt)));
  const priorStreak = computeStreak(priorSummaries, now);
  const todayKey = toDayKey(now.toISOString());
  const todayAlreadyStudied = studiedDayKeys.has(todayKey);

  const sessionXp = computeSessionXp({ answerXp, streakDays: priorStreak, completed: true });

  const profile = await repository.getGamificationProfile(userId);
  const xpTotalBefore = profile.xpTotal;
  const xpTotal = xpTotalBefore + sessionXp;
  const levelBefore = levelForXp(xpTotalBefore);
  const level = levelForXp(xpTotal);
  const xpToday = (profile.xpTodayDayKey === todayKey ? profile.xpToday : 0) + sessionXp;

  const questionTypesUsedEver = new Set(profile.questionTypesUsedEver);
  for (const a of answers) {
    const q = questions.find((qq) => qq.id === a.questionId);
    if (q) questionTypesUsedEver.add(q.type);
  }

  const freezeResult = reconcileStreakFreezes(studiedDayKeys, profile.streakFreeze, now);
  // Today's session isn't in studiedDayKeys yet (it saves right after this
  // runs) — count it unless a session earlier today already put it there.
  const displayStreak = todayAlreadyStudied ? freezeResult.effectiveStreak : freezeResult.effectiveStreak + 1;

  const masteryRows = await repository.listMastery(userId);
  const masteryByStructureId = new Map(masteryRows.map((m) => [m.structureId, m]));
  const nowMs = now.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  let masteredStructureCount = 0;
  let structuresMasteredThisWeek = 0;
  for (const m of masteryRows) {
    if ((m.intervalDays ?? 0) < MASTERED_INTERVAL_THRESHOLD_DAYS) continue;
    masteredStructureCount += 1;
    if (nowMs - Date.parse(m.lastAttemptAt) <= weekMs) structuresMasteredThisWeek += 1;
  }

  const muscleIds = ALL_STRUCTURES.filter(isMuscle).map((s) => s.id);
  const attemptedMuscleCount = muscleIds.filter((id) => masteryByStructureId.has(id)).length;

  let completedRegionCount = 0;
  for (const region of REGIONS) {
    const structuresInRegion = ALL_STRUCTURES.filter((s) => s.region === region);
    if (structuresInRegion.length === 0) continue;
    const allMastered = structuresInRegion.every(
      (s) => (masteryByStructureId.get(s.id)?.intervalDays ?? 0) >= MASTERED_INTERVAL_THRESHOLD_DAYS,
    );
    if (allMastered) completedRegionCount += 1;
  }

  const correctDurations = answers.filter((a) => a.correct && a.durationMs !== undefined).map((a) => a.durationMs!);
  const fastestCorrectAnswerMs = correctDurations.length > 0 ? Math.min(...correctDurations) : null;

  const existingAchievements = await repository.listAchievements(userId);
  const existingMap = new Map<AchievementId, AchievementDoc>(existingAchievements.map((a) => [a.id, a]));
  const stats: AchievementStats = {
    currentStreak: displayStreak,
    xpToday,
    fastestCorrectAnswerMs,
    structuresMasteredThisWeek,
    attemptedMuscleCount,
    totalMuscleCount: muscleIds.length,
    masteredStructureCount,
    completedRegionCount,
    questionTypesUsedEver,
  };
  const newAchievements = evaluateAchievements(stats, existingMap, now);
  for (const achievement of newAchievements) {
    await repository.upsertAchievement(userId, achievement);
  }

  await repository.upsertGamificationProfile(userId, {
    xpTotal,
    xpTodayDayKey: todayKey,
    xpToday,
    streakFreeze: freezeResult.state,
    questionTypesUsedEver: [...questionTypesUsedEver],
  });

  return {
    xpEarned: sessionXp,
    xpTotal,
    level,
    leveledUp: level > levelBefore,
    streak: displayStreak,
    freezeConsumed: freezeResult.freezeConsumedForDayKey !== null,
    freezeEarned: freezeResult.freezeEarned,
    newAchievements,
  };
}

/**
 * Owns the setup -> in-progress -> results state machine for a revision
 * session, and persists attempts/mastery/summary through the repository as
 * the session progresses. App.tsx switches its rendered view on `phase`
 * alone — no router involved (see project README for the v1 no-router
 * decision).
 */
export function useRevisionSession(repository: AnatomyRepository | null, userId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const questionStartedAt = useRef<number>(Date.now());
  const lastFailedPersist = useRef<(() => Promise<void>) | null>(null);

  const start = useCallback((questions: RevisionQuestion[], setupParams: RevisionSetupParams) => {
    questionStartedAt.current = Date.now();
    dispatch({
      type: 'START',
      questions,
      setupParams,
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }, []);

  const currentQuestion = state.questions[state.currentIndex] ?? null;

  const submitAnswer = useCallback(
    async (partial: Omit<AnswerRecord, 'durationMs'>) => {
      const durationMs = Date.now() - questionStartedAt.current;
      const record: AnswerRecord = { ...partial, durationMs };
      dispatch({ type: 'ANSWER', record });

      if (repository && userId && currentQuestion) {
        const persist = async () => {
          const attemptNumber = await repository.recordQuestionExposure(userId, record.questionId);
          const attempt: UserAttempt = {
            id: `attempt-${state.sessionId}-${state.currentIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId,
            sessionId: state.sessionId,
            questionId: record.questionId,
            questionType: currentQuestion.type,
            structureId: record.structureId,
            promptKind: currentQuestion.promptKind,
            region: currentQuestion.region,
            category: currentQuestion.category,
            correct: record.correct,
            confidence: record.confidence,
            hitDistance: record.hitDistance,
            selectedAnswer: record.selectedAnswer,
            correctAnswer: record.correctAnswer,
            attemptNumber,
            timestamp: new Date().toISOString(),
            durationMs,
          };
          await repository.recordAttempt(attempt);

          const existingMastery = await repository.getMasteryForStructure(userId, record.structureId);
          const nextMastery = updateMasteryAfterAttempt(existingMastery ?? undefined, {
            structureId: record.structureId,
            userId,
            correct: record.correct,
            confidence: record.confidence,
            durationMs,
          });
          await repository.upsertMastery(nextMastery);
        };

        try {
          await persist();
          lastFailedPersist.current = null;
        } catch (err) {
          console.error('Failed to save answer:', err);
          lastFailedPersist.current = persist;
          dispatch({ type: 'PERSIST_ERROR', message: 'Your last answer could not be saved.' });
        }
      }
    },
    [repository, userId, currentQuestion, state.sessionId, state.currentIndex],
  );

  const next = useCallback(() => {
    questionStartedAt.current = Date.now();
    dispatch({ type: 'NEXT' });
  }, []);

  const finish = useCallback(async () => {
    const summary = buildSummary(state, userId ?? 'anonymous');
    dispatch({ type: 'FINISH', summary });
    if (repository && userId) {
      // Computed against pre-save history (see computeGamification's doc comment), so this must run before saveSessionSummary below.
      try {
        const result = await computeGamification(repository, userId, state.answers, state.questions);
        dispatch({ type: 'GAMIFICATION_RESULT', result });
      } catch (err) {
        console.error('Failed to compute gamification result:', err);
      }

      const persist = () => repository.saveSessionSummary(summary);
      try {
        await persist();
        lastFailedPersist.current = null;
      } catch (err) {
        console.error('Failed to save session summary:', err);
        lastFailedPersist.current = persist;
        dispatch({ type: 'PERSIST_ERROR', message: 'This session summary could not be saved.' });
      }
    }
  }, [repository, userId, state]);

  const retryPersist = useCallback(async () => {
    const retry = lastFailedPersist.current;
    if (!retry) return;
    try {
      await retry();
      lastFailedPersist.current = null;
      dispatch({ type: 'CLEAR_PERSIST_ERROR' });
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, []);

  const dismissPersistError = useCallback(() => {
    lastFailedPersist.current = null;
    dispatch({ type: 'CLEAR_PERSIST_ERROR' });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const isLastQuestion = state.currentIndex >= state.questions.length - 1;

  return {
    phase: state.phase,
    questions: state.questions,
    currentIndex: state.currentIndex,
    currentQuestion,
    answers: state.answers,
    setupParams: state.setupParams,
    summary: state.summary,
    isLastQuestion,
    gamification: state.gamification,
    persistError: state.persistError,
    retryPersist,
    dismissPersistError,
    start,
    submitAnswer,
    next,
    finish,
    reset,
  };
}
