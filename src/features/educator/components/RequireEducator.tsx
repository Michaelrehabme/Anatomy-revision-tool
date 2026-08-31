import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeToAuthState } from '../../anatomy-revision/data/firebase';

type Status = 'checking' | 'allowed' | 'denied';

interface EducatorClaims {
  uid: string;
  cohorts: string[];
}

const EducatorClaimsContext = createContext<EducatorClaims | null>(null);

/** Cohort ids (and uid) this signed-in educator is claimed for — read once by RequireEducator rather than every screen re-parsing the ID token. */
export function useEducatorClaims(): EducatorClaims {
  const claims = useContext(EducatorClaimsContext);
  if (!claims) throw new Error('useEducatorClaims must be used inside <RequireEducator>.');
  return claims;
}

/**
 * Route guard for /educator/* — same shape and same caveat as
 * admin/components/RequireAdmin.tsx: this only hides UI, it is not the
 * security boundary. The real boundary is firestore.rules, which checks
 * request.auth.token.educator == true and the cohorts array on every
 * educator-scoped read of users/attemptEvents. An educator with an empty
 * `cohorts` claim (set via scripts/setEducator.ts) is denied here too —
 * there's nothing useful to show them.
 */
export function RequireEducator({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [claims, setClaims] = useState<EducatorClaims | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToAuthState((user) => {
        if (cancelled) return;
        if (!user) {
          setStatus('denied');
          return;
        }
        user
          .getIdTokenResult()
          .then((token) => {
            if (cancelled) return;
            const cohorts = Array.isArray(token.claims.cohorts) ? (token.claims.cohorts as string[]) : [];
            if (token.claims.educator === true && cohorts.length > 0) {
              setClaims({ uid: user.uid, cohorts });
              setStatus('allowed');
            } else {
              setStatus('denied');
            }
          })
          .catch(() => {
            if (!cancelled) setStatus('denied');
          });
      });
    } catch {
      // No Firebase project configured (e.g. VITE_PERSISTENCE=local) — educator mode is meaningless without it.
      setStatus('denied');
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Checking educator access…
      </div>
    );
  }

  if (status === 'denied' || !claims) return <Navigate to="/" replace />;

  return <EducatorClaimsContext.Provider value={claims}>{children}</EducatorClaimsContext.Provider>;
}
