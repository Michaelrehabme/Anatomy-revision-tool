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
 * Route guard for /educator/* — signed in is the whole requirement.
 *
 * There is deliberately no educator role to hold: teaching is self-service,
 * so anyone can create a class and thereby become its owner (see
 * firestore.rules). Someone who owns no class gets the create form rather
 * than a redirect, because "you are not an educator" is not a thing this app
 * can know about a person — only whether they have made a class yet.
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
