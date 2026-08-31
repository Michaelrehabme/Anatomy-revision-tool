import { Link, NavLink } from 'react-router-dom';

const ADMIN_NAV_ITEMS: { path: string; label: string }[] = [
  { path: '/admin/changes', label: 'Change Register' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/analytics', label: 'Analytics' },
  { path: '/admin/cohorts', label: 'Cohorts' },
];

/** Admin-section counterpart to NavSidebar — same brand mark + nav-list treatment, different item set. */
export function AdminSidebar() {
  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 25, letterSpacing: '-0.018em' }}>
        MSK Atlas
      </div>
      <div
        className="mt-1"
        style={{
          font: '500 11px/1 var(--font-mono)',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink3)',
        }}
      >
        Admin
      </div>
      <nav className="mt-10 flex flex-col gap-0.5">
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="rounded-[3px] px-3.5 py-2.5 text-left transition-colors"
            style={({ isActive }) => ({
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              display: 'block',
              textDecoration: 'none',
              background: isActive ? 'var(--accs)' : 'transparent',
              color: isActive ? 'var(--accd)' : 'var(--ink2)',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      <Link
        to="/"
        className="mt-6 border-t pt-4"
        style={{ borderColor: 'var(--line)', font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}
      >
        ← Back to app
      </Link>
    </>
  );
}
