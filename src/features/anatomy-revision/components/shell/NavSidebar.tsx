import type { ReactNode } from 'react';

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

/** The standard persistent sidebar: brand mark, 4-item nav, footer slot. */
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
    </>
  );
}
