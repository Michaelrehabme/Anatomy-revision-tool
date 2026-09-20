import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';

/**
 * Compact header nudge for a device-only account: taps through to Account
 * to sign in.
 *
 * It used to carry sign-in/sign-out inline. Now that /account exists, those
 * live there — a header strip repeating them meant the same actions in two
 * places on every screen, and one of them with no room to say what it does.
 */
export function MobileAccountButton() {
  const { user } = useAuth();

  // A signed-in person reaches their account from the tab bar; a header
  // strip repeating their name on every screen was a row spent on nothing.
  // The strip stays only as the sign-in nudge for a device-only account.
  if (!user || !user.isAnonymous) return null;

  const label = 'Sign in';

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
