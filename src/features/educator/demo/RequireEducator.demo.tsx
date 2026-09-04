import { createContext, useContext, type ReactNode } from 'react';
import { DEMO_EDUCATOR_UID } from './demoData';

/**
 * Demo-mode stand-in for components/RequireEducator.tsx (README "Educator
 * demo mode"): lets /educator/* render with synthetic claims instead of a
 * real ID token, since nothing about looking at the UI needs Firebase Auth.
 *
 * The alias that swaps this in is gated on `mode === 'development'` in
 * vite.config.ts, so no production build can resolve to it — a guard that
 * always says yes must never be reachable from a deployed bundle.
 */

interface EducatorSession {
  uid: string;
}

const EducatorSessionContext = createContext<EducatorSession | null>(null);

export function useEducatorSession(): EducatorSession {
  const session = useContext(EducatorSessionContext);
  if (!session) throw new Error('useEducatorSession must be used inside <RequireEducator>.');
  return session;
}

export function RequireEducator({ children }: { children: ReactNode }) {
  const session: EducatorSession = { uid: DEMO_EDUCATOR_UID };

  return (
    <EducatorSessionContext.Provider value={session}>
      <div
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          zIndex: 50,
          font: '500 11px/1 var(--font-mono)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--onacc)',
          background: 'var(--acc2d)',
          padding: '6px 10px',
          borderRadius: 3,
        }}
      >
        Demo data
      </div>
      {children}
    </EducatorSessionContext.Provider>
  );
}
