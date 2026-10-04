import { useEffect, useId, useRef, useState } from 'react';

/**
 * "End session", and the question it asks before it does.
 *
 * WHY IT ASKS. The control sits one Tab from the answers, on both layouts,
 * and it acted on the first press. During the keyboard-only run of 4 Oct 2026
 * (docs/ACCESSIBILITY-AUDIT-2026-10-04.md, finding 2) a stray Enter ended a
 * session part-way through: the place in the set was gone and there was
 * nothing to undo. A mouse can miss a button; a keyboard that is one stop out
 * cannot tell.
 *
 * WHAT ENDING EARLY REALLY DOES, since the copy has to be true
 * (useRevisionSession `abandon`, and `submitAnswer` before it):
 *  - every answer was saved as it was recorded, with its effect on the review
 *    schedule, and stays saved;
 *  - outside an exam an answer is recorded when it is RATED (Hard / Medium /
 *    Easy), not when it is chosen, so an answer on screen with its verdict
 *    showing and no rating yet is not saved and is lost. Found by running it:
 *    the first draft of the copy said "your answers so far are kept" and for
 *    that one answer it was not true;
 *  - the session is recorded as a partial one, so the day still counts
 *    towards the week and the streak;
 *  - there is no results page, and no XP: XP and achievements are worked out
 *    by finishing;
 *  - a partial session is never an attempt at a class assignment.
 * So "your answers are kept" is true, and it is not the whole truth. The
 * second sentence is the part a student would be cross not to have been told.
 *
 * THE PATTERN is the Offline section's Remove (pwa/offline/OfflineSection.tsx):
 * the question takes the button's place, in the page, not in a modal over it.
 * Focus goes to the answer that loses nothing, Escape is that answer, and
 * focus comes back to the button it left.
 *
 * NOTHING ANSWERED, NOTHING ASKED. A session opened by mistake is closed with
 * one press, as before.
 */

interface EndSessionControlProps {
  /** Answers recorded so far, learn cards included. Zero ends without asking. */
  answered: number;
  onEnd: () => void;
  /** The desktop sidebar's text button, or the phone top bar's "×". */
  variant: 'sidebar' | 'bar';
  /** The session is an attempt at a class assignment, which ending early forfeits. */
  assignment?: boolean;
  /** An exam records each answer as it is given; there is no rating step to be caught short of. */
  exam?: boolean;
}

export const END_SESSION_QUESTION = 'End this session?';
const NO_RESULTS = 'A session ended early has no results page and earns no XP.';
export const END_SESSION_DETAIL = `Your answers so far are kept, except one you have not rated yet. ${NO_RESULTS}`;
export const END_SESSION_EXAM_DETAIL = `Your answers so far are kept. ${NO_RESULTS}`;
export const END_SESSION_ASSIGNMENT_DETAIL = 'It will not count as an attempt at the assignment.';

export function EndSessionControl({ answered, onEnd, variant, assignment = false, exam = false }: EndSessionControlProps) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const questionId = useId();
  const detailId = useId();
  const bar = variant === 'bar';

  // "Keep going" puts the keyboard back on the button it came from. Only after
  // a press here: nothing else in a session should find its focus moved.
  useEffect(() => {
    if (confirming || !returnFocus.current) return;
    returnFocus.current = false;
    trigger.current?.focus();
  }, [confirming]);

  const keepGoing = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  if (!confirming) {
    const ask = () => (answered > 0 ? setConfirming(true) : onEnd());
    return bar ? (
      <button
        ref={trigger}
        type="button"
        onClick={ask}
        aria-label="End session"
        className="border-0 bg-transparent p-0 leading-none"
        style={{ fontSize: 19, color: 'var(--ink3)' }}
      >
        &times;
      </button>
    ) : (
      <button ref={trigger} type="button" onClick={ask} className="text-left text-[15px]" style={{ color: 'var(--ink3)' }}>
        &times; End session
      </button>
    );
  }

  const buttonStyle = (primary: boolean) =>
    ({
      font: '500 13px/1 var(--font-ui)',
      minHeight: bar ? 44 : 36,
      ...(primary
        ? { background: 'var(--acc-fill)', color: 'var(--onacc)', border: '1.2px solid transparent' }
        : { background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }),
    }) as const;

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      // On the phone the question takes the top bar's whole first line and the
      // progress bar drops beneath it; the bar's row wraps for exactly this.
      className={bar ? 'w-full basis-full' : undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        keepGoing();
      }}
    >
      <p id={questionId} style={{ font: '500 15px/1.35 var(--font-ui)', color: 'var(--ink)' }}>
        {END_SESSION_QUESTION}
      </p>
      <p id={detailId} className="mt-1" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
        {exam ? END_SESSION_EXAM_DETAIL : END_SESSION_DETAIL}
        {assignment && ` ${END_SESSION_ASSIGNMENT_DETAIL}`}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {/* Focus lands on the answer that loses nothing. It carries the detail
            as its description, so a screen reader arriving here hears what
            ending would cost before it hears the other button. */}
        <button
          type="button"
          autoFocus
          onClick={keepGoing}
          aria-describedby={detailId}
          className="rounded-[3px] px-3.5"
          style={buttonStyle(true)}
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onEnd();
          }}
          className="rounded-[3px] px-3.5"
          style={buttonStyle(false)}
        >
          End session
        </button>
      </div>
    </div>
  );
}

export default EndSessionControl;
