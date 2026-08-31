import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { Region } from '../../types/region';
import { REGION_LABELS } from '../../types/region';
import { useProgressData } from '../../hooks/useProgressData';
import { BodyFigure } from '../shared/BodyFigure';
import { MobileShell } from './MobileShell';
import { MobileAccountSection } from './MobileAccountSection';
import { AUTH_ENABLED } from '../../context/AuthProvider';
import type { MobileTab } from './MobileTabBar';

interface MobileProgressProps {
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onNavigateTab: (tab: MobileTab) => void;
  onOpenAchievements: () => void;
}

function masteryFill(pct: number): string {
  const mix = Math.round(Math.min(92, Math.max(12, pct)));
  return `color-mix(in oklab, var(--acc) ${mix}%, var(--fig-off))`;
}

/** Screen 11 (mobile). BodyFigure shaded per-region by mastery, not just bars (desktop is bars-only). */
export function MobileProgress({ content, repository, userId, onNavigateTab, onOpenAchievements }: MobileProgressProps) {
  const { streak, masteryByStructureId, byRegion, forecast } = useProgressData(repository, userId, content);

  const fills = Object.fromEntries(byRegion.map((r) => [r.region, masteryFill(r.pct)])) as Partial<Record<Region, string>>;
  const answered = [...masteryByStructureId.values()].reduce((sum, m) => sum + m.attemptsTotal, 0);
  const dueTomorrow = forecast[1] ?? 0;

  return (
    <MobileShell tabs={{ active: 'progress', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        <h2
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 35, lineHeight: 1.04, letterSpacing: '-.022em', margin: 0 }}
        >
          Progress
        </h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
          Mastery shades the map. Pale means unseen, deep means retained.
        </p>
        <button
          type="button"
          onClick={onOpenAchievements}
          className="mt-2 border-0 bg-transparent p-0"
          style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--accd)' }}
        >
          View achievements →
        </button>

        <div className="flex justify-center">
          <div style={{ width: 132 }}>
            <BodyFigure fills={fills} />
          </div>
        </div>

        <div className="mt-0.5 flex flex-col">
          {byRegion.map((r) => (
            <div key={r.region} className="py-2.5">
              <div className="flex items-baseline gap-2.5">
                <span className="flex-1" style={{ fontSize: 16.5, lineHeight: 1.2 }}>
                  {REGION_LABELS[r.region]}
                </span>
                <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}>{r.pct}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
                <div className="h-full" style={{ width: `${r.pct}%`, background: masteryFill(r.pct) }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-8.5">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1 }}>{streak}</div>
            <div className="mt-1.5" style={{ font: '400 10.5px/1.3 var(--font-mono)', color: 'var(--ink3)' }}>
              day streak
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1 }}>{answered}</div>
            <div className="mt-1.5" style={{ font: '400 10.5px/1.3 var(--font-mono)', color: 'var(--ink3)' }}>
              answered
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, lineHeight: 1, color: 'var(--acc2d)' }}>
              {dueTomorrow}
            </div>
            <div className="mt-1.5" style={{ font: '400 10.5px/1.3 var(--font-mono)', color: 'var(--ink3)' }}>
              due tomorrow
            </div>
          </div>
        </div>

        {AUTH_ENABLED && <MobileAccountSection />}
      </div>
    </MobileShell>
  );
}
