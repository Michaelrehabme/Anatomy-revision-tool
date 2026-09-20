/**
 * The admin pages, as the admin sidebar and the Account screen's Admin
 * section both list them. Pure data, so the Account screen can name the
 * pages without pulling the admin bundle into the app's main chunk.
 */
export const ADMIN_PAGES: { path: string; label: string }[] = [
  { path: '/admin/changes', label: 'Change Register' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/analytics', label: 'Analytics' },
  { path: '/admin/cohorts', label: 'Cohorts' },
  { path: '/admin/people', label: 'People' },
  { path: '/admin/site', label: 'Site' },
];
