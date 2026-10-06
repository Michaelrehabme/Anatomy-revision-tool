import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../anatomy-revision/context/AuthProvider';
import { useTeachingAccess } from '../hooks/useTeachingAccess';
import { mayRunCohort, mayTeach } from '../lib/teachingAccess';
import { useCohorts } from './CohortsProvider';
import { useEducatorSession } from './RequireEducator';
import { TeachingAccessPanel } from './TeachingAccessPanel';

/**
 * Stands between the educator shell and its screens: the screen asked for,
 * or the panel saying teaching needs full access (lib/teachingAccess.ts).
 *
 * WHICH QUESTION IS ASKED DEPENDS ON THE SCREEN.
 *
 *   /educator/new, and /educator for someone with no class yet
 *       — creating a class: the account's own full access, or admin.
 *   /educator/<class>/…
 *       — running THAT class: the same, or the class's own licence.
 *   /educator for someone with classes (the list, or the redirect into one)
 *       — any class they could open.
 *
 * Inside the shell rather than around it, so the educator keeps the frame
 * they know — their class in the sidebar, the way back to the app — with the
 * panel where the screen would be. That is the difference between "this is
 * paused" and "this is gone".
 *
 * firestore.rules refuses the same writes; this is what the educator sees
 * instead of a form that would fail.
 */
export function TeachingGate({ children }: { children: ReactNode }) {
  const { uid } = useEducatorSession();
  const { user } = useAuth();
  const access = useTeachingAccess(uid);
  const { cohorts, loading: cohortsLoading } = useCohorts();
  const { pathname } = useLocation();

  if (access.loading || cohortsLoading) {
    return (
      <div className="mt-10 text-sm" role="status" style={{ color: 'var(--ink3)' }}>
        Loading…
      </div>
    );
  }

  const owned = cohorts ?? [];
  // "/educator", "/educator/new", "/educator/<id>", "/educator/<id>/students/…"
  const [, , segment] = pathname.split('/');
  const creating = segment === 'new' || (!segment && owned.length === 0);
  const cohort = segment && segment !== 'new' ? owned.find((c) => c.id === segment) : undefined;

  const allowed = creating
    ? mayTeach(access)
    : segment
      // A class that is not theirs, or does not exist, is the screen's own
      // business to say; the rules will refuse its data either way.
      ? cohort ? mayRunCohort(access, cohort) : mayTeach(access)
      : owned.some((c) => mayRunCohort(access, c));

  if (allowed) return <>{children}</>;

  return (
    <TeachingAccessPanel
      classNames={owned.map((c) => c.name)}
      guest={user?.isAnonymous ?? false}
      // Only "could not check" when the answer would otherwise be no.
      failed={access.failed}
    />
  );
}
