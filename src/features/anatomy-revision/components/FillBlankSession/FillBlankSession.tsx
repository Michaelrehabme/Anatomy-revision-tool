import { useEffect, useState } from 'react';
import type { FillBlankQuestion } from '../../types/question';
import { isAnswerMatch } from '../../lib/answerMatching';
import { ExamAnswerFooter } from '../shared/ExamAnswerFooter';

interface FillBlankSessionProps {
  question: FillBlankQuestion;
  onAnswer: (params: { structureId: string; correct: boolean; selectedAnswer: string; correctAnswer: string }) => void;
  onNext: () => void;
  /** No color reveal, no full statement — answer submits and advances silently. See CR-009. */
  examMode?: boolean;
}

export function FillBlankSession({ question, onAnswer, onNext, examMode }: FillBlankSessionProps) {
  const [attempt, setAttempt] = useState('');
  const [submitted, setSubmitted] = useState<{ correct: boolean } | null>(null);

  useEffect(() => {
    setAttempt('');
    setSubmitted(null);
  }, [question.id]);

  const handleSubmit = () => {
    if (submitted || !attempt.trim()) return;
    const correct = isAnswerMatch(attempt, [question.answer]);
    setSubmitted({ correct });
    onAnswer({ structureId: question.structureId, correct, selectedAnswer: attempt, correctAnswer: question.answer });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <p className="text-lg font-semibold text-ink">Fill in the blank</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-2"
      >
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 text-base text-ink">
          {question.before && <span>{question.before}</span>}
          <input
            type="text"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            disabled={!!submitted}
            autoFocus
            className="min-w-[8rem] flex-1 border-b-2 border-line bg-transparent px-1 py-0.5 text-center focus:border-brand-600 focus:outline-none disabled:bg-sf"
          />
          {question.after && <span>{question.after}</span>}
        </p>
        {!submitted && (
          <button
            type="submit"
            disabled={!attempt.trim()}
            className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check answer
          </button>
        )}
      </form>

      {submitted && examMode && <ExamAnswerFooter onNext={onNext} compact />}

      {submitted && !examMode && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 text-sm ${submitted.correct ? 'bg-accs text-accd' : 'bg-rose-50 text-rose-800'}`}>
            <p className="font-medium">{submitted.correct ? 'Correct.' : 'Not quite.'}</p>
            <p className="mt-1 text-ink2">
              Answer: <span className="font-medium">{question.answer}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-ink2">{question.fullStatement}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
