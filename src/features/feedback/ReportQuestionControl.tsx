import { useEffect, useId, useRef, useState } from 'react';
import type { RevisionQuestion } from '../anatomy-revision/types/question';
import { NOTE_MAX, REPORTING_AVAILABLE, REPORT_REASONS, reportQuestion, type ReportReason } from './data/telemetry';
import { questionShown } from './data/questionShown';

/**
 * "Report a problem" with the question on screen.
 *
 * WHY IT IS IN THE SESSION. A student who meets a wrong answer has, at that
 * moment, the question, their own answer and the will to say so. Ask them to
 * find an email address afterwards and almost none will, and the few who do
 * cannot say which question it was. Here the question is attached for them.
 *
 * THE PATTERN is End session's (shared/EndSessionControl): the form takes the
 * button's place in the page, not a modal over it; Escape closes it; focus
 * returns to the button it left. It sits in the same chrome, on both layouts.
 *
 * It never touches the session. Reporting does not skip the question, change
 * its mark or record an answer: those would turn a feedback button into a way
 * out of a question a student would rather not be asked.
 */

interface ReportQuestionControlProps {
  question: RevisionQuestion;
  /** The desktop sidebar's text button, or the phone top bar's. */
  variant: 'sidebar' | 'bar';
  /**
   * What the report says the student saw beside the question itself: the
   * structure's name, their answer if they had given one, and where the
   * question's picture is (owner, 25 Oct 2026: the email shows the question).
   */
  context?: ReportContext;
}

export interface ReportContext {
  subject?: string;
  given?: string;
  picture?: (imageId: string) => string | undefined;
}

type Stage = 'closed' | 'open' | 'sending' | 'sent' | 'failed';

export const REPORT_TRIGGER = 'Report a problem';
export const REPORT_SENT = 'Thank you. This question has been reported.';
export const REPORT_FAILED = 'That could not be sent. Check your connection and try again.';

export function ReportQuestionControl({ question, variant, context }: ReportQuestionControlProps) {
  const [stage, setStage] = useState<Stage>('closed');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const legendId = useId();
  const noteId = useId();
  const bar = variant === 'bar';

  // A new question is a new report: nothing typed about the last one carries over.
  useEffect(() => {
    setStage('closed');
    setReason(null);
    setNote('');
  }, [question.id]);

  useEffect(() => {
    if (stage !== 'closed' || !returnFocus.current) return;
    returnFocus.current = false;
    trigger.current?.focus();
  }, [stage]);

  if (!REPORTING_AVAILABLE) return null;

  const close = () => {
    returnFocus.current = true;
    setStage('closed');
  };

  const send = async () => {
    if (!reason) return;
    setStage('sending');
    const saved = await reportQuestion({
      questionId: question.id,
      structureId: question.structureId,
      questionType: question.type,
      promptKind: question.promptKind,
      area: question.area,
      reason,
      note,
      shown: questionShown(question, context),
    });
    setStage(saved ? 'sent' : 'failed');
  };

  const textStyle = { font: `400 ${bar ? 12.5 : 13}px/1.3 var(--font-ui)`, color: 'var(--ink3)' } as const;

  if (stage === 'closed') {
    return (
      <button
        ref={trigger}
        type="button"
        onClick={() => setStage('open')}
        aria-label={REPORT_TRIGGER}
        className="border-0 bg-transparent p-0 text-left underline underline-offset-2"
        // The phone's top bar has room for a tap target, not a 13px line of text.
        style={{ ...textStyle, minHeight: bar ? 44 : undefined }}
      >
        {bar ? 'Report' : REPORT_TRIGGER}
      </button>
    );
  }

  if (stage === 'sent') {
    return (
      <p role="status" className={bar ? 'w-full basis-full' : undefined} style={{ ...textStyle, color: 'var(--ink2)', margin: 0 }}>
        {REPORT_SENT}
      </p>
    );
  }

  const sending = stage === 'sending';
  const buttonStyle = (primary: boolean) =>
    ({
      font: '500 13px/1 var(--font-ui)',
      minHeight: bar ? 44 : 36,
      ...(primary
        ? { background: 'var(--acc-fill)', color: 'var(--onacc)', border: '1.2px solid transparent' }
        : { background: 'transparent', color: 'var(--ink2)', border: '1.2px solid var(--line)' }),
    }) as const;

  return (
    <form
      className={bar ? 'w-full basis-full' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        close();
      }}
    >
      <fieldset className="m-0 border-0 p-0" aria-labelledby={legendId}>
        <p id={legendId} style={{ font: '500 15px/1.35 var(--font-ui)', color: 'var(--ink)', margin: 0 }}>
          What is wrong with this question?
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {REPORT_REASONS.map((option, index) => (
            <label
              key={option.id}
              className="flex items-start gap-2"
              style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)', minHeight: bar ? 36 : undefined }}
            >
              <input
                type="radio"
                name={legendId}
                value={option.id}
                checked={reason === option.id}
                onChange={() => setReason(option.id)}
                autoFocus={index === 0}
                className="mt-[3px]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={noteId} className="mt-2.5 block" style={{ font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
        Anything to add? (optional)
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={NOTE_MAX}
        rows={2}
        className="mt-1 w-full rounded-[3px] p-2"
        style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink)', background: 'var(--sf)', border: '1.2px solid var(--line)' }}
      />
      {stage === 'failed' && (
        <p role="alert" className="mt-1.5" style={{ font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--acc2d)', margin: '6px 0 0' }}>
          {REPORT_FAILED}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="submit" disabled={!reason || sending} className="rounded-[3px] px-3.5" style={{ ...buttonStyle(true), opacity: !reason || sending ? 0.6 : 1 }}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={close} className="rounded-[3px] px-3.5" style={buttonStyle(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
