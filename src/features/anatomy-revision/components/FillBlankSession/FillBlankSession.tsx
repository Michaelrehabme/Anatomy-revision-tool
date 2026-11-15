import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FeedbackHeading } from '../shared/FeedbackHeading';
import type { FillBlankQuestion } from '../../types/question';
import { isAnswerMatch, itemVariants } from '../../lib/answerMatching';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';
import { Button } from '../shared/Button';
import { DesktopQuestionLayout, GlanceFacts, StageWords } from '../shared/DesktopQuestionLayout';

interface FillBlankSessionProps {
  question: FillBlankQuestion;
  onAnswer: (params: { structureId: string; correct: boolean; selectedAnswer: string; correctAnswer: string }) => void;
  onNext: () => void;
  /** No color reveal, no full statement — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
  /** The desktop screen's layout: the sentence on the stage, the boxes in the column beside it. The phone keeps the stacked card. */
  desktop?: boolean;
}

/**
 * Which boxes are right, in any order: a student who knows both muscles is
 * not wrong for typing them the other way round. Each thing typed can satisfy
 * one answer only, so the same muscle twice is one right box, not two.
 */
function gradeBoxes(typed: string[], answers: string[], alsoAccepted: FillBlankQuestion['alsoAccepted'] = {}): boolean[] {
  const right = typed.map(() => false);
  for (const answer of answers) {
    const accepted = [...itemVariants(answer), ...(alsoAccepted[answer] ?? [])];
    const i = typed.findIndex((value, index) => !right[index] && isAnswerMatch(value, accepted));
    if (i >= 0) right[i] = true;
  }
  return right;
}

export function FillBlankSession({ question, onAnswer, onNext, examMode, desktop = false }: FillBlankSessionProps) {
  // One box for one answer; a box each when the blank holds several things.
  const answers = useMemo(() => question.answers ?? [question.answer], [question.answers, question.answer]);
  const several = answers.length > 1;
  const [typed, setTyped] = useState<string[]>(() => answers.map(() => ''));
  const [submitted, setSubmitted] = useState<{ correct: boolean; right: boolean[] } | null>(null);

  useEffect(() => {
    setTyped(answers.map(() => ''));
    setSubmitted(null);
  }, [question.id, answers]);

  const ready = typed.every((value) => value.trim());

  const handleSubmit = () => {
    if (submitted || !ready) return;
    const right = gradeBoxes(typed, answers, question.alsoAccepted);
    const correct = right.every(Boolean);
    setSubmitted({ correct, right });
    onAnswer({ structureId: question.structureId, correct, selectedAnswer: typed.join(' / '), correctAnswer: question.answer });
  };

  const box = (i: number, label: string, className: string, style?: CSSProperties) => (
    <input
      key={i}
      type="text"
      value={typed[i] ?? ''}
      onChange={(e) => setTyped((current) => current.map((value, index) => (index === i ? e.target.value : value)))}
      disabled={!!submitted}
      autoFocus={i === 0}
      // The blank had no name at all, and switched its focus outline off.
      aria-label={label}
      className={className}
      style={style}
    />
  );

  if (desktop) {
    const shown = submitted && !examMode;
    return (
      <DesktopQuestionLayout
        stage={
          <StageWords
            label="Fill in the blank"
            prompt={
              <>
                {/* Which bone or landmark the sentence is about. Without it "____ origin" is not a question. */}
                {question.subject && (
                  <span className="mb-4 block text-[22px] font-normal tracking-normal" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink2)' }}>
                    About the <span className="font-semibold" style={{ color: 'var(--ink)' }}>{question.subject}</span>:
                  </span>
                )}
                {question.before}{' '}
                <span aria-hidden="true" className="inline-block min-w-[4.5em] translate-y-[-0.12em] border-b-[3px]" style={{ borderColor: 'var(--line-strong)' }}>
                  &nbsp;
                </span>{' '}
                {question.after}
              </>
            }
          />
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-3"
        >
          {several && <p className="text-base" style={{ color: 'var(--ink2)' }}>Name all {answers.length}, in any order.</p>}
          {answers.map((_, i) => {
            const tone = !shown ? 'var(--acc)' : submitted.right[i] ? 'var(--acc)' : 'var(--acc2)';
            return (
              box(
                i,
                several ? `Answer ${i + 1} of ${answers.length}` : 'The missing word or phrase',
                'block w-full rounded-[3px] px-6 py-5 text-center text-[26px] disabled:opacity-80',
                { fontFamily: 'var(--font-display)', border: `1.4px solid ${tone}`, background: 'var(--sf)', color: !shown ? 'var(--ink)' : submitted.right[i] ? 'var(--accd)' : 'var(--acc2d)' },
              )
            );
          })}
          {!submitted && (
            <Button type="submit" disabled={!ready} className="mt-3 min-h-[58px] w-full">
              Check answer
            </Button>
          )}
        </form>

        {submitted && examMode && <ExamAnswerFooter onNext={onNext} compact />}

        {shown && (
          <>
            <div className="mt-6 rounded-[3px] px-6 py-5" style={{ background: submitted.correct ? 'var(--accs)' : 'var(--acc2s)' }}>
              <FeedbackHeading
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: submitted.correct ? 'var(--accd)' : 'var(--acc2d)' }}
                label={submitted.correct ? 'Correct' : `Not quite. The ${several ? 'answers are' : 'answer is'} ${question.answer}.`}
              >
                {submitted.correct ? 'Correct' : 'Not quite'}
              </FeedbackHeading>
              <p className="mt-2 text-[16.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                {several ? 'Answers' : 'Answer'}: <strong className="font-semibold">{question.answer}</strong>
              </p>
              <p className="mt-1 whitespace-pre-line text-[16.5px] leading-relaxed" style={{ color: 'var(--ink2)' }}>
                {question.fullStatement}
              </p>
              <Button onClick={onNext} className="mt-4 min-h-[52px] w-full">
                Next
              </Button>
            </div>
            <GlanceFacts structureId={question.structureId} alreadySaid={question.fullStatement} />
          </>
        )}
      </DesktopQuestionLayout>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <p className="text-lg font-semibold text-ink">Fill in the blank</p>
      {/* Which bone or landmark the sentence is about. Without it "____ origin" is not a question. */}
      {question.subject && (
        <p className="text-base text-ink2">
          About the <span className="font-semibold text-ink">{question.subject}</span>:
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-2"
      >
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-pg p-3 text-base text-ink">
          {question.before && <span>{question.before}</span>}
          {several ? (
            <span aria-hidden="true" className="min-w-[6rem] flex-1 border-b-2 border-line text-center text-ink2">
              {answers.length} answers
            </span>
          ) : (
            box(0, 'The missing word or phrase', 'min-w-[8rem] flex-1 border-b-2 border-line bg-transparent px-1 py-0.5 text-center disabled:bg-sf')
          )}
          {question.after && <span>{question.after}</span>}
        </p>
        {several && (
          <div className="space-y-2">
            <p className="text-sm text-ink2">Name all {answers.length}, in any order.</p>
            {answers.map((_, i) => {
              const shown = submitted && !examMode;
              const tone = !shown ? 'border-line' : submitted.right[i] ? 'border-acc text-accd' : 'border-acc2 text-acc2d';
              return box(
                i,
                `Answer ${i + 1} of ${answers.length}`,
                `block w-full rounded-lg border bg-transparent px-3 py-2 text-base disabled:bg-sf ${tone}`,
              );
            })}
          </div>
        )}
        {!submitted && (
          <button
            type="submit"
            disabled={!ready}
            className="w-full rounded-lg bg-acc-fill px-4 py-3 text-sm font-semibold text-onacc transition enabled:hover:bg-acc-pressed disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check answer
          </button>
        )}
      </form>

      {submitted && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {submitted && !examMode && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 text-sm ${submitted.correct ? 'bg-accs text-accd' : 'bg-acc2s text-acc2d'}`}>
            <FeedbackHeading
              className="text-sm font-medium"
              label={
                submitted.correct
                  ? 'Correct'
                  : `Not quite. The ${several ? 'answers are' : 'answer is'} ${question.answer}.`
              }
            >
              {submitted.correct ? 'Correct.' : 'Not quite.'}
            </FeedbackHeading>
            <p className="mt-1 text-ink2">
              {several ? 'Answers' : 'Answer'}: <span className="font-medium">{question.answer}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-ink2">{question.fullStatement}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onacc hover:bg-ink-pressed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
