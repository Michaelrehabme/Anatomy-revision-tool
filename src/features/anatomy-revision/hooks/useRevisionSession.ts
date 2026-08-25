import { useCallback, useReducer, useRef } from 'react';
import type { RevisionQuestion } from '../types/question';
import type { Category, Difficulty } from '../types/structure';
import type { Region, SubRegion } from '../types/region';
import type { Confidence, RevisionSessionSummary, UserAttempt } from '../types/attempt';
import type { QuestionType } from '../types/question';
import type { AnatomyRepository } from '../data/repository';
import { updateMasteryAfterAttempt } from '../lib/mastery';

export type SessionPhase = 'setup' | 'in-progress' | 'results';

export interface AnswerRecord {
  questionId: string;
  structureId: string;
  correct: boolean;
  confidence?: Confidence;
  hitDistance?: number;
  durationMs?: number;
}

export interface RevisionSetupParams {
  types: QuestionType[];
  region?: Region;
  regions?: Region[];
  subregion?: SubRegion;
  category?: Category;
  difficulty?: Difficulty;
  mode: 'practice' | 'assessment';
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
}

type Action =
  | { type: 'START'; questions: RevisionQuestion[]; setupParams: RevisionSetupParams; sessionId: string }
  | { type: 'ANSWER'; record: AnswerRecord }
  | { type: 'NEXT' }
  | { type: 'FINISH'; summary: RevisionSessionSummary }
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
      return { ...state, phase: 'results', summary: action.summary };
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
 * Owns the setup -> in-progress -> results state machine for a revision
 * session, and persists attempts/mastery/summary through the repository as
 * the session progresses. App.tsx switches its rendered view on `phase`
 * alone — no router involved (see project README for the v1 no-router
 * decision).
 */
export function useRevisionSession(repository: AnatomyRepository | null, userId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const questionStartedAt = useRef<number>(Date.now());

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
        const attempt: UserAttempt = {
          id: `attempt-${state.sessionId}-${state.currentIndex}`,
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
          timestamp: new Date().toISOString(),
          durationMs,
        };
        await repository.recordAttempt(attempt);

        if (record.confidence) {
          const existingMastery = (await repository.getMastery(userId)).find(
            (m) => m.structureId === record.structureId,
          );
          const nextMastery = updateMasteryAfterAttempt(existingMastery, {
            structureId: record.structureId,
            userId,
            correct: record.correct,
            confidence: record.confidence,
          });
          await repository.upsertMastery(nextMastery);
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
      await repository.saveSessionSummary(summary);
    }
  }, [repository, userId, state]);

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
    start,
    submitAnswer,
    next,
    finish,
    reset,
  };
}
