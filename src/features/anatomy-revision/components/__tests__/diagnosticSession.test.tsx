import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosticSession } from '../Diagnostic/DiagnosticSession';
import type { MCQQuestion } from '../../types/question';

/**
 * What these protect is the measurement, not the markup.
 *
 * A diagnostic that reveals an answer teaches, and a pre-test that teaches
 * manufactures the improvement it is supposed to detect. A diagnostic that
 * cannot be corrected records misclicks as ignorance. And one that submits a
 * different question set from the one it asked cannot be paired with anything.
 */

function q(n: number): MCQQuestion {
  return {
    id: `q-${n}`,
    structureId: `s-${n}`,
    questionType: 'mcq',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    difficulty: 'medium',
    area: 'shoulder',
    prompt: `Question ${n}?`,
    choices: [`${n}-right`, `${n}-wrong-a`, `${n}-wrong-b`, `${n}-wrong-c`],
    correctIndex: 0,
    explanation: 'never shown',
  } as unknown as MCQQuestion;
}

const QUESTIONS = [q(1), q(2), q(3)];

function setup(onSubmit = vi.fn()) {
  render(
    <DiagnosticSession questions={QUESTIONS} imagesById={new Map()} onSubmit={onSubmit} />,
  );
  return onSubmit;
}

/** Answer the current question, then advance. */
function answerAndAdvance(choice: string, next: 'Next' | 'Review answers' = 'Next') {
  fireEvent.click(screen.getByRole('button', { name: choice }));
  fireEvent.click(screen.getByRole('button', { name: next }));
}

describe('DiagnosticSession', () => {
  it('never reveals whether an answer was right', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '1-right' }));
    // No correct/incorrect wording, and the explanation never renders.
    expect(screen.queryByText(/correct/i)).toBeNull();
    expect(screen.queryByText(/never shown/)).toBeNull();
  });

  it('lets a student go back and change an answer', () => {
    setup();
    answerAndAdvance('1-right');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    const chosen = screen.getByRole('button', { name: '1-right' });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '1-wrong-a' }));
    expect(screen.getByRole('button', { name: '1-wrong-a' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1-right' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('clears an answer when the same choice is tapped again', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '1-right' }));
    fireEvent.click(screen.getByRole('button', { name: '1-right' }));
    expect(screen.getByRole('button', { name: '1-right' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('allows skipping, because a question you cannot answer must not trap you', () => {
    setup();
    // Next is available with nothing selected.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Question 2 of 3')).toBeTruthy();
  });

  it('goes to review rather than submitting straight off the last question', () => {
    const onSubmit = setup();
    answerAndAdvance('1-right');
    answerAndAdvance('2-right');
    answerAndAdvance('3-right', 'Review answers');

    expect(screen.getByText('Check before you submit')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('names the blanks at review and still allows submitting', () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));      // skip 1
    answerAndAdvance('2-right');
    fireEvent.click(screen.getByRole('button', { name: 'Review answers' })); // skip 3

    expect(screen.getByText(/2 still blank \(1, 3\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // A blank counts as wrong, never as a pass.
    expect(onSubmit.mock.calls[0][0].correct).toBe(1);
  });

  it('jumps back to a question from the review grid', () => {
    setup();
    answerAndAdvance('1-right');
    answerAndAdvance('2-right');
    fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));

    fireEvent.click(screen.getByRole('button', { name: /^Question 1, answered$/ }));
    expect(screen.getByText('Question 1 of 3')).toBeTruthy();
  });

  it('submits the questions it asked, which is what makes a follow-up replayable', () => {
    const onSubmit = setup();
    answerAndAdvance('1-right');
    answerAndAdvance('2-wrong-a');
    answerAndAdvance('3-right', 'Review answers');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    const result = onSubmit.mock.calls[0][0];
    expect(result.correct).toBe(2);
    expect(result.total).toBe(3);
    expect(result.questionIds).toEqual(['q-1', 'q-2', 'q-3']);
    expect(typeof result.durationMs).toBe('number');
  });
});
