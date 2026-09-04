import { Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { EducatorSidebar } from './EducatorSidebar';
import { CohortsProvider } from '../CohortsProvider';

/**
 * Layout route for /educator/* — same persistent-sidebar shell as
 * admin/student, see AdminShell.tsx.
 *
 * Page padding lives here rather than on each screen (admin's convention):
 * without it every educator screen sat flush against the sidebar and ran off
 * the right edge, which clipped the confusion-pair counts and the last
 * accuracy column. One place to fix beats six screens each remembering.
 */
export function EducatorShell() {
  return (
    <CohortsProvider>
      <AppShell sidebar={<EducatorSidebar />}>
        <div className="px-16 py-16">
          <Outlet />
        </div>
      </AppShell>
    </CohortsProvider>
  );
}
