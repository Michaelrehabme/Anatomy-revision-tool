import { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { AuthScreen } from '../Auth/AuthScreen';

/** Compact header-row account affordance for mobile screens — same sign-in/sign-out actions as desktop's AccountSection, sized for a single line. */
export function MobileAccountButton() {
  const { user, signOut } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  if (!user) return null;

  return (
    <div className="flex items-center justify-end px-4 pt-3">
      {user.isAnonymous ? (
        <button
          type="button"
          onClick={() => setShowAuthScreen(true)}
          className="rounded-[3px] px-3 py-1.5"
          style={{ font: '500 12.5px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
        >
          Sign in
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="max-w-[40vw] truncate"
            style={{ font: '500 12.5px/1 var(--font-ui)', color: 'var(--ink2)' }}
            title={user.displayName ?? user.email ?? undefined}
          >
            {user.displayName ?? user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--ink3)' }}
          >
            Sign out
          </button>
        </div>
      )}
      {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
    </div>
  );
}
