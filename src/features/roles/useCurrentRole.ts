import { useEffect, useState } from 'react';
import { subscribeToAuthState } from '../anatomy-revision/data/firebase';
import { getRole } from './rolesRepository';
import { isBootstrapAdmin } from './bootstrap';
import { NO_ROLE, type CurrentRole } from './types';

/**
 * The signed-in user's uid, and whether they are an admin — from the
 * bootstrap owner address, a legacy `admin` custom claim, or roles/{uid}.
 *
 * There is no educator flag to read: teaching is ownership-based, so
 * /educator asks which classes you own, not what you have been granted.
 *
 * This only decides what to render. firestore.rules performs the same three
 * checks server-side, and that is the security boundary; a user who edits
 * this away gets admin screens that fail every read.
 */
export function useCurrentRole(): CurrentRole {
  const [role, setRole] = useState<CurrentRole>({ ...NO_ROLE, loading: true });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToAuthState((user) => {
        if (cancelled) return;
        if (!user) {
          setRole({ ...NO_ROLE });
          return;
        }

        setRole({ ...NO_ROLE, uid: user.uid, loading: true });

        Promise.all([user.getIdTokenResult(), getRole(user.uid).catch(() => null)])
          .then(([token, doc]) => {
            if (cancelled) return;
            setRole({
              uid: user.uid,
              isAdmin: token.claims.admin === true || doc?.admin === true || isBootstrapAdmin(user.email, user.emailVerified),
              loading: false,
            });
          })
          .catch(() => {
            if (!cancelled) setRole({ ...NO_ROLE, uid: user.uid });
          });
      });
    } catch {
      // No Firebase project configured (VITE_PERSISTENCE=local) — roles are meaningless without one.
      setRole({ ...NO_ROLE });
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return role;
}
