import { useState, type ReactNode } from 'react';
import { AUTH_ENABLED, useAuth } from '../../context/AuthProvider';
import { AuthScreen } from '../Auth/AuthScreen';

export type NavSection = 'today' | 'study' | 'atlas' | 'progress';

const NAV_ITEMS: { section: NavSection; label: string }[] = [
  { section: 'today', label: 'Today' },
  { section: 'study', label: 'Study' },
  { section: 'atlas', label: 'Atlas' },
  { section: 'progress', label: 'Progress' },
];

interface NavSidebarProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  /** Streak pill / muscle count footer, or any other per-screen sidebar footer content. */
  footer?: ReactNode;
}

function AccountSection() {
  const { user, signOut } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  if (!user) return null;

  return (
    <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
      {user.isAnonymous ? (
        <>
          <div style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
            Create an account to save your progress across devices.
          </div>
          <button
            type="button"
            onClick={() => setShowAuthScreen(true)}
            className="mt-2 rounded-[3px] px-3 py-2 text-left"
            style={{ font: '500 13px/1 var(--font-ui)', background: 'var(--accs)', color: 'var(--accd)' }}
          >
            Create account
          </button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span
            className="truncate"
            style={{ font: '500 13.5px/1 var(--font-ui)', color: 'var(--ink2)' }}
            title={user.displayName ?? user.email ?? undefined}
          >
            {user.displayName ?? user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}
          >
            Sign out
          </button>
        </div>
      )}
      {showAuthScreen && <AuthScreen onClose={() => setShowAuthScreen(false)} />}
    </div>
  );
}

/** The standard persistent sidebar: brand mark, 4-item nav, footer slot, account section. */
export function NavSidebar({ active, onNavigate, footer }: NavSidebarProps) {
  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 25, letterSpacing: '-0.018em' }}>
        MSK Atlas
      </div>
      <nav className="mt-10 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.section === active;
          return (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              className="rounded-[3px] px-3.5 py-2.5 text-left transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                background: isActive ? 'var(--accs)' : 'transparent',
                color: isActive ? 'var(--accd)' : 'var(--ink2)',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1" />
      {footer}
      {AUTH_ENABLED && <AccountSection />}
    </>
  );
}
