import { Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { EducatorSidebar } from './EducatorSidebar';

/** Layout route for /educator/* — same persistent-sidebar shell as admin/student, see AdminShell.tsx. */
export function EducatorShell() {
  return (
    <AppShell sidebar={<EducatorSidebar />}>
      <Outlet />
    </AppShell>
  );
}
