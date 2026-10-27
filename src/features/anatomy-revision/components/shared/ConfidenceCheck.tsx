import { useMemo } from 'react';
import type { UserAttempt } from '../../types/attempt';
import { calibration, type CalibrationVerdict, type RatingRecord } from '../../lib/confidenceCheck';

const ADVICE: Record<Exclude<CalibrationVerdict, 'too-soon'>, string> = {
  'easy-too-often':
    'Answers you rate Easy often come back wrong. Easy sends a question away for over a week, so when you hesitated even slightly, pick Medium.',
  'hard-too-often':
    'You nearly always get your Hard answers right next time. You know more than you think: Medium would save you reviews.',
  'well-judged': 'Your ratings match what you remember. Keep rating the way you do.',
};

function Figure({ label, record }: { label: string; record: RatingRecord }) {
  return (
    <div className="flex-1" style={{ minWidth: 110 }}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        Rated {label}
      </div>
      <div className="mt-1.5 tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: 'var(--ink)' }}>
        {record.share === null ? '—' : `${Math.round(record.share * 100)}%`}
      </div>
      <div className="mt-0.5" style={{ font: '400 11px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
        {record.share === null
          ? 'none yet'
          : record.judged
            ? `right next time, of ${record.pairs}`
            : `of ${record.pairs}, too few to judge yet`}
      </div>
    </div>
  );
}

/**
 * The confidence check (lib/confidenceCheck.ts), as a card under the accuracy
 * chart. Nothing at all until there are enough rated answers to say
 * something true: an empty card on a new account is one more thing to read
 * that says nothing.
 */
export function ConfidenceCheck({ answered, compact = false }: { answered: readonly UserAttempt[]; compact?: boolean }) {
  const result = useMemo(() => calibration(answered), [answered]);
  if (result.verdict === 'too-soon') return null;
  return (
    <section
      aria-labelledby="confidence-check-title"
      className={compact ? 'mt-9 rounded-[4px] p-4' : 'mt-12 rounded-[4px] p-5'}
      style={{ background: 'var(--sf)', border: '1px solid var(--line)', maxWidth: 720 }}
    >
      <h3
        id="confidence-check-title"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: compact ? 19 : 21, letterSpacing: '-.01em', margin: 0 }}
      >
        Confidence check
      </h3>
      <p className="mt-1.5" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
        How often an answer you got right was still right the next time it came up, by how you rated it.
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        <Figure label="Easy" record={result.easy} />
        <Figure label="Medium" record={result.medium} />
        <Figure label="Hard" record={result.hard} />
      </div>
      <p className="mt-4" style={{ font: `400 ${compact ? 14 : 14.5}px/1.55 var(--font-ui)`, color: 'var(--ink)' }}>
        {ADVICE[result.verdict]}
      </p>
    </section>
  );
}
