import { createContext, useContext, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentRole } from '../../roles/useCurrentRole';

interface EducatorSession {
  uid: string;
}

const EducatorSessionContext = createContext<EducatorSession | null>(null);

/** The signed-in person viewing /educator. Their uid is the only input to every ownership check. */
export function useEducatorSession(): EducatorSession {
  const session = useContext(EducatorSessionContext);
  if (!session) throw new Error('useEducatorSession must be used inside <RequireEducator>.');
  return session;
}

/**
 * Route guard for /educator/* — signed in is what THIS guard asks.
 *
 * There is deliberately no educator role to hold: whoever creates a class
 * owns it (see firestore.rules). What creating one needs, since 6 Oct 2026,
 * is full access on the account, and that is asked one layer in, by
 * TeachingGate inside the shell — so an account without it keeps the frame
 * and reads why, rather than being bounced to the app with no explanation.
 *
 * The security boundary is firestore.rules, which grants student data by
 * cohort ownership. A signed-in stranger reaching these screens sees their
 * own empty state, not somebody else's class.
 */
export function RequireEducator({ children }: { children: ReactNode }) {
  const { uid, loading } = useCurrentRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Loading…
      </div>
    );
  }

  if (!uid) return <Navigate to="/" replace />;

  return <EducatorSessionContext.Provider value={{ uid }}>{children}</EducatorSessionContext.Provider>;
}
