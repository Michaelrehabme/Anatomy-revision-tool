import { useEffect, useState } from 'react';
import { useRepository } from '../../hooks/useRepository';
import { nextDiagnosticPhase, promptCopy } from '../../lib/diagnosticPrompt';
import type { DiagnosticResult } from '../../lib/diagnostic';

/**
 * The offer, shown where a student's class is.
 *
 * Placed inside CohortMembership rather than on Today, for two reasons. It is
 * where somebody who has just entered a join code is already looking, and it is
 * the only component that knows the cohort without pulling the Firebase SDK
 * into a bundle that must not have it — see the notes in that file.
 *
 * Renders NOTHING unless there is something to ask, and the decision is
 * lib/diagnosticPrompt's, not this component's. A card that says "you have
 * already done this" is clutter on a screen a student visits for other reasons.
 */

interface DiagnosticPromptProps {
  uid: string;
  cohortId: string;
  /** When the student joined, if known — see nextDiagnosticPhase on why null is not "long ago". */
  joinedAt?: string | null;
  onStart: (phase: 'baseline' | 'followUp') => void;
  compact?: boolean;
}

export function DiagnosticPrompt({ uid, cohortId, joinedAt, onStart, compact }: DiagnosticPromptProps) {
  const { repository } = useRepository();
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    repository
      .listDiagnosticResults(uid)
      .then((rows) => { if (!cancelled) setResults(rows); })
      // A read that fails means we do not know whether they have sat one, and
      // guessing wrong means asking somebody to redo it. Stay quiet instead.
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [repository, uid]);

  if (results === null) return null;

  const phase = nextDiagnosticPhase({ cohortId, joinedAt: joinedAt ?? null, results });
  if (!phase) return null;

  const copy = promptCopy(phase);

  return (
    <div
      className="mt-4 rounded-[3px] px-4 py-3.5"
      style={{ background: 'var(--accs)', border: '1px solid var(--line)' }}
    >
      <div
        style={{
          font: `500 ${compact ? 11 : 10}px/1 var(--font-mono)`,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--accd)',
        }}
      >
        {phase === 'baseline' ? 'Before you start' : 'End of term'}
      </div>

      <div className="mt-2" style={{ font: `600 ${compact ? 16 : 15}px/1.35 var(--font-ui)`, color: 'var(--ink)' }}>
        {copy.title}
      </div>

      <p className="mt-1.5" style={{ font: `400 ${compact ? 14 : 13}px/1.5 var(--font-ui)`, color: 'var(--ink2)' }}>
        {copy.body}
      </p>

      <button
        type="button"
        onClick={() => onStart(phase)}
        className="mt-3 rounded-[3px] px-4 py-2.5"
        style={{
          background: 'var(--acc-fill)',
          color: 'var(--onacc)',
          font: `500 ${compact ? 14.5 : 13.5}px/1 var(--font-ui)`,
          border: 0,
        }}
      >
        {copy.cta}
      </button>
    </div>
  );
}
