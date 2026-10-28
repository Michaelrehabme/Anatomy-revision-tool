import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { AnatomyRepository } from '../../data/repository';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';
import { buildProgressDrill, type ProgressDrill } from '../../lib/progressDrills';
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
  /** What this account may reach — the drills are clamped to it. */
  access: UseEntitlement;
  content: AnatomyContent;
  repository: AnatomyRepository | null;
  userId: string | null;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  onNavigateTab: (tab: MobileTab) => void;
  onOpenAchievements: () => void;
}

function masteryFill(pct: number): string {
  const mix = Math.round(Math.min(92, Math.max(12, pct)));
  return `color-mix(in oklab, var(--acc) ${mix}%, var(--fig-off))`;
}

/** Screen 11 (mobile). BodyFigure shaded per-region by mastery, not just bars (desktop is bars-only). */
export function MobileProgress({ access, content, repository, userId, onStart, onNavigateTab, onOpenAchievements }: MobileProgressProps) {
  const { streak, byRegion, forecast, forecastMax, untouched, leeches, seenByCategory, totalSeen, totalStructures } = useProgressData(repository, userId, content);
  // The same drills the desktop screen starts (lib/progressDrills.ts).
  const drill = async (kind: ProgressDrill, structureIds: string[]) => {
    const { questions, params } = await buildProgressDrill(kind, { content, repository, userId, structureIds, entitledAreas: access.areas });
    onStart(questions, params);
  };

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

              {/* Below the regions (owner, 28 Oct 2026): what the desktop screen
                  already had in its side column — the fortnight ahead, the
                  untouched and the leeches — in one column for a phone. */}
              <div data-tour="progress-forecast" className="mt-8">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Due over the next fortnight</div>
                <div className="mt-4 flex h-[90px] items-end gap-1.5">
                  {forecast.map((count, i) => (
                    <div
                      key={i}
                      data-wbar
                      className="flex-1"
                      style={{ height: `${Math.max(4, (count / forecastMax) * 100)}%`, background: i === 0 ? 'var(--accd)' : count > 0 ? 'var(--acc)' : 'var(--accs)' }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between">
                  <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>today</span>
                  <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>+7</span>
                  <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>+14</span>
                </div>
              </div>

              <div data-tour="progress-untouched" className="mt-8">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Untouched</div>
                <p className="mt-2.5 text-[15px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {untouched.length > 0
                    ? `${untouched.length} muscles have never come up. Worth a dedicated session.`
                    : 'Every muscle has come up at least once.'}
                </p>
                {untouched.length > 0 && (
                  <button
                    type="button"
                    onClick={() => drill('untouched', untouched.map((m) => m.id))}
                    className="mt-3.5 w-full rounded-[3px] transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
                  style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
                  >
                    Drill the untouched {untouched.length}
                  </button>
                )}
              </div>

              <div data-tour="progress-leeches" className="mt-8">
                <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Leeches</div>
                <p className="mt-2.5 text-[15px] leading-snug" style={{ color: 'var(--ink2)' }}>
                  {leeches.length > 0
                    ? `${leeches.length} structures keep coming back wrong. Worth isolating.`
                    : 'No leeches — nothing is stuck.'}
                </p>
                {leeches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => drill('leeches', leeches.map((m) => m.id))}
                    className="mt-3.5 w-full rounded-[3px] transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
                  style={{ minHeight: 50, background: 'none', border: '1.3px solid var(--line)', color: 'var(--ink)', font: '500 15.5px/1 var(--font-ui)' }}
                  >
                    Drill the {leeches.length} leech{leeches.length === 1 ? '' : 'es'}
                  </button>
                )}
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
