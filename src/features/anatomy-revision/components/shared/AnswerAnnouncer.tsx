import { useEffect, useRef, useState } from 'react';

/**
 * Announces the result of an answer to a screen reader.
 *
 * Every question format signals right and wrong with colour and position — a
 * green panel, a red one, the correct option outlined. None of that reaches
 * somebody using a screen reader, who until now answered a question and was
 * told nothing at all. This is the single largest accessibility gap in the
 * product and the cheapest to close.
 *
 * IT MUST NOT SAY MORE THAN THE SCREEN DOES. In assessment mode the app
 * deliberately withholds the result: no colour, no explanation, answer and
 * move on. An announcer that read out "correct" there would hand a screen
 * reader user information the sighted student beside them is not given, which
 * is not accessibility but a different exam. `reveal` is that switch, and it
 * follows the same flag the visible UI does.
 *
 * `polite` rather than `assertive` on purpose: the result is worth hearing at
 * the next natural pause, not worth cutting off whatever is being read.
 */

interface AnswerAnnouncerProps {
  /**
   * Increments once per answered question. The count rather than the answer
   * itself, because two identical results in a row must still produce two
   * announcements, and the effect below needs something that changes to react
   * to when the verdict does not.
   */
  answeredCount: number;
  /** Whether the last answer was right. Ignored entirely when `reveal` is false. */
  correct: boolean;
  /** False in assessment mode: say that an answer was recorded, and nothing more. */
  reveal: boolean;
  /** Read out after the verdict when it is known and revealed — the right answer, usually. */
  detail?: string;
}

export function AnswerAnnouncer({ answeredCount, correct, reveal, detail }: AnswerAnnouncerProps) {
  const [message, setMessage] = useState('');
  const lastAnnounced = useRef(0);

  useEffect(() => {
    if (answeredCount === 0 || answeredCount === lastAnnounced.current) return;
    lastAnnounced.current = answeredCount;

    const verdict = reveal ? (correct ? 'Correct.' : 'Not correct.') : 'Answer recorded.';
    const text = reveal && detail ? `${verdict} ${detail}` : verdict;

    // Cleared first, then set on the next frame. A live region speaks only
    // when its text CHANGES, so two correct answers in a row would otherwise
    // set the identical string twice and the second would be silent. Emptying
    // it first guarantees a change without smuggling an invisible character
    // into the text a screen reader reads.
    setMessage('');
    const id = requestAnimationFrame(() => setMessage(text));
    return () => cancelAnimationFrame(id);
  }, [answeredCount, correct, reveal, detail]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
