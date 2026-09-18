import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import { DiagnosticScreen } from './DiagnosticScreen';

/**
 * /diagnostic — resolves what DiagnosticScreen needs and gets out of the way.
 *
 * Two things have to be looked up before a sitting can start, and neither
 * belongs in the screen: which class the student is in, and — for a follow-up —
 * which questions their baseline asked, since a follow-up that asks anything
 * else is not a follow-up.
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
  structures: AnatomyStructure[];
  images: AnatomyImageAsset[];
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; cohortId: string; replayIds?: string[] }
  | { status: 'unavailable' };

export function DiagnosticRoute({ repository, userId, structures, images }: DiagnosticRouteProps) {
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
        const { getMyCohort } = await import('../../../educator/data/cohortsRepository');
        const cohort = await getMyCohort(userId);
        if (cancelled) return;
        if (!cohort) { setState({ status: 'unavailable' }); return; }

        let replayIds: string[] | undefined;
        if (phase === 'followUp') {
          const results = await repository.listDiagnosticResults(userId);
          const baseline = results
            .filter((r) => r.phase === 'baseline' && r.cohortId === cohort.id)
            .sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0];
          replayIds = baseline?.questionIds;
        }
        if (!cancelled) setState({ status: 'ready', cohortId: cohort.id, replayIds });
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
          This only runs for a class you have joined. Nothing is wrong and nothing was lost — carry
          on revising.
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
      structures={structures}
      images={images}
      replayIds={state.replayIds}
      onDone={() => navigate('/account')}
    />
  );
}
