import { useEffect, useMemo, useState } from 'react';
import { AccuracyTrendChart } from './AccuracyTrendChart';
import { AccuracyFilters } from './AccuracyFilters';
import { gradedAttempts } from '../../lib/accuracyTrend';
import { useAccuracyFilter } from '../../hooks/useAccuracyFilter';
import type { UserAttempt } from '../../types/attempt';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';

const ATTEMPT_LIMIT = 5000;

/** One extra tile after Attempts and Accuracy — the caller's own figures (streak, seen, due tomorrow). */
export interface AccuracyStat {
  label: string;
  value: string;
  detail?: string;
  /** Tints the number, as the old Progress row did for "due tomorrow". */
  color?: string;
}

interface AccuracySectionProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  /** Mobile type scale and chip sizes. */
  compact?: boolean;
  /**
   * Tiles after Attempts and Accuracy. Passed in rather than computed here,
   * because each Progress screen already reads useProgressData and shows some
   * of those figures elsewhere on the page — the caller picks the ones that
   * would not be duplicates.
   */
  stats?: AccuracyStat[];
  className?: string;
}

/** One number tile. Exported for the Mastery tab's own tiles, so the two tabs share one look. */
export function StatTile({ label, value, detail, color, compact }: AccuracyStat & { compact: boolean }) {
  return (
    <div
      data-in
      className={compact ? 'flex-1 rounded-[4px] px-3.5 py-3' : 'rounded-[4px] px-4 py-3'}
      style={{ background: 'var(--sf)', border: '1px solid var(--line)', minWidth: compact ? 140 : 150 }}
    >
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {label}
      </div>
      <div
        data-count
        className="mt-1.5 tabular-nums"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: compact ? 24 : 26, letterSpacing: '-.01em', color }}
      >
        {value}
      </div>
      {detail && (
        <div className="mt-1" style={{ font: '400 11px/1.4 var(--font-mono)', color: 'var(--ink3)' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

/**
 * The stat tiles and "Accuracy over time" chart, with its filters. Lived on
 * both Account screens until the personalise-study round moved it to
 * Progress, which is where someone goes to ask "how am I doing" — Account is
 * settings. One component for both layouts so the two cannot drift again; the
 * `compact` branches keep the small differences the two screens already had
 * (the delta line under the heading on a phone, inline with it on desktop).
 *
 * The chart is the same component an educator sees about a student, minus
 * the class-average line: a student cannot read their classmates' attempts
 * (firestore.rules), so that comparison is genuinely not theirs.
 */
export function AccuracySection({ repository, userId, content, compact = false, stats = [], className }: AccuracySectionProps) {
  const [attempts, setAttempts] = useState<UserAttempt[] | null>(null);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository
      .listAttempts({ userId, limit: ATTEMPT_LIMIT })
      .then((result) => {
        if (!cancelled) setAttempts(result);
      })
      .catch(() => {
        if (!cancelled) setAttempts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  // Graded answers only: a flashcard learn card is recorded as an attempt
  // but carries no judgement, and was inflating both the tile and the line.
  const answered = useMemo(() => gradedAttempts(attempts ?? []), [attempts]);
  const correct = answered.filter((a) => a.correct).length;
  const accuracyPct = answered.length > 0 ? Math.round((correct / answered.length) * 100) : null;
  // Two lines for one person: structures met for the first time, and
  // structures seen before. No cohort series — a student cannot read their
  // classmates' attempts. The headline reads the seen-before attempts and
  // falls back to everything while those are too few.
  // Both are narrowed by the filters above the chart (lib/attemptFilter.ts);
  // the tiles at the top stay on everything.
  const accuracy = useAccuracyFilter(answered, content);
  const { trend, delta } = accuracy.result;
  // Each line averages its own last few answers, and the two can differ in
  // how many, so the chart says which (accuracyTrend.ts).
  const windowNote = trend.seenBeforeWindow === trend.firstSightWindow
    ? `each point is the last ${trend.seenBeforeWindow} answers of its kind`
    : `each point is the last ${trend.seenBeforeWindow} seen-before answers, or the last ${trend.firstSightWindow} first sights`;

  const heading = {
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    fontSize: compact ? 20 : 22,
    letterSpacing: '-.01em',
    margin: 0,
  } as const;

  return (
    <div className={className}>
      <div className={compact ? 'flex flex-wrap gap-2.5' : 'flex flex-wrap gap-3'}>
        <StatTile compact={compact} label="Attempts" value={String(answered.length)} />
        <StatTile compact={compact} label="Accuracy" value={accuracyPct !== null ? `${accuracyPct}%` : '—'} />
        {stats.map((s) => (
          <StatTile key={s.label} compact={compact} {...s} />
        ))}
      </div>

      <section data-in className={compact ? 'mt-9' : 'mt-12'}>
        {compact ? (
          <>
            <h3 style={heading}>Accuracy over time</h3>
            {delta && (
              <div className="mt-1.5" style={{ font: '500 12.5px/1.4 var(--font-mono)', color: delta.deltaPts >= 0 ? 'var(--accd)' : 'var(--acc2d)' }}>
                {delta.deltaPts >= 0 ? '+' : ''}
                {delta.deltaPts} pts
                <span style={{ color: 'var(--ink3)' }}>
                  {' '}
                  · first {delta.sliceSize} {delta.firstPct}% → last {delta.sliceSize} {delta.lastPct}%
                </span>
              </div>
            )}
          </>
        ) : (
          <h3 style={heading}>
            Accuracy over time
            {delta && (
              <span className="ml-3" style={{ font: '500 13px/1 var(--font-mono)', color: delta.deltaPts >= 0 ? 'var(--accd)' : 'var(--acc2d)' }}>
                {delta.deltaPts >= 0 ? '+' : ''}
                {delta.deltaPts} pts
                <span style={{ color: 'var(--ink3)' }}>
                  {' '}
                  · first {delta.sliceSize} attempts {delta.firstPct}% → last {delta.sliceSize} {delta.lastPct}%
                </span>
              </span>
            )}
          </h3>
        )}
        <AccuracyFilters accuracy={accuracy} compact={compact} />
        <AccuracyTrendChart
          points={trend.seenBeforeTrend}
          studentName="Seen before"
          secondary={{ label: 'First sight', points: trend.firstSightTrend }}
          windowNote={windowNote}
          emptyNote="Too few answers here to draw a line yet — each line needs five of its kind. The figures above still count every one."
        />
      </section>
    </div>
  );
}
