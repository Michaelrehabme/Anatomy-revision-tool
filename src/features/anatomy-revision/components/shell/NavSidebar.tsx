import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, AUTH_ENABLED } from '../../context/AuthProvider';
import { AuthScreen } from '../Auth/AuthScreen';
import { useRepository } from '../../hooks/useRepository';
import { levelProgress } from '../../lib/levels';
import { EASE } from '../shared/motion';

export type NavSection = 'today' | 'study' | 'atlas' | 'progress' | 'account';

const NAV_ITEMS: { section: NavSection; label: string }[] = [
  { section: 'today', label: 'Today' },
  { section: 'study', label: 'Study' },
  { section: 'atlas', label: 'Atlas' },
  { section: 'progress', label: 'Progress' },
  { section: 'account', label: 'Account' },
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
    repository
      .getGamificationProfile(userId)
      .then((profile) => {
        if (!cancelled) setXpTotal(profile.xpTotal);
      })
      // Offline with nothing cached, this read has no answer to give and
      // rejects ("Failed to get document because the client is offline").
      // With no handler that was an uncaught error on every desktop screen,
      // since every one of them mounts this sidebar. Not knowing the level is
      // already a state this draws — nothing — so there is nothing to add.
      .catch(() => {});
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
        <span data-count style={{ font: '400 10.5px/1 var(--font-mono)', color: 'var(--ink3)' }}>{`${xpTotal} XP`}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <div data-xp className="h-full" style={{ width: `${progress.pct}%`, background: 'var(--acc)' }} />
      </div>
    </div>
  );
}

/**
 * Identity and sign-out only. Joining and creating classes moved to the
 * Account screen — repeating them in a 260px sidebar meant two join-code
 * fields on screen at once, and the sidebar is the wrong place to explain
 * what joining a class shares with an educator.
 */
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

/** Each item is this tall and this far from the next, so the highlight can slide between them by index. */
const NAV_ITEM_HEIGHT = 44;
const NAV_ITEM_GAP = 2;

/**
 * Where the highlight last sat. Every screen mounts its own NavSidebar, so the
 * sidebar that draws a navigation is a new one: it starts the highlight where
 * the previous screen left it and slides it to its own item.
 */
let lastActiveIndex: number | null = null;

/** The standard persistent sidebar: brand mark, 5-item nav, footer slot, account section. */
export function NavSidebar({ active, onNavigate, footer }: NavSidebarProps) {
  const activeIndex = NAV_ITEMS.findIndex((item) => item.section === active);
  const [pillIndex, setPillIndex] = useState(lastActiveIndex ?? activeIndex);
  useEffect(() => {
    lastActiveIndex = activeIndex;
    // A frame later, so the browser has painted the starting position to slide from.
    const frame = requestAnimationFrame(() => setPillIndex(activeIndex));
    return () => cancelAnimationFrame(frame);
  }, [activeIndex]);

  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 25, letterSpacing: '-0.018em' }}>
        LocusMSK
      </div>
      <nav aria-label="Main" className="relative mt-10 flex flex-col" style={{ gap: NAV_ITEM_GAP }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 rounded-[3px] motion-reduce:transition-none"
          style={{
            height: NAV_ITEM_HEIGHT,
            background: 'var(--accs)',
            transform: `translateY(${pillIndex * (NAV_ITEM_HEIGHT + NAV_ITEM_GAP)}px)`,
            transition: `transform 380ms ${EASE}`,
          }}
        />
        {NAV_ITEMS.map((item) => {
          const isActive = item.section === active;
          return (
            <button
              key={item.section}
              type="button"
              onClick={() => onNavigate(item.section)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex items-center rounded-[3px] px-3.5 text-left transition-colors duration-200"
              style={{
                height: NAV_ITEM_HEIGHT,
                fontFamily: 'var(--font-display)',
                fontSize: 18,
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
