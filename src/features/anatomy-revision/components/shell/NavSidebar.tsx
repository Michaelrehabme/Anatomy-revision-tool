import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { AuthScreen } from '../Auth/AuthScreen';
import { useRepository } from '../../hooks/useRepository';
import { levelProgress } from '../../lib/levels';
import { CohortMembership } from '../shared/CohortMembership';

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

/**
 * Fetches its own data (repository/auth context, no props) rather than
 * threading xpTotal through every one of the 7 screens that render
 * NavSidebar — matches AccountSection's own self-contained pattern below.
 * Re-fetches on mount, which is enough to pick up a just-finished session's
 * XP: finish() always navigates to a new route, so whichever screen renders
 * next mounts a fresh NavSidebar instance.
 */
function LevelProgress() {
  const { repository } = useRepository();
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [xpTotal, setXpTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository.getGamificationProfile(userId).then((profile) => {
      if (!cancelled) setXpTotal(profile.xpTotal);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  if (xpTotal === null) return null;
  const progress = levelProgress(xpTotal);

  return (
    <div className="mt-6" title={`${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP to level ${progress.level + 1}`}>
      <div className="flex items-baseline justify-between">
        <span style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--ink2)' }}>Level {progress.level}</span>
        <span style={{ font: '400 10.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>{xpTotal} XP</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <div className="h-full" style={{ width: `${progress.pct}%`, background: 'var(--acc)' }} />
      </div>
    </div>
  );
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
      <CohortMembership uid={user.uid} />
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
      <LevelProgress />
      {footer}
      {AUTH_ENABLED && <AccountSection />}
    </>
  );
}
