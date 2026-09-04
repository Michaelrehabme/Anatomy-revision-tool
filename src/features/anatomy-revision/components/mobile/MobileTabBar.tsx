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
 */
export function MobileTabBar({ active, onNavigate }: MobileTabBarProps) {
  return (
    <div className="flex flex-none px-5 pt-2 pb-6.5" style={{ background: 'var(--sf)' }}>
      {TABS.map((t) => {
        const isActive = t.tab === active;
        return (
          <button
            key={t.tab}
            type="button"
            onClick={() => onNavigate(t.tab)}
            className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1.5 border-0 bg-transparent"
            style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: isActive ? 'var(--accd)' : 'var(--ink3)', fontWeight: isActive ? 600 : 400 }}
          >
            <span className="h-0.5 w-5 rounded-full" style={{ background: isActive ? 'var(--acc)' : 'transparent' }} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
