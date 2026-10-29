import { Link, NavLink, Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { ADMIN_PAGES } from '../../adminPages';
import { AdminSidebar } from './AdminSidebar';

/**
 * Layout route for /admin/* — reuses the same persistent-sidebar shell as the
 * student app so admin doesn't read as a bolted-on dashboard. The sidebar is
 * pinned, so Back to app stays in the bottom left however long the page.
 *
 * Below the desktop width there is no room for the sidebar: the pages become
 * a scrolling row along the top, and Back to app floats in the bottom left.
 */
export function AdminShell() {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <AppShell sidebar={<AdminSidebar />} stickySidebar>
        <Outlet />
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--pg)' }}>
      <header className="sticky top-0 z-10" style={{ background: 'var(--sf)', borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-baseline gap-2 px-4 pt-4">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-0.018em' }}>LocusMSK</span>
          <span
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            Admin
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pt-2 pb-2.5" aria-label="Admin pages">
          {ADMIN_PAGES.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex-none rounded-[3px] px-3 py-2"
              style={({ isActive }) => ({
                font: '500 13.5px/1 var(--font-ui)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                background: isActive ? 'var(--accs)' : 'transparent',
                color: isActive ? 'var(--accd)' : 'var(--ink2)',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="min-w-0 pb-24">
        <Outlet />
      </main>
      <Link
        to="/"
        className="fixed z-20 rounded-full px-4 py-3"
        style={{
          left: 16,
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          background: 'var(--sf)',
          border: '1px solid var(--line)',
          boxShadow: '0 2px 10px rgba(0,0,0,.12)',
          font: '500 13px/1 var(--font-ui)',
          color: 'var(--ink2)',
          textDecoration: 'none',
        }}
      >
        ← Back to app
      </Link>
    </div>
  );
}
