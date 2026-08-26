import type { QuestionDistractorSummary } from '../../types/analytics';

/** Per-question wrong-answer breakdown — which specific distractors are pulling students off the correct answer. */
export function QuestionDistractorList({ summaries }: { summaries: QuestionDistractorSummary[] }) {
  if (summaries.length === 0) {
    return (
      <div className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
        No questions with wrong answers yet.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col">
      {summaries.map((q) => (
        <div key={q.questionId} className="flex items-start justify-between gap-6 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="min-w-0">
            <div style={{ font: '500 14px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{q.structureName}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {q.topWrongAnswers.map((wrong) => (
                <span
                  key={wrong.answer}
                  className="rounded-[3px] px-2 py-1"
                  style={{ font: '400 11.5px/1 var(--font-ui)', background: 'var(--acc2s)', color: 'var(--acc2d)' }}
                >
                  {wrong.answer} × {wrong.count}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-none text-right" style={{ font: '400 12px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
            <div style={{ color: q.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--ink2)', fontWeight: 500 }}>{q.accuracyPct}% correct</div>
            <div>
              {q.totalWrong} / {q.totalAttempts} wrong
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
