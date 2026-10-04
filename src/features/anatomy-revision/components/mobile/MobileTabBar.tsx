import { useEffect, useState } from 'react';
import { EASE } from '../shared/motion';

export type MobileTab = 'today' | 'atlas' | 'progress' | 'account';

const TABS: { tab: MobileTab; label: string }[] = [
  { tab: 'today', label: 'Today' },
  { tab: 'atlas', label: 'Atlas' },
  { tab: 'progress', label: 'Progress' },
  { tab: 'account', label: 'Account' },
];

interface MobileTabBarProps {
  active: MobileTab;
  onNavigate: (tab: MobileTab) => void;
}

/**
 * Bottom tab bar: Today / Atlas / Progress / Account. "Atlas" pointed at the
 * Region Picker until CR-018, because mobile had no browsable muscle list to
 * send it to; MobileAtlas is that screen, so the tab now goes where its label
 * says. The area picker is still one tap away — from Today's "Custom session"
 * and from the Atlas itself — and, like Setup and the Muscle Card, is a step
 * in a flow rather than a tab destination. Account is where a student joins a
 * class and anyone creates one.
 *
 * The admin entrance is on the Account screen (Account/AdminSection), not
 * a fifth tab: five was tight on a narrow phone, and /admin is a separate
 * route tree that could never be the active tab anyway.
 */
/** Where the marker last sat — each screen mounts its own tab bar, so the new one slides from here. See NavSidebar. */
let lastActiveIndex: number | null = null;

export function MobileTabBar({ active, onNavigate }: MobileTabBarProps) {
  const activeIndex = TABS.findIndex((t) => t.tab === active);
  const [markerIndex, setMarkerIndex] = useState(lastActiveIndex ?? activeIndex);
  useEffect(() => {
    lastActiveIndex = activeIndex;
    const frame = requestAnimationFrame(() => setMarkerIndex(activeIndex));
    return () => cancelAnimationFrame(frame);
  }, [activeIndex]);

  return (
    <nav aria-label="Main" className="relative flex flex-none px-5 pt-2 pb-6.5" style={{ background: 'var(--sf)' }}>
      {/* One marker that slides between the tabs, in the slot each tab leaves for it above its label. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-2 h-12">
        <div
          className="flex h-full justify-center motion-reduce:transition-none"
          style={{
            width: `${100 / TABS.length}%`,
            paddingTop: 9,
            transform: `translateX(${markerIndex * 100}%)`,
            transition: `transform 380ms ${EASE}`,
          }}
        >
          <span className="h-0.5 w-5 rounded-full" style={{ background: 'var(--acc)' }} />
        </div>
      </div>
      {TABS.map((t) => {
        const isActive = t.tab === active;
        return (
          <button
            key={t.tab}
            type="button"
            onClick={() => onNavigate(t.tab)}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1.5 border-0 bg-transparent transition-colors duration-200"
            style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: isActive ? 'var(--accd)' : 'var(--ink3)', fontWeight: isActive ? 600 : 400 }}
          >
            <span className="h-0.5 w-5" />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
