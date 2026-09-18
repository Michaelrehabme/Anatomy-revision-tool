import { StatTile } from './StatTile';
import type { OutcomeComparison } from '../../lib/outcomeComparison';
import type { DiagnosticSummary } from '../../../anatomy-revision/lib/diagnostic';

/**
 * The February screen: what a term of a pilot actually showed.
 *
 * Its job is as much refusal as display. Every figure here is one somebody
 * intends to say out loud to a course leader, so a number that is not yet
 * safe to quote must look different from one that is — not merely be
 * accompanied by a caveat nobody reads.
 *
 * Hence: the sentence renders only when the library licenses it, the caveats
 * are given the same visual weight as the numbers rather than being demoted to
 * small print, and "not enough data yet" is a normal state rather than an
 * error. For most of a pilot's first term that IS the honest answer.
 */

interface OutcomeScreenProps {
  comparison: OutcomeComparison;
  /** The before/after sittings, when any pair exists. */
  diagnostics?: DiagnosticSummary;
  cohortName?: string;
}

const heading = { fontFamily: 'var(--font-display)', fontWeight: 500 as const, letterSpacing: '-.015em' };
const labelStyle = {
  font: '500 10px/1 var(--font-mono)',
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink3)',
};

function points(n: number | null | undefined, suffix = ' pts'): string {
  return n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}${suffix}`;
}

function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${n.toFixed(1)}%`;
}

export function OutcomeScreen({ comparison, diagnostics, cohortName }: OutcomeScreenProps) {
  const { engaged, lessEngaged } = comparison;

  return (
    <div className="pb-16">
      <h1 style={{ ...heading, fontSize: 30 }}>
        Outcomes{cohortName ? ` — ${cohortName}` : ''}
      </h1>
      <p className="mt-2" style={{ font: '400 15px/1.55 var(--font-ui)', color: 'var(--ink2)', maxWidth: '62ch' }}>
        What a term of use showed, and what it does not yet support saying. Read the caveats before
        quoting anything here.
      </p>

      {/* The claim, or the reason there isn't one. */}
      <div
        className="mt-7 rounded-[4px] px-5 py-4"
        style={{
          background: comparison.sentence ? 'var(--accs)' : 'var(--sf)',
          border: `1px solid ${comparison.sentence ? 'transparent' : 'var(--line)'}`,
          borderLeft: `3px solid ${comparison.sentence ? 'var(--acc)' : 'var(--line-strong)'}`,
        }}
      >
        <div style={labelStyle}>{comparison.sentence ? 'The claim this supports' : 'No claim yet'}</div>
        <p
          className="mt-2"
          style={{
            font: `${comparison.sentence ? '600' : '400'} 18px/1.45 var(--font-ui)`,
            color: comparison.sentence ? 'var(--ink)' : 'var(--ink2)',
          }}
        >
          {comparison.sentence ?? 'Not enough students have completed a term for a figure worth quoting. '
            + 'This is the normal state for most of a pilot; it is not an error.'}
        </p>
      </div>

      {/* Engagement split. */}
      <div className="mt-8" style={labelStyle}>
        Split at {comparison.threshold} sessions
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <StatTile label="Engaged students" value={String(engaged.students)} />
        <StatTile label="Less engaged" value={String(lessEngaged.students)} />
        <StatTile label="Mastered — engaged" value={engaged.meanStructuresMastered?.toFixed(1) ?? '—'} />
        <StatTile label="Mastered — less" value={lessEngaged.meanStructuresMastered?.toFixed(1) ?? '—'} />
        <StatTile label="Difference" value={points(comparison.masteryGap, '')} />
      </div>

      {/* Before and after, where it exists. */}
      {diagnostics && (
        <>
          <div className="mt-9" style={labelStyle}>Baseline against follow-up</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <StatTile label="Paired students" value={String(diagnostics.paired)} />
            <StatTile label="Baseline mean" value={pct(diagnostics.meanBaselinePct)} />
            <StatTile label="Follow-up mean" value={pct(diagnostics.meanFollowUpPct)} />
            <StatTile label="Change" value={points(diagnostics.meanGainPoints)} />
            <StatTile label="Improved" value={pct(diagnostics.improvedPct)} />
          </div>
          {!diagnostics.reportable && (
            <p className="mt-3" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
              Too few paired sittings to quote. A student counts only when they sat both — one
              without the other would bias the mean by exactly who dropped out.
            </p>
          )}
        </>
      )}

      {/* Caveats, at full weight. */}
      <div className="mt-9" style={labelStyle}>Say these too</div>
      <ul className="mt-3 flex list-none flex-col gap-2.5 p-0">
        {comparison.caveats.map((caveat) => (
          <li
            key={caveat}
            className="rounded-[3px] px-4 py-3"
            style={{
              font: '400 14.5px/1.55 var(--font-ui)',
              color: 'var(--ink2)',
              background: 'var(--acc2s)',
              borderLeft: '2px solid var(--acc2)',
            }}
          >
            {caveat}
          </li>
        ))}
      </ul>

      {/* The measure nobody should quote, shown so its absence is not mistaken for an oversight. */}
      <div className="mt-9" style={labelStyle}>Not for quoting</div>
      <div className="mt-3 flex flex-wrap gap-3">
        <StatTile label="In-app accuracy gap" value={points(comparison.accuracyGapPoints)} />
        <StatTile label="Accuracy trend" value={points(comparison.withinStudentGainPoints)} />
      </div>
      <p className="mt-3" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink3)', maxWidth: '62ch' }}>
        Accuracy over time is confounded by the scheduler, which serves what a student is about to
        forget and so holds accuracy near a target however well they are doing. These are here to be
        watched, not said.
      </p>
    </div>
  );
}
