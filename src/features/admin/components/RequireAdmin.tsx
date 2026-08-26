import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { subscribeToAuthState } from '../../anatomy-revision/data/firebase';

type Status = 'checking' | 'allowed' | 'denied';

/**
 * Route guard for /admin/* — reads the current user's ID token result and
 * checks the `admin` custom claim (set via scripts/setAdmin.ts). This ONLY
 * hides UI: it's trivial to bypass client-side, so it must never be treated
 * as the real security boundary. That boundary is firestore.rules, which
 * checks request.auth.token.admin == true on every admin-only collection —
 * this guard just spares a non-admin the confusing experience of an admin
 * screen that fails every read.
 *
 * Uses firebase/auth directly (not the app-level AuthProvider context, which
 * only exposes a plain-object AuthUser projection with no token access) —
 * fine because this component only ever loads inside the lazy-loaded admin
 * bundle, so it never pulls Firebase into the student-facing bundle.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');

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
            if (!cancelled) setStatus(token.claims.admin === true ? 'allowed' : 'denied');
          })
          .catch(() => {
            if (!cancelled) setStatus('denied');
          });
      });
    } catch {
      // No Firebase project configured (e.g. VITE_PERSISTENCE=local) — admin is meaningless without it.
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
        Checking admin access…
      </div>
    );
  }

  if (status === 'denied') return <Navigate to="/" replace />;

  return <>{children}</>;
}
