import { useEffect, useState } from 'react';
import { useRepository } from '../../hooks/useRepository';
import { nextDiagnosticPhase, promptCopy } from '../../lib/diagnosticPrompt';
import type { DiagnosticResult } from '../../lib/diagnostic';
import { areasPaperNeeds, resolveDiagnosticPaper } from '../../lib/diagnosticPapers';
import type { Area } from '../../types/region';

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
 *
 * AND NOTHING UNLESS IT CAN BE SAT HERE, NOW. The card used to ask only
 * whether a sitting was DUE. A follow-up is the paper its baseline was, and
 * that paper may not be buildable on this account any more: the student used
 * their one change of free area and no longer holds the area their baseline
 * was about, or their subscription lapsed and the whole-body paper needs
 * every area. They were offered "Take the follow-up" on every visit, and
 * every visit it led to a screen saying it could not be set up. Now the card
 * asks the second question too (`sitting`), and stays away when the answer
 * is no. The screen that explains why is still there for anyone who arrives
 * by its address.
 */

/** What decides whether a paper can be sat on this device today. */
export interface SittingMeans {
  /** The areas the account may reach: which paper a new baseline would be. */
  areas: readonly Area[];
  /** Of these areas, the ones whose facts are NOT on the device (useAnatomyContent `facts.missing`). */
  missing: (areas: readonly Area[]) => Area[];
}

interface DiagnosticPromptProps {
  uid: string;
  cohortId: string;
  /** When the student joined, if known — see nextDiagnosticPhase on why null is not "long ago". */
  joinedAt?: string | null;
  sitting: SittingMeans;
  onStart: (phase: 'baseline' | 'followUp') => void;
  compact?: boolean;
}

export function DiagnosticPrompt({ uid, cohortId, joinedAt, sitting, onStart, compact }: DiagnosticPromptProps) {
  const { repository } = useRepository();
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  /** The areas the due paper is built from; null while unknown or when nothing can be built. */
  const [needs, setNeeds] = useState<readonly Area[] | null>(null);

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

  const phase = results ? nextDiagnosticPhase({ cohortId, joinedAt: joinedAt ?? null, results }) : null;
  const areasKey = sitting.areas.join(',');

  useEffect(() => {
    setNeeds(null);
    if (!results || !phase) return;
    let cancelled = false;
    const baseline = phase === 'followUp'
      ? results
          .filter((r) => r.phase === 'baseline' && r.cohortId === cohortId)
          .sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0]
      : undefined;
    resolveDiagnosticPaper(phase, baseline, areasKey ? (areasKey.split(',') as Area[]) : [])
      .then((paper) => { if (!cancelled) setNeeds(areasPaperNeeds(paper)); })
      // The papers could not be loaded: nothing can be sat, so nothing is offered.
      .catch(() => { if (!cancelled) setNeeds(null); });
    return () => { cancelled = true; };
  }, [results, phase, cohortId, areasKey]);

  if (!phase || !needs) return null;
  // Due, but not something this device can ask today.
  if (sitting.missing(needs).length > 0) return null;

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
