import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentRole } from '../../roles/useCurrentRole';

/**
 * Route guard for /admin/* — allows the bootstrap owner, anyone holding the
 * legacy `admin` custom claim, and anyone an admin has granted admin in
 * roles/{uid} (see src/features/roles).
 *
 * This ONLY hides UI: it's trivial to bypass client-side, so it must never be
 * treated as the real security boundary. That boundary is firestore.rules,
 * which runs the same three checks on every admin-only collection — this
 * guard just spares a non-admin the confusing experience of an admin screen
 * that fails every read.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useCurrentRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: 'var(--ink3)' }}>
        Checking admin access…
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
