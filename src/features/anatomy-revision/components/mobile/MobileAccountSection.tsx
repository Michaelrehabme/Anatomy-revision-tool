import { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { AuthScreen } from '../Auth/AuthScreen';
import { Button } from '../shared/Button';
import { CohortMembership } from '../shared/CohortMembership';

/** Mobile equivalent of NavSidebar's AccountSection — same useAuth/AuthScreen wiring, own layout to match the mobile screens' typography scale. Lives at the bottom of MobileProgress, the mobile analog of where desktop places it. */
export function MobileAccountSection() {
  const { user, signOut } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  if (!user) return null;

  return (
    <div className="mt-7 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
      {user.isAnonymous ? (
        <>
          <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
            Create an account to save your progress across devices.
          </div>
          <Button variant="secondary" onClick={() => setShowAuthScreen(true)} className="mt-3.5 min-h-[46px] w-full">
            Create account
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14.5px]" style={{ color: 'var(--ink2)' }} title={user.displayName ?? user.email ?? undefined}>
            {user.displayName ?? user.email}
          </span>
          <button type="button" onClick={() => signOut()} className="text-[13px]" style={{ color: 'var(--ink3)' }}>
            Sign out
          </button>
        </div>
      )}
      {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
      <CohortMembership uid={user.uid} compact />
    </div>
  );
}
