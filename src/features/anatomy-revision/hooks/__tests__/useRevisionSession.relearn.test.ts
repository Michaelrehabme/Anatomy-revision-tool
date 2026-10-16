import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRevisionSession, type RevisionSetupParams } from '../useRevisionSession';
import { createMemoryRepository } from '../../data/memoryRepository';
import type { AnatomyRepository } from '../../data/repository';
import type { FlashcardQuestion, MCQQuestion, RevisionQuestion } from '../../types/question';
import { REASK_GAP, RELEARN_AFTER_WRONG } from '../../lib/relearn';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { isMcqQuestion } from '../../types/question';

/**
 * WRONG THREE TIMES RUNNING (lib/relearn.ts, owner 16 Oct 2026): the card
 * comes next, and the same question two questions after the card, unscored.
 */

const card: FlashcardQuestion = {
  id: 'relearn-q-deltoid-mcq',
  type: 'flashcard',
  structureId: 'deltoid',
  region: 'shoulder-arm',
  category: 'muscle',
  difficulty: 'easy',
  promptKind: 'identify',
  front: { text: 'Which muscle is highlighted?' },
  back: { text: 'Deltoid' },
};

const target: MCQQuestion = {
  id: 'q-deltoid-mcq',
  type: 'mcq',
  structureId: 'deltoid',
  region: 'shoulder-arm',
  category: 'muscle',
  difficulty: 'easy',
  promptKind: 'identify',
  prompt: 'Which muscle is highlighted?',
  choices: ['Trapezius', 'Deltoid', 'Biceps brachii', 'Triceps brachii'],
  correctIndex: 1,
  explanation: 'The deltoid caps the shoulder.',
  relearnCard: card,
};

const filler = (n: number): MCQQuestion => ({
  ...target,
  id: `q-filler-${n}`,
  structureId: `filler-${n}`,
  relearnCard: undefined,
});

const PRACTICE: RevisionSetupParams = { types: ['mcq'], mode: 'practice' };

async function missIt(repository: AnatomyRepository, questions: RevisionQuestion[], params = PRACTICE) {
  const hook = renderHook(() => useRevisionSession(repository, 'user-1'));
  act(() => hook.result.current.start(questions, params));
  await act(async () => {
    await hook.result.current.submitAnswer({
      questionId: target.id,
      structureId: target.structureId,
      correct: false,
      confidence: 'hard',
      selectedAnswer: 'Trapezius',
      correctAnswer: 'Deltoid',
    });
  });
  return hook;
}

const session = () => [target, filler(1), filler(2), filler(3), filler(4)];

describe('relearning a question missed three times running', () => {
  it('counts the misses on the progress record, across sessions', async () => {
    const repository = createMemoryRepository();
    await missIt(repository, session());
    await missIt(repository, session());
    expect((await repository.getMasteryForStructure('user-1', 'deltoid'))?.wrongInARow).toBe(2);
  });

  it('leaves the session alone for the first two misses', async () => {
    const repository = createMemoryRepository();
    await missIt(repository, session());
    const { result } = await missIt(repository, session());
    expect(result.current.questions.map((q) => q.id)).toEqual(session().map((q) => q.id));
  });

  it('on the third, puts the card next and the same question two questions after it', async () => {
    const repository = createMemoryRepository();
    for (let i = 1; i < RELEARN_AFTER_WRONG; i++) await missIt(repository, session());
    const { result } = await missIt(repository, session());

    const ids = result.current.questions.map((q) => q.id);
    expect(ids).toEqual([target.id, card.id, 'q-filler-1', 'q-filler-2', target.id, 'q-filler-3', 'q-filler-4']);
    expect(ids.indexOf(target.id, 1) - ids.indexOf(card.id)).toBe(REASK_GAP + 1);
    const again = result.current.questions[4] as MCQQuestion;
    // The very same question: prompt and choices in the same order.
    expect(again.choices).toEqual(target.choices);
    expect(again.reask).toBe(true);
  });

  it('puts the repeat at the end when the session is shorter than the gap', async () => {
    const repository = createMemoryRepository();
    for (let i = 1; i < RELEARN_AFTER_WRONG; i++) await missIt(repository, [target]);
    const { result } = await missIt(repository, [target]);
    expect(result.current.questions.map((q) => q.id)).toEqual([target.id, card.id, target.id]);
  });

  it('does not score the repeat or let it move the schedule', async () => {
    const repository = createMemoryRepository();
    for (let i = 1; i < RELEARN_AFTER_WRONG; i++) await missIt(repository, [target]);
    const { result } = await missIt(repository, [target]);
    const before = await repository.getMasteryForStructure('user-1', 'deltoid');

    act(() => result.current.next()); // the card
    await act(async () => {
      await result.current.submitAnswer({ questionId: card.id, structureId: 'deltoid', correct: true, graded: false });
    });
    act(() => result.current.next()); // the repeat
    await act(async () => {
      await result.current.submitAnswer({ questionId: target.id, structureId: 'deltoid', correct: true, confidence: 'easy' });
    });

    const after = await repository.getMasteryForStructure('user-1', 'deltoid');
    expect(after?.attemptsTotal).toBe(before?.attemptsTotal);
    expect(after?.wrongInARow).toBe(RELEARN_AFTER_WRONG);
    await act(async () => {
      await result.current.finish();
    });
    expect(result.current.summary?.totalQuestions).toBe(1);
    expect(result.current.summary?.correctCount).toBe(0);
  });

  it('resets the count on a right answer', async () => {
    const repository = createMemoryRepository();
    await missIt(repository, session());
    await missIt(repository, session());
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start(session(), PRACTICE));
    await act(async () => {
      await result.current.submitAnswer({ questionId: target.id, structureId: 'deltoid', correct: true, confidence: 'easy' });
    });
    expect((await repository.getMasteryForStructure('user-1', 'deltoid'))?.wrongInARow).toBe(0);
  });

  it('never changes an exam, a class assignment, or a session with learn cards turned off', async () => {
    for (const params of [
      { ...PRACTICE, mode: 'assessment' as const },
      { ...PRACTICE, assignment: { id: 'a', title: 'A', targetAccuracyPct: 70 } },
      { ...PRACTICE, learnCardAttempts: 0 },
    ]) {
      const repository = createMemoryRepository();
      for (let i = 1; i < RELEARN_AFTER_WRONG; i++) await missIt(repository, session(), params);
      const { result } = await missIt(repository, session(), params);
      expect(result.current.questions).toHaveLength(session().length);
    }
  });

  it('is carried by every practice MCQ the generator builds, and by none in an exam', () => {
    const base = { entitledAreas: AREAS, types: ['mcq' as const], count: 20, seed: 7 };
    const practice = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, mode: 'practice' }).filter(isMcqQuestion);
    expect(practice.length).toBeGreaterThan(10);
    for (const q of practice) {
      expect(q.relearnCard?.type, q.id).toBe('flashcard');
      expect(q.relearnCard?.structureId).toBe(q.structureId);
    }
    const exam = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, mode: 'assessment' }).filter(isMcqQuestion);
    expect(exam.every((q) => !q.relearnCard)).toBe(true);
  });
});
