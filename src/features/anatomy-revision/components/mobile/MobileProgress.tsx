import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { Region } from '../../types/region';
import { REGION_LABELS } from '../../types/region';
import { useProgressData } from '../../hooks/useProgressData';
import { RegionBodyFigure } from '../shared/BodyFigure';
import { RegionLevelBar, RegionLevelLegend } from '../shared/RegionLevelBar';
import { AccuracySection, StatTile } from '../shared/AccuracySection';
import { ProgressTabs } from '../shared/ProgressTabs';
import { CATEGORIES, CATEGORY_LABELS } from '../../types/structure';
import { MobileShell } from './MobileShell';
import { Tour } from '../shared/Tour';
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
  const { streak, byRegion, forecast, seenByCategory, totalSeen, totalStructures } = useProgressData(repository, userId, content);

  const fills = Object.fromEntries(byRegion.map((r) => [r.region, masteryFill(r.pct)])) as Partial<Record<Region, string>>;
  const dueTomorrow = forecast[1] ?? 0;
  const seenDetail = CATEGORIES.map((c) => `${seenByCategory[c].seen}/${seenByCategory[c].total} ${CATEGORY_LABELS[c].toLowerCase()}`).join(' · ');

  return (
    <MobileShell tabs={{ active: 'progress', onNavigate: onNavigateTab }}>
      <div className="px-6.5 pt-4.5 pb-7.5">
        <h1
          data-in
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 35, lineHeight: 1.04, letterSpacing: '-.022em', margin: 0 }}
        >
          Progress
        </h1>
        <button
          type="button"
          onClick={onOpenAchievements}
          data-in
          data-tour="progress-achievements"
          className="mt-2 border-0 bg-transparent p-0"
          style={{ font: '500 13px/1 var(--font-ui)', color: 'var(--accd)' }}
        >
          View achievements →
        </button>

        <ProgressTabs
          className="mt-5"
          compact
          mastery={
            <>
              <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
                Mastery shades the map. Pale means unseen, deep means retained.
              </p>
              <div data-tour="progress-regions">
                <div className="flex justify-center">
                  <div style={{ width: 132 }}>
                    <RegionBodyFigure fills={fills} />
                  </div>
                </div>

                <div className="mt-2">
                  <RegionLevelLegend />
                </div>
              </div>
              <div className="mt-1.5 flex flex-col">
                {byRegion.map((r) => (
                  <div key={r.region} data-row className="py-2.5">
                    <div className="flex items-baseline gap-2.5">
                      <span className="flex-1" style={{ fontSize: 16.5, lineHeight: 1.2 }}>
                        {REGION_LABELS[r.region]}
                      </span>
                      <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink2)' }}><span data-count>{r.levels.master}</span> mastered</span>
                    </div>
                    <div className="mt-2 overflow-hidden rounded-full">
                      <RegionLevelBar levels={r.levels} height={6} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <StatTile compact label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
                <StatTile compact label="Due tomorrow" value={String(dueTomorrow)} color="var(--acc2d)" />
                <StatTile compact label="Seen" value={`${totalSeen} / ${totalStructures}`} detail={seenDetail} />
              </div>
            </>
          }
          accuracy={
            <AccuracySection className="mt-6" compact repository={repository} userId={userId} content={content} />
          }
        />
      </div>
      <Tour tourKey="progress" />
    </MobileShell>
  );
}
