import { Link } from 'react-router-dom';
import { useAdminEntry } from '../../hooks/useAdminEntry';
import { ADMIN_PAGES } from '../../../admin/adminPages';

/**
 * The way into /admin, on the admin's own account screen.
 *
 * It used to be a fifth tab on the phone bar and a link under the desktop
 * nav. Five tabs on a narrow phone was tight for the one person who saw it,
 * and the tab could never be "active" — /admin is a separate route tree. An
 * account screen is where a person's capabilities already live (the classes
 * they teach are here for the same reason), so this section sits beside
 * them, and only for an admin: see hooks/useAdminEntry for why being admin
 * is not sufficient on its own.
 */
export function AdminSection({ compact }: { compact?: boolean }) {
  const showAdmin = useAdminEntry();
  if (!showAdmin) return null;

  const labelStyle = {
    font: `500 ${compact ? 11 : 10}px/1 var(--font-mono)`,
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--ink3)',
  };

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }} data-testid="admin-section">
      <div style={labelStyle}>Admin</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ADMIN_PAGES.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className={`inline-flex items-center rounded-[3px] ${compact ? 'min-h-[44px] px-3.5' : 'px-3 py-1.5'}`}
            style={{ font: `500 ${compact ? 14 : 13.5}px/1 var(--font-ui)`, background: 'var(--accs)', color: 'var(--accd)', textDecoration: 'none' }}
          >
            {page.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
