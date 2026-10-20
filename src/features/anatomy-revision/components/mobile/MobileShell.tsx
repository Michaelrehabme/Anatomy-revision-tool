import type { ReactNode } from 'react';
import { AUTH_ENABLED } from '../../context/AuthProvider';
import { MobileAccountButton } from './MobileAccountButton';
import { MobileTabBar, type MobileTab } from './MobileTabBar';
import { useMotionRoot } from '../shared/motion';

interface MobileShellProps {
  children: ReactNode;
  /**
   * Omit to hide the tab bar entirely. Only screens where a question is being
   * answered go without it (MobileStudySession, Onboarding, the Diagnostic,
   * none of which use this shell) — and a structure card opened from inside a
   * running session, where a tab would abandon the session (App.tsx
   * StructureRoute).
   */
  tabs?: { active: MobileTab; onNavigate: (tab: MobileTab) => void };
}

/**
 * Full-viewport mobile layout: scrollable content + optional bottom tab bar +
 * account entry point.
 *
 * Exactly the viewport tall, not at least it (it was `min-h-screen`): with a
 * minimum the page simply grew past the screen, <main> never had anything to
 * scroll, and the tab bar was carried down below the fold on any long screen
 * (Atlas, Account). Fixed, <main> scrolls inside it and the bar stays put.
 * `100dvh` where the browser has it, so the bar sits above a phone's browser
 * toolbar rather than under it; `h-screen` (100vh) for the few that do not.
 *
 * So the window itself no longer scrolls on these screens. Nothing in the app
 * listened to window scroll (motion.ts plays entrances on mount, not on
 * scroll), and since each screen mounts its own shell, a new route starts
 * with a fresh <main> at the top — the scroll-to-top a window-scrolled app
 * would have needed comes free.
 */
export function MobileShell({ children, tabs }: MobileShellProps) {
  const motionRoot = useMotionRoot<HTMLDivElement>();
  return (
    <div
      ref={motionRoot}
      className="flex h-screen flex-col supports-[height:100dvh]:h-dvh"
      style={{ background: 'var(--pg)', color: 'var(--ink)' }}
    >
      {tabs && AUTH_ENABLED && <MobileAccountButton />}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      {tabs && <MobileTabBar active={tabs.active} onNavigate={tabs.onNavigate} />}
    </div>
  );
}
