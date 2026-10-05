import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRevisionSession } from '../useRevisionSession';
import { createMemoryRepository } from '../../data/memoryRepository';
import type { FlashcardQuestion, MCQQuestion, OinaSelectQuestion } from '../../types/question';

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

function oinaQuestion(overrides: Partial<OinaSelectQuestion> = {}): OinaSelectQuestion {
  return {
    id: 'oina-biceps-femoris-origin-select',
    type: 'oina',
    format: 'select',
    structureId: 'biceps-femoris',
    region: 'hip-thigh',
    category: 'muscle',
    difficulty: 'medium',
    promptKind: 'origin',
    prompt: 'Select every origin of Biceps Femoris.',
    choices: ['Ischial tuberosity', 'Linea aspera of the femur', 'Iliac fossa', 'Pubis'],
    correctIndices: [0, 1],
    explanation: 'Biceps Femoris — origin: ...',
    ...overrides,
  };
}

function flashcard(): FlashcardQuestion {
  return {
    id: 'flashcard-biceps-femoris-origin',
    type: 'flashcard',
    structureId: 'biceps-femoris',
    region: 'hip-thigh',
    category: 'muscle',
    difficulty: 'medium',
    promptKind: 'origin',
    front: { text: 'What is the origin of Biceps Femoris?' },
    back: { text: 'Long head: ischial tuberosity; Short head: linea aspera of the femur' },
  };
}

describe('ungraded learn cards (CR-018)', () => {
  it('records the exposure but never touches spaced repetition', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const card = flashcard();

    act(() => result.current.start([card], { types: ['flashcard'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({
        questionId: card.id,
        structureId: card.structureId,
        correct: true,
        graded: false,
      });
    });

    const [attempt] = await repository.listAttempts({ userId: 'user-1' });
    expect(attempt.graded).toBe(false);
    // The whole point: revealing a card must not schedule the muscle as
    // reviewed. It does mark it SEEN (lib/ladder.ts), so a row exists — with
    // no attempts, no accuracy and nothing due.
    const row = await repository.getMasteryForStructure('user-1', 'biceps-femoris');
    expect(row?.attemptsTotal).toBe(0);
    expect(row?.dueAt).toBeUndefined();
    expect(row?.intervalDays).toBeUndefined();
  });

  it('keeps learn cards out of the session score', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const card = flashcard();
    const question = oinaQuestion();

    act(() => result.current.start([card, question], { types: ['oina'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({
        questionId: card.id,
        structureId: card.structureId,
        correct: true,
        graded: false,
      });
    });
    act(() => result.current.next());
    await act(async () => {
      await result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Ischial tuberosity, Linea aspera of the femur',
        correctAnswer: 'Ischial tuberosity, Linea aspera of the femur',
      });
    });
    await act(async () => {
      await result.current.finish();
    });

    // Two items shown, one of them answerable — the score is out of one.
    expect(result.current.summary!.totalQuestions).toBe(1);
    expect(result.current.summary!.correctCount).toBe(1);
    expect(result.current.summary!.breakdownByCategory.muscle).toEqual({ total: 1, correct: 1 });
  });
});

describe('fact mastery (CR-018)', () => {
  it('records progress per (muscle, fact), leaving sibling facts alone', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const question = oinaQuestion();

    act(() => result.current.start([question], { types: ['oina'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({
        questionId: question.id,
        structureId: question.structureId,
        correct: true,
        confidence: 'easy',
        selectedAnswer: 'Ischial tuberosity, Linea aspera of the femur',
        correctAnswer: 'Ischial tuberosity, Linea aspera of the femur',
      });
    });

    const rows = await repository.listFactMastery('user-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      structureId: 'biceps-femoris',
      promptKind: 'origin',
      attemptsTotal: 1,
      attemptsCorrect: 1,
      streak: 1,
      typed: false,
    });
    // Facts no longer touch the structure's naming row (2 Oct 2026).
    expect(await repository.getMasteryForStructure('user-1', 'biceps-femoris')).toBeNull();
  });

  it('promotes a fact to typed recall after three correct answers', async () => {
    const repository = createMemoryRepository();
    const question = oinaQuestion();

    for (let i = 0; i < 3; i++) {
      const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
      act(() => result.current.start([question], { types: ['oina'], mode: 'practice' }));
      await act(async () => {
        await result.current.submitAnswer({
          questionId: question.id,
          structureId: question.structureId,
          correct: true,
          confidence: 'easy',
        });
      });
    }

    const [row] = await repository.listFactMastery('user-1');
    expect(row.attemptsCorrect).toBe(3);
    expect(row.typed).toBe(true);
    // Promoted to typed WITH hints; the streak starts again for the next stage.
    expect(row.bare).toBe(false);
    expect(row.streak).toBe(0);
  });

  it('moves only the schedule of the fact, never the naming row of the structure (2 Oct 2026)', async () => {
    const repository = createMemoryRepository();
    const question = oinaQuestion();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([question], { types: ['oina'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({ questionId: question.id, structureId: question.structureId, correct: false, confidence: 'hard' });
    });
    expect(await repository.getMasteryForStructure('user-1', question.structureId)).toBeNull();
    const [fact] = await repository.listFactMastery('user-1');
    expect(fact.dueAt).toBeDefined();
    expect(fact.intervalDays).toBe(1);
  });
});

describe('useRevisionSession abandon', () => {
  it('saves a partial summary of what was answered, without an assignment id', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const q1 = mcqQuestion();
    const q2 = mcqQuestion({ id: 'q-biceps-mcq', structureId: 'biceps-brachii' });
    const q3 = mcqQuestion({ id: 'q-trapezius-mcq', structureId: 'trapezius' });

    act(() =>
      result.current.start([q1, q2, q3], {
        types: ['mcq'],
        mode: 'assessment',
        assignment: { id: 'assignment-1', title: 'Shoulder', targetAccuracyPct: 70 },
      }),
    );
    await act(async () => {
      await result.current.submitAnswer({ questionId: q1.id, structureId: q1.structureId, correct: true, confidence: 'easy' });
    });
    act(() => result.current.next());
    await act(async () => {
      await result.current.submitAnswer({ questionId: q2.id, structureId: q2.structureId, correct: false, confidence: 'hard' });
    });

    await act(async () => {
      await result.current.abandon();
    });

    expect(result.current.phase).toBe('setup');
    const [summary] = await repository.listSessionSummaries('user-1', 10);
    expect(summary).toBeDefined();
    expect(summary.totalQuestions).toBe(2);
    expect(summary.correctCount).toBe(1);
    expect(summary.assignmentId).toBeUndefined();
    expect(summary.finishedAt).toBeDefined();
  });

  it('saves nothing when no graded answer was given', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([mcqQuestion()], { types: ['mcq'], mode: 'practice' }));
    await act(async () => {
      await result.current.abandon();
    });
    expect(result.current.phase).toBe('setup');
    expect(await repository.listSessionSummaries('user-1', 10)).toEqual([]);
  });
});

describe('a flashcard marks the structure seen', () => {
  it('writes a mastery row with firstSeenAt and no schedule', async () => {
    const repository = createMemoryRepository();
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    const card = flashcard();
    act(() => result.current.start([card], { types: ['flashcard'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer({ questionId: card.id, structureId: card.structureId, correct: true, graded: false });
    });
    const row = await repository.getMasteryForStructure('user-1', card.structureId);
    expect(row?.firstSeenAt).toBeDefined();
    expect(row?.attemptsTotal).toBe(0);
    expect(row?.dueAt).toBeUndefined();
    expect(row?.rung).toBe('mcq');
  });
});

/**
 * The owner's decision of 5 October 2026 (lib/answerRoute.ts): an answer in
 * words to a locate question counts toward the locate level. The attempt row
 * still says it was given in words. The other setting is pinned in
 * useRevisionSession.wordsApart.test.ts.
 */
describe('a locate question answered in words', () => {
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

  type Submitted = Parameters<ReturnType<typeof useRevisionSession>['submitAnswer']>[0];

  async function answer(repository: ReturnType<typeof createMemoryRepository>, record: Submitted, finish = false) {
    const { result } = renderHook(() => useRevisionSession(repository, 'user-1'));
    act(() => result.current.start([locate], { types: ['locate'], mode: 'practice' }));
    await act(async () => {
      await result.current.submitAnswer(record);
    });
    if (finish) {
      await act(async () => {
        await result.current.finish();
      });
    }
  }

  const inWords: Submitted = {
    questionId: locate.id,
    structureId: 'acromion',
    correct: true,
    confidence: 'medium',
    selectedAnswer: 'Part of: Scapula.',
    correctAnswer: 'Part of: Scapula.',
    route: 'described-region',
  };
  const byTap: Submitted = { questionId: locate.id, structureId: 'acromion', correct: true, confidence: 'medium', accuracy: 9 };

  it('is stored as a described-region answer, so a report can always tell it from a tap', async () => {
    const repository = createMemoryRepository();
    await answer(repository, inWords);
    const [attempt] = await repository.listAttempts({ userId: 'user-1' });
    expect(attempt.questionType).toBe('mcq');
    expect(attempt.promptKind).toBe('described-region');
    expect(attempt.questionId).toBe(locate.id);
    expect(attempt.correctAnswer).toBe('Part of: Scapula.');
    expect(attempt.hitDistance).toBeUndefined();
  });

  it("moves the structure's own row — the one a tap moves — and writes no row of its own", async () => {
    const repository = createMemoryRepository();
    await answer(repository, inWords);
    const row = await repository.getMasteryForStructure('user-1', 'acromion');
    expect(row).toMatchObject({ attemptsTotal: 1, attemptsCorrect: 1 });
    // No second schedule for the forecast to count and session building to ignore.
    expect(await repository.listFactMastery('user-1')).toEqual([]);
  });

  it('is credited and re-asked exactly as a tap would be: the same streak, interval and rung', async () => {
    const words = createMemoryRepository();
    const tap = createMemoryRepository();
    await answer(words, inWords);
    await answer(tap, byTap);
    const a = (await words.getMasteryForStructure('user-1', 'acromion'))!;
    const b = (await tap.getMasteryForStructure('user-1', 'acromion'))!;
    expect(a.dueAt).toBeDefined();
    // Everything but the timestamps, which differ by the milliseconds between the two runs.
    const comparable = (row: typeof a) =>
      Object.fromEntries(Object.entries(row).filter(([, v]) => !(typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v))));
    expect(comparable(a)).toEqual(comparable(b));
    expect(a.intervalDays).toBe(b.intervalDays);
    expect(a.rung).toBe(b.rung);
    expect(Math.abs(Date.parse(a.dueAt!) - Date.parse(b.dueAt!))).toBeLessThan(5000);
  });

  it('a wrong answer in words counts against the structure as a wrong tap would', async () => {
    const repository = createMemoryRepository();
    await answer(repository, { ...inWords, correct: false, selectedAnswer: 'Part of: Clavicle.' });
    expect(await repository.getMasteryForStructure('user-1', 'acromion')).toMatchObject({ attemptsTotal: 1, attemptsCorrect: 0 });
  });

  it('while a tap on the same question is recorded as a locate, on the same row', async () => {
    const repository = createMemoryRepository();
    await answer(repository, byTap);
    const [attempt] = await repository.listAttempts({ userId: 'user-1' });
    expect(attempt.questionType).toBe('locate');
    expect(attempt.promptKind).toBe('identify');
    expect((await repository.getMasteryForStructure('user-1', 'acromion'))?.attemptsTotal).toBe(1);
    expect(await repository.listFactMastery('user-1')).toEqual([]);
  });

  it('earns what a tap earns, and counts as having used the locate format', async () => {
    const words = createMemoryRepository();
    const tap = createMemoryRepository();
    await answer(words, inWords, true);
    await answer(tap, byTap, true);
    const profile = await words.getGamificationProfile('user-1');
    expect(profile.questionTypesUsedEver).toEqual(['locate']);
    expect(profile.xpTotal).toBeGreaterThan(0);
    expect(profile.xpTotal).toBe((await tap.getGamificationProfile('user-1')).xpTotal);
  });
});
