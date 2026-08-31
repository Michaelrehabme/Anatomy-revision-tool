import { useEffect, useState } from 'react';
import { ACHIEVEMENT_DEFINITIONS, type AchievementDoc } from '../../lib/achievements';

const AUTO_DISMISS_MS = 4500;

interface AchievementToastStackProps {
  achievements: AchievementDoc[];
}

/**
 * Unobtrusive, self-dismissing toast stack for newly-earned achievements —
 * per CR-008. Takes the raw docs `useRevisionSession.finish()` returns and
 * resolves titles/descriptions from ACHIEVEMENT_DEFINITIONS itself, so
 * callers (RevisionResults/MobileResults) don't need to know that mapping.
 * Fixed-position and shared verbatim between desktop and mobile — a toast
 * doesn't need the two layouts' usual full separation.
 */
export function AchievementToastStack({ achievements }: AchievementToastStackProps) {
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  useEffect(() => {
    if (achievements.length === 0) return;
    setVisibleIds(achievements.map((a) => a.id));
    const timers = achievements.map((a) =>
      setTimeout(() => setVisibleIds((prev) => prev.filter((id) => id !== a.id)), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [achievements]);

  const visible = achievements.filter((a) => visibleIds.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {visible.map((achievement) => {
        const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievement.id);
        return (
          <div
            key={achievement.id}
            className="pointer-events-auto flex max-w-[360px] items-center gap-3 rounded-[4px] px-4 py-3 shadow-lg"
            style={{ background: 'var(--ink)', color: 'var(--sf)' }}
          >
            <span aria-hidden="true" style={{ fontSize: 20 }}>
              🏅
            </span>
            <div>
              <div style={{ font: '600 12px/1 var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.7 }}>
                Achievement earned
              </div>
              <div className="mt-1" style={{ font: '500 14.5px/1.3 var(--font-ui)' }}>
                {def?.title ?? achievement.id}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
