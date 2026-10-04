import type { ReactNode } from 'react';
import { AUTH_ENABLED } from '../../context/AuthProvider';
import { MobileAccountButton } from './MobileAccountButton';
import { MobileTabBar, type MobileTab } from './MobileTabBar';
import { useMotionRoot } from '../shared/motion';

interface MobileShellProps {
  children: ReactNode;
  /** Omit to hide the tab bar entirely (during a session, Onboarding, Setup, Muscle Card). */
  tabs?: { active: MobileTab; onNavigate: (tab: MobileTab) => void };
}

/** Full-viewport mobile layout: scrollable content + optional bottom tab bar + account entry point. */
export function MobileShell({ children, tabs }: MobileShellProps) {
  const motionRoot = useMotionRoot<HTMLDivElement>();
  return (
    <div ref={motionRoot} className="flex min-h-screen flex-col" style={{ background: 'var(--pg)', color: 'var(--ink)' }}>
      {tabs && AUTH_ENABLED && <MobileAccountButton />}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      {tabs && <MobileTabBar active={tabs.active} onNavigate={tabs.onNavigate} />}
    </div>
  );
}
