import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRevisionSession } from '../useRevisionSession';
import { createMemoryRepository } from '../../data/memoryRepository';
import type { MCQQuestion } from '../../types/question';

function mcqQuestion(overrides: Partial<MCQQuestion> = {}): MCQQuestion {
  return {
    id: 'q-deltoid-mcq',
    type: 'mcq',
    structureId: 'deltoid',
    region: 'shoulder-arm',
    category: 'muscle',
    difficulty: 'easy',
    promptKind: 'identify',
    prompt: 'Which muscle is highlighted?',
    choices: ['Deltoid', 'Biceps brachii', 'Trapezius', 'Triceps brachii'],
    correctIndex: 0,
    explanation: 'The deltoid abducts the arm.',
    ...overrides,
  };
}

describe('useRevisionSession submitAnswer', () => {
  it('captures the exact wrong distractor text as selectedAnswer, alongside the correctAnswer', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const question = mcqQuestion();

    act(() => result.current.start([question], { types: ['mcq'], mode: 'practice' }));

    await act(async () => {
      await result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: false,
        confidence: 'hard',
        selectedAnswer: 'Biceps brachii',
        correctAnswer: 'Deltoid',
      });
    });

    const [attempt] = await repository.listAttempts({ userId: 'user-1' });
    expect(attempt.correct).toBe(false);
    expect(attempt.selectedAnswer).toBe('Biceps brachii');
    expect(attempt.correctAnswer).toBe('Deltoid');
  });

  it('sets attemptNumber to 1 on first exposure and increments on repeat exposure to the same questionId', async () => {
    const repository = createMemoryRepository();
    const question = mcqQuestion();

    const first = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => first.result.current.start([question], { types: ['mcq'], mode: 'practice' }));
    await act(async () => {
      await first.result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Deltoid',
        correctAnswer: 'Deltoid',
      });
    });

    const second = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => second.result.current.start([question], { types: ['mcq'], mode: 'practice' }));
    await act(async () => {
      await second.result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: false,
        confidence: 'hard',
        selectedAnswer: 'Trapezius',
        correctAnswer: 'Deltoid',
      });
    });

    const attempts = await repository.listAttempts({ userId: 'user-1', questionId: question.id });
    const byNumber = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber);
    expect(byNumber.map((a) => a.attemptNumber)).toEqual([1, 2]);
  });

  it('does not increment attemptNumber for a different questionId', async () => {
    const repository = createMemoryRepository();
    const questionA = mcqQuestion({ id: 'q-a' });
    const questionB = mcqQuestion({ id: 'q-b', structureId: 'trapezius' });

    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([questionA, questionB], { types: ['mcq'], mode: 'practice' }));

    await act(async () => {
      await result.current.submitAnswer({
        questionId: questionA.id,
        structureId: questionA.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Deltoid',
        correctAnswer: 'Deltoid',
      });
    });
    act(() => result.current.next());
    await act(async () => {
      await result.current.submitAnswer({
        questionId: questionB.id,
        structureId: questionB.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Deltoid',
        correctAnswer: 'Deltoid',
      });
    });

    const attempts = await repository.listAttempts({ userId: 'user-1' });
    expect(attempts.every((a) => a.attemptNumber === 1)).toBe(true);
  });

  it('updates the mastery schedule even with no explicit confidence (e.g. fill-blank)', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const question = mcqQuestion();

    act(() => result.current.start([question], { types: ['mcq'], mode: 'practice' }));

    await act(async () => {
      await result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: false,
        selectedAnswer: 'Biceps brachii',
        correctAnswer: 'Deltoid',
      });
    });

    const [mastery] = await repository.listMastery('user-1');
    expect(mastery.structureId).toBe(question.structureId);
    expect(mastery.intervalDays).toBe(1);
    expect(mastery.dueAt).toBeDefined();
  });
});

describe('useRevisionSession finish', () => {
  it('awards session XP, updates the running total, and persists the gamification profile', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const question = mcqQuestion();

    act(() => result.current.start([question], { types: ['mcq'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Deltoid',
        correctAnswer: 'Deltoid',
      });
    });
    await act(async () => {
      await result.current.finish();
    });

    expect(result.current.gamification).not.toBeNull();
    expect(result.current.gamification!.xpEarned).toBeGreaterThan(0);
    expect(result.current.gamification!.streak).toBe(1);

    const profile = await repository.getGamificationProfile('user-1');
    expect(profile.xpTotal).toBe(result.current.gamification!.xpEarned);
    expect(profile.questionTypesUsedEver).toContain('mcq');
  });
});
