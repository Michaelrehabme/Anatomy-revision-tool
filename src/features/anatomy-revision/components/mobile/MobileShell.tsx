import type { ReactNode } from 'react';
import { MobileTabBar, type MobileTab } from './MobileTabBar';

interface MobileShellProps {
  children: ReactNode;
  /** Omit to hide the tab bar entirely (during a session, Onboarding, Setup, Muscle Card). */
  tabs?: { active: MobileTab; onNavigate: (tab: MobileTab) => void };
}

/** Full-viewport mobile layout: scrollable content + optional bottom tab bar. */
export function MobileShell({ children, tabs }: MobileShellProps) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {tabs && <MobileTabBar active={tabs.active} onNavigate={tabs.onNavigate} />}
    </div>
  );
}
