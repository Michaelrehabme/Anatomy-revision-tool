import { Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { EducatorSidebar } from './EducatorSidebar';
import { EducatorMobileShell } from './EducatorMobileShell';
import { CohortsProvider } from '../CohortsProvider';
import { TeachingGate } from '../TeachingGate';

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
 *
 * TeachingGate sits where the screen goes, in both shells: an account that
 * may not teach keeps the frame and is shown why in place of the screen.
 */
export function EducatorShell() {
  const isDesktop = useIsDesktop();

  return (
    <CohortsProvider>
      {isDesktop ? (
        <AppShell sidebar={<EducatorSidebar />}>
          <div className="px-16 py-16">
            <TeachingGate>
              <Outlet />
            </TeachingGate>
          </div>
        </AppShell>
      ) : (
        <EducatorMobileShell>
          <TeachingGate>
            <Outlet />
          </TeachingGate>
        </EducatorMobileShell>
      )}
    </CohortsProvider>
  );
}
