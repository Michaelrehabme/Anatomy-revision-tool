import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './components/RequireAdmin';
import { AdminShell } from './components/shell/AdminShell';
import { ChangeRegisterPage } from './components/ChangeRegister/ChangeRegisterPage';
import { UsersPage } from './components/Users/UsersPage';
import { UserDetailPage } from './components/Users/UserDetailPage';
import { AnalyticsPage } from './components/Analytics/AnalyticsPage';

/**
 * Entry point for the whole /admin/* subtree — this is the module App.tsx
 * React.lazy()-imports, so RequireAdmin and everything it guards only ever
 * downloads for someone who actually navigates to /admin. Default export
 * (not named) because React.lazy() requires it.
 */
export default function AdminApp() {
  return (
    <RequireAdmin>
      <Routes>
        <Route element={<AdminShell />}>
          <Route index element={<Navigate to="changes" replace />} />
          <Route path="changes" element={<ChangeRegisterPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:uid" element={<UserDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="changes" replace />} />
        </Route>
      </Routes>
    </RequireAdmin>
  );
}
