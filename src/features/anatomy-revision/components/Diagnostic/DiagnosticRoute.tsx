import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import { DiagnosticScreen } from './DiagnosticScreen';
import { nextDiagnosticPhase } from '../../lib/diagnosticPrompt';
import { resolveDiagnosticPaper, type DiagnosticPaper } from '../../lib/diagnosticSample';

/**
 * /diagnostic — resolves what DiagnosticScreen needs and gets out of the way.
 *
 * Two things have to be looked up before a sitting can start, and neither
 * belongs in the screen: which class the student is in, and which paper they
 * are to sit. A baseline is the current fixed paper. A follow-up is whatever
 * its baseline was — that version, those questions — since a follow-up that
 * asks anything else is not a follow-up (lib/diagnosticSample.ts).
 *
 * It also refuses a sitting that is not due. The prompt only offers what
 * nextDiagnosticPhase allows, but this route is a URL: without the same check a
 * student could sit a second baseline, or a "baseline" months after joining,
 * and either would quietly skew the class's before/after figure.
 *
 * The cohort lookup is a dynamic import, matching CohortMembership: the module
 * pulls the Firebase SDK, and a static import would put it in a bundle that
 * must not contain it.
 */

interface DiagnosticRouteProps {
  /** Null while the app is still resolving where data lives, or if it failed to. */
  repository: AnatomyRepository | null;
  /** Null before sign-in has settled. */
  userId: string | null;
  /** The index, the facts in hand, and which areas those cover. */
  content: AnatomyContent;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; cohortId: string; paper: DiagnosticPaper }
  | { status: 'unavailable' };

export function DiagnosticRoute({ repository, userId, content }: DiagnosticRouteProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phase = params.get('phase') === 'followUp' ? 'followUp' : 'baseline';
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // No repository or no identity means there is nowhere to store a result,
    // and a sitting whose score is lost is worse than one never offered.
    if (!repository || !userId) { setState({ status: 'unavailable' }); return; }

    (async () => {
      try {
        const { getMyCohort, getMyCohortJoinedAt } = await import('../../../educator/data/cohortsRepository');
        const [cohort, joinedAt, results] = await Promise.all([
          getMyCohort(userId),
          getMyCohortJoinedAt(userId).catch(() => null),
          repository.listDiagnosticResults(userId),
        ]);
        if (cancelled) return;
        if (!cohort) { setState({ status: 'unavailable' }); return; }
        if (nextDiagnosticPhase({ cohortId: cohort.id, joinedAt, results }) !== phase) {
          setState({ status: 'unavailable' });
          return;
        }

        const baseline = phase === 'followUp'
          ? results
              .filter((r) => r.phase === 'baseline' && r.cohortId === cohort.id)
              .sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0]
          : undefined;
        const paper = await resolveDiagnosticPaper(phase, baseline);
        if (!cancelled) setState({ status: 'ready', cohortId: cohort.id, paper });
      } catch {
        if (!cancelled) setState({ status: 'unavailable' });
      }
    })();

    return () => { cancelled = true; };
  }, [repository, userId, phase]);

  if (state.status === 'loading') return null;

  if (state.status === 'unavailable') {
    return (
      <div className="mx-auto w-full max-w-[680px] px-6 py-12">
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 30, lineHeight: 1.15 }}>
          Nothing to sit just now
        </h1>
        <p className="mt-3" style={{ font: '400 16px/1.55 var(--font-ui)', color: 'var(--ink2)' }}>
          There is no sitting due for you right now. It only runs for a class you have joined, near
          the start and end of a term. Nothing is wrong and nothing was lost — carry on revising.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 rounded-[3px] px-5 py-3"
          style={{ background: 'var(--acc-fill)', color: 'var(--onacc)', border: 0, font: '500 15px/1 var(--font-ui)' }}
        >
          Back to revision
        </button>
      </div>
    );
  }

  if (!repository || !userId) return null;

  return (
    <DiagnosticScreen
      repository={repository}
      userId={userId}
      cohortId={state.cohortId}
      phase={phase}
      content={content}
      paper={state.paper}
      onDone={() => navigate('/account')}
    />
  );
}
