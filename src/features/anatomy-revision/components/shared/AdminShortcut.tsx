import { Link } from 'react-router-dom';
import { useAdminEntry } from '../../hooks/useAdminEntry';

/**
 * A way into the admin area from the main screens, for the owner only
 * (owner's request, 16 October 2026: the entrance on the Account screen was
 * too far away during a launch, when the Feedback page is checked daily).
 *
 * Shown to an admin and to nobody else, by the same rule as the Account
 * screen's Admin section (hooks/useAdminEntry): the owner's address
 * (nearyomichael@gmail.com) once confirmed, an admin claim, or a roles
 * document. It opens on Feedback, the page a launch is watched from; the
 * admin area's own sidebar reaches the rest.
 */
export const ADMIN_SHORTCUT_PATH = '/admin/feedback';

export function AdminShortcut({ variant }: { variant: 'sidebar' | 'bar' }) {
  const isAdmin = useAdminEntry();
  if (!isAdmin) return null;
  return variant === 'sidebar' ? (
    <Link
      to={ADMIN_SHORTCUT_PATH}
      className="mt-6 flex items-center rounded-[3px] px-3.5"
      style={{ height: 40, fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink2)', border: '1.2px solid var(--line)', textDecoration: 'none' }}
    >
      Admin
    </Link>
  ) : (
    <Link
      to={ADMIN_SHORTCUT_PATH}
      className="inline-flex items-center rounded-[3px] px-2.5"
      style={{ minHeight: 32, font: '500 11.5px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink2)', border: '1.2px solid var(--line)', textDecoration: 'none' }}
    >
      Admin
    </Link>
  );
}
