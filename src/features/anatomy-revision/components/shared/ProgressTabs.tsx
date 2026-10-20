import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getProgressTab, setProgressTab, type ProgressTab } from '../../lib/preferences';

const TABS: { id: ProgressTab; label: string }[] = [
  { id: 'mastery', label: 'Mastery' },
  { id: 'accuracy', label: 'Accuracy' },
];

interface ProgressTabsProps {
  mastery: ReactNode;
  accuracy: ReactNode;
  /** Mobile: full-width tabs, smaller type. */
  compact?: boolean;
  className?: string;
}

/**
 * Progress's two tabs (owner, 19 Oct 2026): Mastery — how much of the body is
 * known and what is due — and Accuracy — how answers are going over time.
 * Two questions a student asks at different moments, so one page each rather
 * than one long scroll.
 *
 * The WAI-ARIA tabs pattern: arrow keys move between the tabs, and only the
 * open one is in the tab order. Only the open panel is mounted, so the
 * accuracy chart's attempt history is fetched when it is first wanted.
 */
export function ProgressTabs({ mastery, accuracy, compact = false, className }: ProgressTabsProps) {
  const [tab, setTab] = useState<ProgressTab>(getProgressTab);
  const buttons = useRef<Record<ProgressTab, HTMLButtonElement | null>>({ mastery: null, accuracy: null });

  const choose = (next: ProgressTab, focus = false) => {
    setTab(next);
    setProgressTab(next);
    if (focus) buttons.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step) {
      e.preventDefault();
      choose(TABS[(i + step + TABS.length) % TABS.length].id, true);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      choose(TABS[e.key === 'Home' ? 0 : TABS.length - 1].id, true);
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Progress"
        onKeyDown={onKeyDown}
        className={`flex ${compact ? 'gap-1' : 'gap-2'}`}
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => { buttons.current[t.id] = el; }}
              id={`progress-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`progress-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => choose(t.id)}
              className={`relative -mb-px min-h-[46px] ${compact ? 'flex-1 px-2' : 'px-5'}`}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: compact ? 17 : 18,
                color: on ? 'var(--ink)' : 'var(--ink3)',
                borderBottom: on ? '2.5px solid var(--acc)' : '2.5px solid transparent',
                transition: 'color 150ms, border-color 150ms',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          id={`progress-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`progress-tab-${t.id}`}
          hidden={t.id !== tab}
          tabIndex={0}
          className="outline-none"
        >
          {t.id === tab && (t.id === 'mastery' ? mastery : accuracy)}
        </div>
      ))}
    </div>
  );
}
