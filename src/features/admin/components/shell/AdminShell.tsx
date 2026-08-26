import { Outlet } from 'react-router-dom';
import { AppShell } from '../../../anatomy-revision/components/shell/AppShell';
import { AdminSidebar } from './AdminSidebar';

/** Layout route for /admin/* — reuses the same persistent-sidebar shell as the student app so admin doesn't read as a bolted-on dashboard. */
export function AdminShell() {
  return (
    <AppShell sidebar={<AdminSidebar />}>
      <Outlet />
    </AppShell>
  );
}
