import { useEffect, useState } from 'react';
import type { FillBlankQuestion } from '../../types/question';
import { isAnswerMatch } from '../../lib/answerMatching';

interface FillBlankSessionProps {
  question: FillBlankQuestion;
  onAnswer: (params: { structureId: string; correct: boolean }) => void;
  onNext: () => void;
}

export function FillBlankSession({ question, onAnswer, onNext }: FillBlankSessionProps) {
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
    onAnswer({ structureId: question.structureId, correct });
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <p className="text-lg font-semibold text-slate-900">Fill in the blank</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-2"
      >
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-base text-slate-900">
          {question.before && <span>{question.before}</span>}
          <input
            type="text"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            disabled={!!submitted}
            autoFocus
            className="min-w-[8rem] flex-1 border-b-2 border-slate-400 bg-transparent px-1 py-0.5 text-center focus:border-brand-600 focus:outline-none disabled:bg-slate-50"
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

      {submitted && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 text-sm ${submitted.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <p className="font-medium">{submitted.correct ? 'Correct.' : 'Not quite.'}</p>
            <p className="mt-1 text-slate-700">
              Answer: <span className="font-medium">{question.answer}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-700">{question.fullStatement}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
