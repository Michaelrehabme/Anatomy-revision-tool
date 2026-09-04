import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';

/**
 * Compact header affordance: taps through to the Account screen.
 *
 * It used to carry sign-in/sign-out inline. Now that /account exists, those
 * live there — a header strip repeating them meant the same actions in two
 * places on every screen, and one of them with no room to say what it does.
 */
export function MobileAccountButton() {
  const { user } = useAuth();

  if (!user) return null;

  const label = user.isAnonymous ? 'Sign in' : (user.displayName ?? user.email ?? 'Account');

  return (
    <div className="flex items-center justify-end px-4 pt-3">
      <Link
        to="/account"
        className="max-w-[55vw] truncate rounded-[3px] px-3 py-1.5"
        style={{
          font: '500 12.5px/1 var(--font-ui)',
          background: user.isAnonymous ? 'var(--accs)' : 'transparent',
          color: user.isAnonymous ? 'var(--accd)' : 'var(--ink2)',
          textDecoration: 'none',
        }}
      >
        {label}
      </Link>
    </div>
  );
}
