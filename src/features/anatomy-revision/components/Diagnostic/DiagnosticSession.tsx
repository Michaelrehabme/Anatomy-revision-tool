import { useMemo, useState } from 'react';
import type { MCQQuestion } from '../../types/question';
import type { AnatomyImageAsset } from '../../types/image';
import { ImageViewer } from '../shared/ImageViewer';
import { PromptHighlightOverlay } from '../shared/PromptHighlightOverlay';
import { promptHighlightFrames } from '../../lib/promptHighlight';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { Button } from '../shared/Button';

/**
 * The baseline sitting.
 *
 * WHY THIS IS NOT MCQSession. That component is built around a single forward
 * pass: choosing an answer submits it, locks the choices and offers Next. Here
 * a student must be able to go back, change their mind and skip, because this
 * is an assessment rather than a revision session and a misclick on question
 * three should not be permanent — a slip and not knowing are different things,
 * and only one of them is what we are trying to measure.
 *
 * It also does deliberately less: no confidence rating, no reveal, no
 * explanation. Almost everything MCQSession renders after an answer is exactly
 * what this must never show.
 *
 * What IS shared is the figure: the same ImageViewer, the same highlight
 * overlay, the same rotation frames, so a question looks identical to the one a
 * student meets in ordinary revision. A diagnostic that looked like a different
 * product would be measuring familiarity with the diagnostic.
 *
 * Nothing here records an attempt or touches mastery. See lib/diagnostic.ts.
 */

interface DiagnosticSessionProps {
  /** Already shuffled by the caller — order is per sitting, see lib/diagnostic.ts. */
  questions: MCQQuestion[];
  imagesById: Map<string, AnatomyImageAsset>;
  /** Called once, on submit. `questionIds` is what makes a follow-up replayable. */
  onSubmit: (result: { correct: number; total: number; questionIds: string[]; durationMs: number }) => void;
  onCancel?: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const label = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.16em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

export function DiagnosticSession({ questions, imagesById, onSubmit, onCancel }: DiagnosticSessionProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [at, setAt] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const question = questions[at];
  const promptImage = question?.promptImageId ? imagesById.get(question.promptImageId) : undefined;
  const frames = useMemo(
    () => rotationFramesFor(promptImage, imagesById.values()),
    [promptImage, imagesById],
  );

  const blanks = answers.reduce<number[]>((acc, a, i) => (a === null ? [...acc, i + 1] : acc), []);

  const choose = (index: number) => {
    setAnswers((prev) => prev.map((a, i) => (i === at ? (a === index ? null : index) : a)));
  };

  const submit = () => {
    const correct = questions.reduce(
      (n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0),
      0,
    );
    onSubmit({
      correct,
      total: questions.length,
      // The generator's ids, not the display order: a follow-up replays the
      // same questions and shuffles them again for itself.
      questionIds: questions.map((q) => q.id),
      durationMs: Date.now() - startedAt,
    });
  };

  if (reviewing) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-6 py-12">
        <div style={label}>Baseline</div>
        <h2 className="mt-4" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 38, lineHeight: 1.15 }}>
          Check before you submit
        </h2>
        <p className="mt-3" style={{ font: '400 16px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
          Tap any number to go back to it. Nothing is scored until you submit, and you will not see
          which ones you got right afterwards.
        </p>

        <div className="mt-7 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}>
          {questions.map((q, i) => {
            const answered = answers[i] !== null;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => { setAt(i); setReviewing(false); }}
                aria-label={`Question ${i + 1}, ${answered ? 'answered' : 'not answered'}`}
                className="rounded-[3px] py-3"
                style={{
                  font: '400 13px/1 var(--font-mono)',
                  border: answered ? '1px solid var(--acc)' : '1px dashed var(--acc2)',
                  background: answered ? 'var(--accs)' : 'transparent',
                  color: answered ? 'var(--accd)' : 'var(--acc2d)',
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <p className="mt-5" style={{ font: '400 15px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          {blanks.length === 0
            ? `All ${questions.length} answered.`
            : `${blanks.length} still blank (${blanks.join(', ')}). You can submit anyway — a blank counts as wrong.`}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { setAt(questions.length - 1); setReviewing(false); }}
            className="rounded-[3px] px-6 py-3"
            style={{ border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink2)', font: '400 15px/1 var(--font-ui)' }}
          >
            Back to last question
          </button>
          <Button onClick={submit} className="min-w-[160px] min-h-[50px]">Submit</Button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-10">
      <div className="flex items-baseline justify-between gap-3" style={label}>
        <span>Question {at + 1} of {questions.length}</span>
        <span>No feedback until the end</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--sf2)' }}>
        <div className="h-full" style={{ width: `${(at / questions.length) * 100}%`, background: 'var(--acc)' }} />
      </div>

      <h2
        className="mt-7"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.2, letterSpacing: '-.015em' }}
      >
        {question.prompt}
      </h2>

      {promptImage && (
        <ImageViewer
          className="mt-6 max-w-md mx-auto"
          image={promptImage}
          frames={promptHighlightFrames(frames, question.structureId)}
          resetKey={question.id}
          overlay={(current) => <PromptHighlightOverlay image={current} structureId={question.structureId} />}
        />
      )}

      <div className="mt-7 flex flex-col gap-2.5">
        {question.choices.map((choice, index) => {
          const selected = answers[at] === index;
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(index)}
              className="flex min-h-[58px] items-center gap-4 rounded-[3px] px-5 py-3 text-left"
              style={{
                border: selected ? '1.4px solid var(--acc)' : '1.2px solid var(--line)',
                background: selected ? 'var(--accs)' : 'var(--sf)',
                color: selected ? 'var(--accd)' : 'var(--ink)',
                font: '400 16.5px/1.45 var(--font-ui)',
              }}
            >
              {/* Decorative: the letter is a visual handle, and reading "A" before
                  every option only lengthens what a screen reader says. */}
              <span
                aria-hidden="true"
                className="w-4 flex-none"
                style={{ font: '400 12.5px/1 var(--font-mono)', color: selected ? 'var(--accd)' : 'var(--ink3)' }}
              >
                {LETTERS[index]}
              </span>
              <span className="flex-1">{choice}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {at > 0 && (
          <button
            type="button"
            onClick={() => setAt(at - 1)}
            className="rounded-[3px] px-6 py-3"
            style={{ border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink2)', font: '400 15px/1 var(--font-ui)' }}
          >
            Back
          </button>
        )}
        <Button
          onClick={() => (at === questions.length - 1 ? setReviewing(true) : setAt(at + 1))}
          className="min-w-[150px] min-h-[50px]"
        >
          {at === questions.length - 1 ? 'Review answers' : 'Next'}
        </Button>
        {onCancel && at === 0 && answers.every((a) => a === null) && (
          <button
            type="button"
            onClick={onCancel}
            style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
