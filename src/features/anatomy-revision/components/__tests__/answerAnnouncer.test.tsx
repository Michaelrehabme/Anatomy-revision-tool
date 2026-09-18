import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AnswerAnnouncer } from '../shared/AnswerAnnouncer';

/**
 * The two failures worth guarding: silence when a result should be spoken, and
 * speech when the screen is deliberately silent.
 */

function live() {
  // The live region is the only aria-live element this component renders.
  return document.querySelector('[aria-live="polite"]');
}

describe('AnswerAnnouncer', () => {
  it('says nothing before anything has been answered', () => {
    render(<AnswerAnnouncer answeredCount={0} correct reveal />);
    expect(live()?.textContent).toBe('');
  });

  it('announces a correct answer', async () => {
    render(<AnswerAnnouncer answeredCount={1} correct reveal />);
    await waitFor(() => expect(live()?.textContent).toContain('Correct.'));
  });

  it('announces a wrong answer with the right one', async () => {
    render(<AnswerAnnouncer answeredCount={1} correct={false} reveal detail="The answer was Deltoid." />);
    await waitFor(() => expect(live()?.textContent).toContain('Not correct.'));
    expect(live()?.textContent).toContain('The answer was Deltoid.');
  });

  it('withholds the verdict in assessment mode, as the screen does', async () => {
    render(<AnswerAnnouncer answeredCount={1} correct reveal={false} detail="The answer was Deltoid." />);
    await waitFor(() => expect(live()?.textContent).toContain('Answer recorded.'));
    const text = live()?.textContent ?? '';
    // Telling a screen reader user the result while the sighted student beside
    // them is told nothing is a different exam, not accessibility.
    expect(text).toContain('Answer recorded.');
    expect(text).not.toContain('Correct');
    expect(text).not.toContain('Deltoid');
  });

  it('clears between answers so a repeated verdict is still spoken', async () => {
    const { rerender } = render(<AnswerAnnouncer answeredCount={1} correct reveal />);
    await waitFor(() => expect(live()?.textContent).toContain('Correct.'));

    rerender(<AnswerAnnouncer answeredCount={2} correct reveal />);
    // Emptied synchronously: that transition is what makes the region speak a
    // second time when the words are identical.
    expect(live()?.textContent).toBe('');
    await waitFor(() => expect(live()?.textContent).toContain('Correct.'));
  });

  it('is hidden from sight', () => {
    render(<AnswerAnnouncer answeredCount={1} correct reveal />);
    expect(live()?.className).toContain('sr-only');
  });
});
