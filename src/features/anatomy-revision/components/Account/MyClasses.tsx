import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cohort } from '../../../educator/types/cohort';
import { useTeachingAccess } from '../../../educator/hooks/useTeachingAccess';
import { mayRunCohort, mayTeach } from '../../../educator/lib/teachingAccess';
import { TeachingAccessPanel } from '../../../educator/components/TeachingAccessPanel';

/**
 * The classes this person teaches, on their own account screen — and the way
 * into creating one.
 *
 * There is no "educator" role: whoever makes a class owns it, and owning it
 * is what shows them their students (see firestore.rules). What making one
 * needs, since 6 Oct 2026, is FULL ACCESS on their own account
 * (educator/lib/teachingAccess.ts). So an account without it is told that
 * here, with the way to the plans, in place of a "Create a class" button that
 * would lead to a refusal — and an educator whose access has lapsed still
 * sees their classes listed, because they still have them.
 *
 * cohortsRepository is loaded with `import()` for the same reason
 * CohortMembership does it: it pulls the whole Firebase SDK, and local dev
 * mode must never pay for that just because this component exists.
 */
export function MyClasses({ uid, compact }: { uid: string; compact?: boolean }) {
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const access = useTeachingAccess(uid);

  useEffect(() => {
    let cancelled = false;
    import('../../../educator/data/cohortsRepository')
      .then(({ listCohortsOwnedBy }) => listCohortsOwnedBy(uid))
      .then((result) => {
        if (!cancelled) setCohorts(result);
      })
      // An empty list and a failed read look the same here on purpose: this is a
      // secondary panel on someone's account, not a place to surface a query error.
      .catch(() => {
        if (!cancelled) setCohorts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (cohorts === null || access.loading) return null;

  const labelStyle = {
    font: `500 ${compact ? 11 : 10}px/1 var(--font-mono)`,
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--ink3)',
  };
  const bodySize = compact ? 14 : 13.5;
  const canCreate = mayTeach(access);
  // Any class they could still open: their own access, or that class's licence.
  const canOpen = cohorts.some((cohort) => mayRunCohort(access, cohort));
  const list = cohorts.length > 0 && (
    <div className="mt-2.5 flex flex-col gap-1.5">
      {cohorts.map((cohort) => (
        <div key={cohort.id} className="flex items-baseline justify-between gap-3">
          <span className="truncate" style={{ font: `400 ${bodySize}px/1.3 var(--font-ui)`, color: 'var(--ink2)' }}>
            {cohort.name}
          </span>
          <span style={{ font: '500 12px/1 var(--font-mono)', letterSpacing: '.08em', color: 'var(--ink3)' }}>
            {cohort.joinCode}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
      <div style={labelStyle}>Teaching</div>

      {cohorts.length === 0 && !canCreate ? (
        // Never taught here, and may not start: said plainly, with the way to the plans.
        <div className="mt-2">
          <TeachingAccessPanel compact failed={access.failed} />
        </div>
      ) : cohorts.length === 0 ? (
        <>
          <p className="mt-2 leading-relaxed" style={{ font: `400 ${bodySize}px/1.5 var(--font-ui)`, color: 'var(--ink3)' }}>
            Create a class to get a join code. Students who enter it share their progress with you — their accuracy,
            their weakest structures, and where the group is struggling.
          </p>
          <Link
            to="/educator/new"
            className="mt-3 inline-block rounded-[3px] px-3.5 py-2"
            style={{ font: `500 ${bodySize}px/1 var(--font-ui)`, background: 'var(--accs)', color: 'var(--accd)', textDecoration: 'none' }}
          >
            Create a class
          </Link>
        </>
      ) : !canOpen ? (
        // Access has lapsed. The classes are still theirs, and still listed.
        <>
          {list}
          <div className="mt-3">
            <TeachingAccessPanel compact classNames={cohorts.map((c) => c.name)} failed={access.failed} />
          </div>
        </>
      ) : (
        <>
          {list}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              to="/educator"
              className="rounded-[3px] px-3.5 py-2"
              style={{ font: `500 ${bodySize}px/1 var(--font-ui)`, background: 'var(--accs)', color: 'var(--accd)', textDecoration: 'none' }}
            >
              View my classes
            </Link>
            {canCreate && (
              <Link to="/educator/new" style={{ font: `400 ${bodySize - 1}px/1 var(--font-ui)`, color: 'var(--ink3)' }}>
                New class
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
