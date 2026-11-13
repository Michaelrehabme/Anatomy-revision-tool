import type { ReactNode } from 'react';
import { useMotionRoot } from '../shared/motion';
import { InstallStrip } from '../../../pwa/InstallStrip';

interface AppShellProps {
  /** Sidebar content is contextual (brand+nav vs. in-session end/progress) — see NavSidebar/SessionSidebar. */
  sidebar: ReactNode;
  children: ReactNode;
  /** Pin the sidebar to the viewport, so its foot (admin's Back to app) stays in view on a long page. */
  stickySidebar?: boolean;
  /** The install strip at the foot of the page. Off in a running session and in admin. */
  showInstall?: boolean;
}

/**
 * Persistent 260px sidebar + content area, desktop only (≥1024px — see
 * App.tsx for the narrower-viewport fallback). Matches the mockup's shared
 * shell across screens 02–04 and 09–12; screens 05–08 (an active question)
 * reuse this same shell with a different sidebar via SessionSidebar.
 */
export function AppShell({ sidebar, children, stickySidebar = false, showInstall = true }: AppShellProps) {
  const motionRoot = useMotionRoot<HTMLDivElement>();
  return (
    <div ref={motionRoot} className="flex min-h-screen" style={{ background: 'var(--pg)' }}>
      <aside
        className={`box-border flex w-[260px] flex-none flex-col px-6 py-9${stickySidebar ? ' sticky top-0 h-screen overflow-y-auto' : ''}`}
        style={{ background: 'var(--sf)' }}
      >
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        {showInstall && <InstallStrip className="mt-8" />}
      </main>
    </div>
  );
}
