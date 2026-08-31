import { useEffect, useState } from 'react';
import type { Cohort } from '../../../educator/types/cohort';

interface CohortMembershipProps {
  uid: string;
  /** Mobile uses a larger type scale than desktop's sidebar — kept as one component rather than two near-duplicates. */
  compact?: boolean;
}

/**
 * Join/leave-by-code UI for CR-012 — lives in anatomy-revision (not
 * educator) since it's student-facing account UI, reaching sideways into
 * educator/data/cohortsRepository for the actual Firestore calls. Shown
 * inside NavSidebar's AccountSection (desktop) and MobileAccountSection,
 * both already gated on AUTH_ENABLED at their call site — but that gate is a
 * runtime check, not something Rollup can use to drop a static import, so
 * cohortsRepository (and everything it pulls in, including the whole
 * Firebase SDK via firebase.ts) is loaded with `import()` here rather than a
 * top-level import. Same reasoning as AuthProvider.tsx's own dynamic
 * `import('../data/firebase')` calls: local dev mode must never pay for
 * Firebase in its bundle just because this component exists.
 *
 * Joining is always explicit (a student types a code in, never auto-joined)
 * and leaving is a single button, no confirmation dance — CR-012's own
 * "make leaving straightforward" requirement. The privacy line is shown in
 * both states so a student sees what an educator can see both before and
 * after joining.
 */
export function CohortMembership({ uid, compact }: CohortMembershipProps) {
  const [cohort, setCohort] = useState<Cohort | null | 'loading'>('loading');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('../../../educator/data/cohortsRepository').then(({ getMyCohort }) =>
      getMyCohort(uid)
        .then((result) => {
          if (!cancelled) setCohort(result);
        })
        .catch(() => {
          if (!cancelled) setCohort(null);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (cohort === 'loading') return null;

  const labelStyle = {
    font: `500 ${compact ? 11 : 10}px/1 var(--font-mono)`,
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--ink3)',
  };
  const noteStyle = { font: `400 ${compact ? 12 : 11}px/1.5 var(--font-mono)`, color: 'var(--ink3)' };
  const fontSize = compact ? 14.5 : 13.5;

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { joinCohortByCode } = await import('../../../educator/data/cohortsRepository');
      const joined = await joinCohortByCode(uid, code.trim());
      setCohort(joined);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join that cohort.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      const { leaveCohort } = await import('../../../educator/data/cohortsRepository');
      await leaveCohort(uid);
      setCohort(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
      <div style={labelStyle}>Class</div>
      {cohort ? (
        <>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate" style={{ font: `500 ${fontSize}px/1 var(--font-ui)`, color: 'var(--ink2)' }}>
              {cohort.name}
            </span>
            <button type="button" onClick={handleLeave} disabled={busy} style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}>
              Leave
            </button>
          </div>
          <div className="mt-2" style={noteStyle}>
            Your educator can see your accuracy, streak, and weak areas — never your individual answers.
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Join code"
              maxLength={8}
              className="min-w-0 flex-1"
              style={{
                font: `500 ${fontSize}px/1 var(--font-mono)`,
                color: 'var(--ink)',
                background: 'var(--pg)',
                border: '1.2px solid var(--line)',
                borderRadius: 3,
                padding: compact ? '9px 10px' : '6px 8px',
              }}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={busy || !code.trim()}
              className="rounded-[3px] px-3 disabled:opacity-50"
              style={{ font: '500 12.5px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)', border: 0 }}
            >
              Join
            </button>
          </div>
          {error && (
            <div className="mt-2" style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--acc2d)' }}>
              {error}
            </div>
          )}
          <div className="mt-2" style={noteStyle}>
            Joining a class lets your educator see your accuracy, streak, and weak areas — never your individual
            answers. You can leave any time.
          </div>
        </>
      )}
    </div>
  );
}
