export type MobileTab = 'today' | 'picker' | 'progress' | 'account';

const TABS: { tab: MobileTab; label: string }[] = [
  { tab: 'today', label: 'Today' },
  { tab: 'picker', label: 'Atlas' },
  { tab: 'progress', label: 'Progress' },
  { tab: 'account', label: 'Account' },
];

interface MobileTabBarProps {
  active: MobileTab;
  onNavigate: (tab: MobileTab) => void;
}

/**
 * Bottom tab bar: Today / Atlas / Progress / Account. "Atlas" here targets the Region
 * Picker, not a searchable table — mobile has no table screen (see plan's
 * IA-differences note; the desktop Atlas table has no mobile equivalent).
 * Only shown on Today/Picker/Progress themselves, never during a session or
 * on Onboarding/Setup/Muscle Card — see MobileShell's `showTabs` prop.
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
