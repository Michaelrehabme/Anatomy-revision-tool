import type { RevisionSessionSummary } from '../../types/attempt';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import { sessionScorePct } from '../../../educator/lib/assignmentCompletion';

/**
 * Pass or not, against the educator's mark, on the results screen of an
 * assignment attempt. Scored the way the educator's dashboard scores it
 * (sessionScorePct), so the student is never told they passed an attempt
 * their educator sees as a fail.
 */
export function AssignmentResultNote({
  assignment,
  summary,
  compact,
}: {
  assignment: NonNullable<RevisionSetupParams['assignment']>;
  summary: RevisionSessionSummary;
  compact?: boolean;
}) {
  const score = sessionScorePct(summary) ?? 0;
  const passed = score >= assignment.targetAccuracyPct;

  return (
    <div
      className={compact ? 'mt-5 rounded-[3px] px-4 py-3.5' : 'mt-7 rounded-[4px] p-4'}
      style={{ background: passed ? 'var(--accs)' : 'var(--acc2s)', border: `1.2px solid ${passed ? 'var(--acc)' : 'var(--acc2)'}` }}
    >
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        {assignment.title}
      </div>
      <div className="mt-2" style={{ font: `600 ${compact ? 17 : 19}px/1.25 var(--font-display)`, color: passed ? 'var(--accd)' : 'var(--acc2d)' }}>
        {passed ? `Passed — ${score}%` : `${score}% — the pass mark is ${assignment.targetAccuracyPct}%`}
      </div>
      <div className="mt-1.5" style={{ font: '400 13px/1.45 var(--font-ui)', color: 'var(--ink2)' }}>
        {passed
          ? 'Your educator will see this assignment as complete.'
          : 'Revise what you missed, then try again from Today. Your best attempt is the one that counts.'}
      </div>
    </div>
  );
}
