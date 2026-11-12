import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { ADMIN_PAGES } from '../../adminPages';
import { AdminSidebar } from './AdminSidebar';

/** The pages that get a slot of their own in the phone's bottom bar; the rest sit under More. */
const BAR_PAGES = ['/admin/users', '/admin/analytics', '/admin/feedback'];

/**
 * Layout route for /admin/* — reuses the same persistent-sidebar shell as the
 * student app so admin doesn't read as a bolted-on dashboard. The sidebar is
 * pinned, so Back to app stays in the bottom left however long the page.
 *
 * Below the desktop width there is no room for the sidebar, so the pages move
 * to a bar along the bottom, as the student app's tabs do: App first, so Back
 * to app is still the bottom left, then three pages, then More for the rest.
 */
export function AdminShell() {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <AppShell sidebar={<AdminSidebar />} stickySidebar showInstall={false}>
        <Outlet />
      </AppShell>
    );
  }
  return <AdminMobileShell />;
}

function AdminMobileShell() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  const barPages = ADMIN_PAGES.filter((p) => BAR_PAGES.includes(p.path));
  const morePages = ADMIN_PAGES.filter((p) => !BAR_PAGES.includes(p.path));
  const onMorePage = morePages.some((p) => pathname.startsWith(p.path));
  const tab = { font: '500 12.5px/1.15 var(--font-ui)', textDecoration: 'none' } as const;

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: 'var(--pg)' }}>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-20 border-0"
            style={{ background: 'var(--scrim)' }}
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="admin-more"
            className="fixed inset-x-0 z-30 flex flex-col px-3 py-3"
            style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))', background: 'var(--sf)', borderTop: '1px solid var(--line)' }}
          >
            {morePages.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className="rounded-[3px] px-4 py-3.5"
                style={({ isActive }) => ({
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  textDecoration: 'none',
                  background: isActive ? 'var(--accs)' : 'transparent',
                  color: isActive ? 'var(--accd)' : 'var(--ink2)',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      <nav
        aria-label="Admin pages"
        className="relative z-30 flex flex-none px-2"
        style={{ background: 'var(--sf)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Link to="/" className="flex min-h-[64px] flex-1 items-center justify-center" style={{ ...tab, color: 'var(--ink3)' }}>
          ← App
        </Link>
        {barPages.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex min-h-[64px] flex-1 items-center justify-center"
            style={({ isActive }) => ({ ...tab, color: isActive ? 'var(--accd)' : 'var(--ink3)', fontWeight: isActive ? 600 : 500 })}
          >
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="admin-more"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex min-h-[64px] flex-1 items-center justify-center border-0 bg-transparent"
          style={{ ...tab, color: moreOpen || onMorePage ? 'var(--accd)' : 'var(--ink3)', fontWeight: onMorePage ? 600 : 500 }}
        >
          More {moreOpen ? '▾' : '▴'}
        </button>
      </nav>
    </div>
  );
}
