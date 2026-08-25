import type { ReactNode } from 'react';

interface AppShellProps {
  /** Sidebar content is contextual (brand+nav vs. in-session end/progress) — see NavSidebar/SessionSidebar. */
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Persistent 260px sidebar + content area, desktop only (≥1024px — see
 * App.tsx for the narrower-viewport fallback). Matches the mockup's shared
 * shell across screens 02–04 and 09–12; screens 05–08 (an active question)
 * reuse this same shell with a different sidebar via SessionSidebar.
 */
export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--pg)' }}>
      <aside
        className="box-border flex w-[260px] flex-none flex-col px-6 py-9"
        style={{ background: 'var(--sf)' }}
      >
        {sidebar}
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
