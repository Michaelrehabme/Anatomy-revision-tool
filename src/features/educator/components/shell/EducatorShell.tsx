import { Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { EducatorSidebar } from './EducatorSidebar';
import { EducatorMobileShell } from './EducatorMobileShell';
import { CohortsProvider } from '../CohortsProvider';

/**
 * Layout route for /educator/* — the persistent-sidebar shell on desktop
 * (same as admin/student, see AdminShell.tsx), and EducatorMobileShell below
 * 1024px, where AppShell's fixed 260px sidebar leaves the content nothing.
 *
 * Branching on useIsDesktop() rather than CSS matches App.tsx: each shell
 * renders one tree, so the screens inside mount once rather than twice.
 * CohortsProvider sits outside the branch so crossing the breakpoint does not
 * refetch the class list.
 *
 * Desktop page padding lives here rather than on each screen (admin's
 * convention): without it every educator screen sat flush against the sidebar
 * and ran off the right edge, which clipped the confusion-pair counts and the
 * last accuracy column. One place to fix beats six screens each remembering.
 * The mobile shell owns its own, tighter, padding.
 */
export function EducatorShell() {
  const isDesktop = useIsDesktop();

  return (
    <CohortsProvider>
      {isDesktop ? (
        <AppShell sidebar={<EducatorSidebar />}>
          <div className="px-16 py-16">
            <Outlet />
          </div>
        </AppShell>
      ) : (
        <EducatorMobileShell>
          <Outlet />
        </EducatorMobileShell>
      )}
    </CohortsProvider>
  );
}
