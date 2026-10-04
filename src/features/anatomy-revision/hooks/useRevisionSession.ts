import { useCallback, useReducer, useRef } from 'react';
import type { RevisionQuestion } from '../types/question';
import type { Category, Difficulty } from '../types/structure';
import { emptyCategoryBreakdown } from '../types/structure';
import type { Area, Region, SubRegion } from '../types/region';
import { REGIONS } from '../types/region';
import type { Confidence, FactMastery, RevisionSessionSummary, StructureMastery, UserAttempt } from '../types/attempt';
import type { OinaPromptKind, QuestionType } from '../types/question';
import { isOinaQuestion, isTypedIdentifyQuestion } from '../types/question';
import type { AnatomyRepository } from '../data/repository';
import { updateMasteryAfterAttempt } from '../lib/mastery';
import { markSeen, rungOfQuestion } from '../lib/ladder';
import { factsIndex, masteryLevel, structureLevel, type MasteryLevel } from '../lib/masteryLevel';
import { skillOf, updateFactMasteryAfterAttempt } from '../lib/factMastery';
import { askedAs, type AnswerRoute } from '../lib/answerRoute';
import { ALL_STRUCTURES } from '../data/seed';
import { STRUCTURE_INDEX } from '../data/structureIndex';

const STRUCTURES_BY_ID = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
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
  /**
   * False for an exposure with nothing to be right or wrong about — since
   * CR-018 that means a flashcard, which is purely for learning. Ungraded
   * answers still earn their XP and still record an attempt, but they are
   * excluded from the session score and never touch SM-2 scheduling.
   * Absent means graded.
   */
  graded?: boolean;
  confidence?: Confidence;
  /** Multi-part formats only: share of the answer that was right, 0-1. Softens a wrong answer's schedule. */
  partialCredit?: number;
  hitDistance?: number;
  /** Locate questions on a landmark: the archery score, 1-10 in, 0 outside. */
  accuracy?: number;
  selectedAnswer?: string;
  correctAnswer?: string;
  durationMs?: number;
  /**
   * Set when the question was answered some other way than it was asked — a
   * locate question answered in words. It decides what the attempt is
   * recorded as and what it is credited to (lib/answerRoute.ts).
   */
  route?: AnswerRoute;
}

export interface RevisionSetupParams {
  types: QuestionType[];
  region?: Region;
  regions?: Region[];
  subregion?: SubRegion;
  areas?: Area[];
  /** OINA only (CR-018) — the muscle groups the session was scoped to. */
  groups?: string[];
  /** OINA only (CR-018) — which of the four facts the session asks about. */
  oinaPromptKinds?: OinaPromptKind[];
  /** OINA only (CR-018) — how many attempts get a teaching card first; 0 for none. */
  learnCardAttempts?: number;
  category?: Category;
  /** The categories the session was scoped to. Empty/absent = every category. */
  categories?: Category[];
  difficulty?: Difficulty;
  /** practice/adaptive = study session (immediate feedback); assessment = exam session (no feedback until the end). See CR-009. */
  mode: 'practice' | 'assessment' | 'adaptive';
  /** Exam mode only. Session auto-finishes when it elapses. Absent = untimed. */
  timerMinutes?: number;
  /** Present when this session is an attempt at a class assignment — stamped onto the summary, and the results screen marks it against the pass mark. */
  assignment?: { id: string; title: string; targetAccuracyPct: number };
}

/**
 * A structure whose mastery level (lib/masteryLevel.ts) moved during the
 * session: where it stood before its first answer and where it ended.
 */
export interface LevelChange {
  structureId: string;
  from: MasteryLevel;
  to: MasteryLevel;
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
  /** Keyed by structure; `from` is fixed by the first answer, `to` follows the latest. */
  levels: Record<string, { from: MasteryLevel; to: MasteryLevel }>;
}

type Action =
  | { type: 'START'; questions: RevisionQuestion[]; setupParams: RevisionSetupParams; sessionId: string }
  | { type: 'ANSWER'; record: AnswerRecord }
  | { type: 'NEXT' }
  | { type: 'FINISH'; summary: RevisionSessionSummary }
  | { type: 'GAMIFICATION_RESULT'; result: GamificationResult }
  | { type: 'LEVEL'; structureId: string; from: MasteryLevel; to: MasteryLevel }
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
  levels: {},
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
    case 'LEVEL': {
      const from = state.levels[action.structureId]?.from ?? action.from;
      return { ...state, levels: { ...state.levels, [action.structureId]: { from, to: action.to } } };
    }
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

function buildSummary(state: SessionState, userId: string, partial = false): RevisionSessionSummary {
  const breakdownByCategory = emptyCategoryBreakdown();
  const breakdownByRegion: RevisionSessionSummary['breakdownByRegion'] = {};
  const missed = new Set<string>();

  for (const answer of state.answers) {
    const question = state.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;
    // A learn card has no answer to be right or wrong about, so counting it
    // would put "16/24" on a session with 16 questions in it (CR-018).
    if (answer.graded === false) continue;

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
    // A session left early reports the questions it actually asked, so a
    // three-answer walk-away is 3/3 in history rather than 3/20.
    totalQuestions: partial
      ? state.answers.filter((a) => a.graded !== false).length
      : state.questions.filter((q) => q.type !== 'flashcard').length,
    correctCount: state.answers.filter((a) => a.graded !== false && a.correct).length,
    breakdownByCategory,
    breakdownByRegion,
    missedStructureIds: [...missed],
    // A partial session is never an assignment attempt: scoring four
    // answered questions would pass anything.
    assignmentId: partial ? undefined : state.setupParams?.assignment?.id,
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
    // An ungraded learn card still pays its base XP, but it can neither claim
    // the first-correct bonus nor consume it — otherwise the card shown
    // immediately before a question would take the bonus that question earned.
    const graded = a.graded !== false;
    const isFirstCorrect = graded && a.correct && !seenCorrectStructures.has(a.structureId);
    if (graded && a.correct) seenCorrectStructures.add(a.structureId);
    return xpForAnswer(a.correct, askedAs(question, a.route).credited.type, isFirstCorrect, {
      hints: question.type === 'identify-typed' ? question.hints : undefined,
    });
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
    if (q) questionTypesUsedEver.add(askedAs(q, a.route).credited.type);
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

  const muscleIds = STRUCTURE_INDEX.filter((s) => s.category === 'muscle').map((s) => s.id);
  const attemptedMuscleCount = muscleIds.filter((id) => masteryByStructureId.has(id)).length;

  let completedRegionCount = 0;
  for (const region of REGIONS) {
    const structuresInRegion = STRUCTURE_INDEX.filter((s) => s.region === region);
    if (structuresInRegion.length === 0) continue;
    const allMastered = structuresInRegion.every(
      (s) => (masteryByStructureId.get(s.id)?.intervalDays ?? 0) >= MASTERED_INTERVAL_THRESHOLD_DAYS,
    );
    if (allMastered) completedRegionCount += 1;
  }

  const correctDurations = answers
    .filter((a) => a.graded !== false && a.correct && a.durationMs !== undefined)
    .map((a) => a.durationMs!);
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
  /** This student's fact rows, read on the first answer and kept current here. */
  const factRows = useRef<FactMastery[] | null>(null);

  const start = useCallback((questions: RevisionQuestion[], setupParams: RevisionSetupParams) => {
    questionStartedAt.current = Date.now();
    // Re-read fact rows each session: another device, or another account on
    // this one, may have changed them since.
    factRows.current = null;
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
        // A locate question answered in words is recorded as what it was, and
        // credited where lib/answerRoute.ts says: never, unless the owner
        // decides otherwise, as a locate success.
        const { recorded, credited } = askedAs(currentQuestion, record.route);
        const persist = async () => {
          const attemptNumber = await repository.recordQuestionExposure(userId, record.questionId);
          const attempt: UserAttempt = {
            id: `attempt-${state.sessionId}-${state.currentIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId,
            sessionId: state.sessionId,
            questionId: record.questionId,
            questionType: recorded.type,
            structureId: record.structureId,
            promptKind: recorded.promptKind,
            region: currentQuestion.region,
            category: currentQuestion.category,
            correct: record.correct,
            confidence: record.confidence,
            hitDistance: record.hitDistance,
            accuracy: record.accuracy,
            selectedAnswer: record.selectedAnswer,
            correctAnswer: record.correctAnswer,
            attemptNumber,
            timestamp: new Date().toISOString(),
            durationMs,
            graded: record.graded,
            hints: isTypedIdentifyQuestion(currentQuestion) ? (currentQuestion.hints ?? 'full') : undefined,
          };
          await repository.recordAttempt(attempt);

          // Flashcards are purely for learning since CR-018 — they carry no
          // judgement, so they must not feed SM-2 scheduling. The exposure is
          // still recorded above, so analytics can see what was studied. It
          // does mark the structure SEEN: a structure only ever shown leaves
          // the ladder's flashcard rung (lib/ladder.ts) and counts as met on
          // the account page, without a schedule or an accuracy.
          if (record.graded === false) {
            const seen = await repository.getMasteryForStructure(userId, record.structureId);
            if (!seen) {
              const seenRow = markSeen(record.structureId, userId);
              await repository.upsertMastery(seenRow);
              dispatch({ type: 'LEVEL', structureId: record.structureId, from: masteryLevel(undefined).level, to: masteryLevel(seenRow).level });
            }
            return;
          }

          // One answer moves ONE question type's schedule (owner, 2 Oct 2026):
          // naming on the structure's row, anything else on that fact's own
          // row. A missed origin used to drag the whole deltoid back to
          // tomorrow, and an easy naming answer could be undone by the next
          // fact question on the same structure.
          const skill = skillOf(credited.type, credited.promptKind);
          const existingMastery = await repository.getMasteryForStructure(userId, record.structureId);
          // The rows are read once per session and kept here, not re-read per
          // answer: a long-standing student has hundreds, and every answer
          // needs them to work out the level.
          if (!factRows.current) factRows.current = await repository.listFactMastery(userId);
          const factsBefore = factRows.current;
          let nextMastery = existingMastery ?? undefined;
          let factsAfter = factsBefore;

          if (skill === 'identify') {
            nextMastery = updateMasteryAfterAttempt(existingMastery ?? undefined, {
              structureId: record.structureId,
              userId,
              correct: record.correct,
              confidence: record.confidence,
              partialCredit: record.partialCredit,
              durationMs,
              // What this question actually demanded, so the ladder only promotes
              // on answers at the structure's own rung or harder (lib/ladder.ts).
              // Without it a run of locate taps carried a structure to typed-bare
              // and the next session asked for its name with no hints.
              askedRung: rungOfQuestion(
                credited.type,
                isTypedIdentifyQuestion(currentQuestion) ? currentQuestion.hints : undefined,
                credited.promptKind,
              ),
            });
            await repository.upsertMastery(nextMastery);
          } else {
            const existingFact = factsBefore.find((f) => f.structureId === record.structureId && f.promptKind === skill);
            const nextFact = updateFactMasteryAfterAttempt(existingFact, {
              userId,
              structureId: record.structureId,
              promptKind: skill,
              correct: record.correct,
              confidence: record.confidence,
              partialCredit: record.partialCredit,
              askedStage: isOinaQuestion(currentQuestion)
                ? currentQuestion.format === 'select'
                  ? 'select'
                  : currentQuestion.hints === 'none'
                    ? 'typed-bare'
                    : 'typed-hinted'
                : 'select',
            });
            await repository.upsertFactMastery(nextFact);
            factsAfter = [...factsBefore.filter((f) => f !== existingFact), nextFact];
            factRows.current = factsAfter;
          }

          const structure = STRUCTURES_BY_ID.get(record.structureId);
          const levelOf = (m: StructureMastery | undefined, rows: FactMastery[]) =>
            structure ? structureLevel(structure, m, factsIndex(rows)).level : masteryLevel(m).level;
          dispatch({
            type: 'LEVEL',
            structureId: record.structureId,
            from: levelOf(existingMastery ?? undefined, factsBefore),
            to: levelOf(nextMastery, factsAfter),
          });
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

  /**
   * Leaves a session part-way through without losing what was answered.
   *
   * A summary used to be written only by finish(), so a student who answered
   * eight questions and tapped Today left no trace: no bar on "This week",
   * no day on the streak, while every attempt and mastery row was saved. The
   * partial summary carries the answers given, no assignment id and no
   * gamification — XP and the completion bonus are for finishing.
   */
  const abandon = useCallback(async () => {
    const answered = state.answers.some((a) => a.graded !== false);
    const summary = answered ? buildSummary(state, userId ?? 'anonymous', true) : null;
    dispatch({ type: 'RESET' });
    if (summary && repository && userId) {
      try {
        await repository.saveSessionSummary(summary);
      } catch (err) {
        console.error('Failed to save partial session summary:', err);
      }
    }
  }, [repository, userId, state]);

  const isLastQuestion = state.currentIndex >= state.questions.length - 1;

  const levelChanges: LevelChange[] = Object.entries(state.levels)
    .filter(([, l]) => l.from !== l.to)
    .map(([structureId, l]) => ({ structureId, ...l }));

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
    levelChanges,
    persistError: state.persistError,
    retryPersist,
    dismissPersistError,
    start,
    submitAnswer,
    next,
    finish,
    reset,
    abandon,
  };
}
