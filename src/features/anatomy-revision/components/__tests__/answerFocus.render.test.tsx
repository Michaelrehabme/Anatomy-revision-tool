import { describe, expect, it } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackHeading } from '../shared/FeedbackHeading';
import { useRecoverFocus } from '../shared/useRecoverFocus';

/**
 * Checking an answer removes the button that was pressed. Without these, focus
 * fell to the page body and a screen reader user heard nothing (WCAG 2.4.3,
 * 4.1.3) — found by the 28 Sep accessibility scan.
 */
describe('answer feedback focus', () => {
  function Question() {
    const [checked, setChecked] = useState(false);
    return checked ? (
      <FeedbackHeading label="Not quite. The answer is Deltoid.">Not quite</FeedbackHeading>
    ) : (
      <button type="button" onClick={() => setChecked(true)}>
        Check answer
      </button>
    );
  }

  it('moves focus to the verdict as it appears, and reads the answer with it', () => {
    render(<Question />);
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    const heading = screen.getByRole('heading', { name: 'Not quite. The answer is Deltoid.' });
    expect(document.activeElement).toBe(heading);
  });

  function Session({ autofocusInput }: { autofocusInput: boolean }) {
    const [index, setIndex] = useState(0);
    const region = useRef<HTMLDivElement>(null);
    useRecoverFocus(region, index);
    return (
      <div ref={region} tabIndex={-1} aria-label={`Question ${index + 1}`}>
        {index === 0 ? (
          <button type="button" onClick={() => setIndex(1)}>
            Next
          </button>
        ) : autofocusInput ? (
          <input aria-label="Answer" autoFocus />
        ) : (
          <p>Question two</p>
        )}
      </div>
    );
  }

  it('puts focus on the question when the button it was on disappears', async () => {
    render(<Session autofocusInput={false} />);
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.click(next);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Question 2')));
  });

  it('leaves focus in a text box the new question focused itself', async () => {
    render(<Session autofocusInput />);
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.click(next);
    const input = screen.getByRole('textbox', { name: 'Answer' });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(input);
  });
});
