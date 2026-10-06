import { useEffect, useState } from 'react';
import { useCurrentRole } from '../../roles/useCurrentRole';
import type { TeachingAccess } from '../lib/teachingAccess';

/**
 * Whether the signed-in account may teach (lib/teachingAccess.ts), for the
 * educator screens and the Teaching block on the account screen.
 *
 * The entitlement is read with a dynamic import, like every other reach into
 * data/entitlementRepository from a component: it pulls the Firebase SDK,
 * and the demo build swaps it for a stand-in that holds full access (the
 * demo's educator is a licensed account).
 *
 * `failed` is not "no": a read that did not come back must not show a
 * paying educator a panel telling them to subscribe.
 */
export interface UseTeachingAccess extends TeachingAccess {
  loading: boolean;
  /** The entitlement could not be read. Neither yes nor no. */
  failed: boolean;
}

export function useTeachingAccess(uid: string | null): UseTeachingAccess {
  const role = useCurrentRole();
  const [own, setOwn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setOwn(null);
    setFailed(false);
    if (!uid) return;
    let cancelled = false;
    import('../../anatomy-revision/data/entitlementRepository')
      .then(({ readOwnFullAccess }) => readOwnFullAccess(uid))
      .then((answer) => { if (!cancelled) setOwn(answer); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [uid]);

  return {
    own: own === true,
    admin: role.isAdmin,
    loading: role.loading || (uid !== null && own === null && !failed),
    failed,
  };
}
