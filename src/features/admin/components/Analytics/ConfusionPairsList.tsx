import type { ConfusionPair } from '../../types/analytics';

/** Ranked (correct, selected) pairs across the whole dataset — each one is a distinction students aren't making, and a question worth writing. */
export function ConfusionPairsList({ pairs }: { pairs: ConfusionPair[] }) {
  if (pairs.length === 0) {
    return (
      <div className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
        No wrong answers recorded yet.
      </div>
    );
  }

  const maxCount = pairs[0].count;

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {pairs.map((pair) => (
        <div key={`${pair.correctAnswer}→${pair.selectedAnswer}`} className="flex items-center gap-4">
          <div className="flex w-72 flex-none items-baseline gap-2 whitespace-nowrap" style={{ font: '400 13px/1.3 var(--font-ui)' }}>
            <span style={{ color: 'var(--ink)' }} title="Correct answer">
              {pair.correctAnswer}
            </span>
            <span style={{ color: 'var(--ink3)' }}>→</span>
            <span style={{ color: 'var(--acc2d)' }} title="What students selected instead">
              {pair.selectedAnswer}
            </span>
          </div>
          <div className="min-w-0 flex-1" style={{ background: 'var(--line)', height: 8, borderRadius: 4 }}>
            <div
              title={`${pair.count} wrong ${pair.count === 1 ? 'attempt' : 'attempts'}`}
              style={{
                width: `${Math.max(4, (pair.count / maxCount) * 100)}%`,
                height: '100%',
                background: 'var(--acc2)',
                borderRadius: 4,
              }}
            />
          </div>
          <div className="w-10 flex-none text-right" style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
            {pair.count}
          </div>
        </div>
      ))}
    </div>
  );
}
