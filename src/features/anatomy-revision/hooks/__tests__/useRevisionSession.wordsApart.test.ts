import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * THE SETTING NOT CHOSEN.
 *
 * Since 5 October 2026 an answer in words to a locate question is credited as
 * the locate (lib/answerRoute.ts). This file runs the session with the switch
 * the other way, so that if the decision is ever reversed the behaviour it
 * returns to is known to work: the answer moves a 'described-region' fact row
 * of its own, the structure's row is untouched, and it earns multiple-choice
 * XP. The switch is a constant, so the module is wrapped here to pass `false`
 * where the session passes nothing.
 */
vi.mock('../../lib/answerRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/answerRoute')>();
  return {
    ...actual,
    DESCRIBED_REGION_COUNTS_AS_LOCATE: false,
    askedAs: (question: Parameters<typeof actual.askedAs>[0], route: Parameters<typeof actual.askedAs>[1]) =>
      actual.askedAs(question, route, false),
  };
});

import { useRevisionSession } from '../useRevisionSession';
import { createMemoryRepository } from '../../data/memoryRepository';

describe('a locate question answered in words, with the credit switched off', () => {
  const locate = {
    id: 'locate-landmark-acromion',
    type: 'locate' as const,
    structureId: 'acromion',
    region: 'shoulder-arm' as const,
    category: 'landmark' as const,
    difficulty: 'easy' as const,
    promptKind: 'identify' as const,
    imageId: 'landmark-acromion-anterior',
    imageMode: 'atlas-slide' as const,
    targetStructureId: 'acromion',
    prompt: 'Tap the Acromion.',
  };

  it('is stored as a described-region answer and moves a row of its own, not the row a tap moves', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([locate], { types: ['locate'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({
        questionId: locate.id,
        structureId: 'acromion',
        correct: true,
        confidence: 'medium',
        selectedAnswer: 'Part of: Scapula.',
        correctAnswer: 'Part of: Scapula.',
        route: 'described-region',
      });
    });

    const [attempt] = await repository.listAttempts({ userId: 'user-1' });
    expect(attempt.questionType).toBe('mcq');
    expect(attempt.promptKind).toBe('described-region');

    // The structure's own row — accuracy, schedule, ladder — is untouched.
    expect(await repository.getMasteryForStructure('user-1', 'acromion')).toBeNull();
    const facts = await repository.listFactMastery('user-1');
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ structureId: 'acromion', promptKind: 'described-region', attemptsTotal: 1, attemptsCorrect: 1 });
  });

  it("a tap on the same question is still a locate, on the structure's row", async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([locate], { types: ['locate'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({ questionId: locate.id, structureId: 'acromion', correct: true, confidence: 'medium', accuracy: 9 });
    });
    expect((await repository.getMasteryForStructure('user-1', 'acromion'))?.attemptsTotal).toBe(1);
    expect(await repository.listFactMastery('user-1')).toEqual([]);
  });

  it('earns multiple-choice XP, not locate XP, and does not count as having used the locate format', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([locate], { types: ['locate'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({ questionId: locate.id, structureId: 'acromion', correct: true, confidence: 'medium', route: 'described-region' });
    });
    await act(async () => {
      await result.current.finish();
    });
    const profile = await repository.getGamificationProfile('user-1');
    expect(profile.questionTypesUsedEver).toEqual(['mcq']);
  });
});
