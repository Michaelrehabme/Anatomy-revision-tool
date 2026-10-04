import type { LevelCounts } from '../../hooks/useProgressData';
import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS, type MasteryLevel } from '../../lib/masteryLevel';

/**
 * One hue, light to dark, because the levels are ordered: the deeper the
 * shade, the further up the ladder. Never met is not drawn at all — the empty
 * track shows through, and the track is an outline with nothing in it rather
 * than a fill, so it can never be mistaken for the palest level.
 */
const SHADE: Record<MasteryLevel, string> = {
  beginner: 'color-mix(in srgb, var(--acc) 30%, var(--pg))',
  novice: 'color-mix(in srgb, var(--acc) 48%, var(--pg))',
  intermediate: 'color-mix(in srgb, var(--acc) 66%, var(--pg))',
  advanced: 'color-mix(in srgb, var(--acc) 82%, var(--pg))',
  master: 'var(--acc)',
};

const EMPTY_TRACK = { background: 'var(--pg)', boxShadow: 'inset 0 0 0 1px var(--line-strong)' };

function summary(levels: LevelCounts): string {
  const parts = MASTERY_LEVELS.filter((l) => levels[l] > 0).map((l) => `${levels[l]} ${MASTERY_LEVEL_LABELS[l]}`);
  if (levels.unmet > 0) parts.push(`${levels.unmet} not met`);
  return parts.join(', ');
}

/**
 * A region's structures split by mastery level, as one stacked bar. Each
 * segment carries its count in a tooltip, and the whole breakdown is read out
 * as text for screen readers — the shade is never the only way to get it.
 */
export function RegionLevelBar({ levels, height = 8 }: { levels: LevelCounts; height?: number }) {
  const total = MASTERY_LEVELS.reduce((sum, l) => sum + levels[l], levels.unmet);
  if (total === 0) return null;
  return (
    <div role="img" aria-label={summary(levels)} className="w-full overflow-hidden" style={{ height, ...EMPTY_TRACK }}>
      {/* One strip holding every segment, so the bar grows from the left as a whole (shared/motion.ts). */}
      <div data-rbar className="flex h-full w-full" style={{ gap: 2 }}>
        {MASTERY_LEVELS.filter((l) => levels[l] > 0).map((l) => (
          <div
            key={l}
            title={`${MASTERY_LEVEL_LABELS[l]}: ${levels[l]}`}
            style={{ width: `${(levels[l] / total) * 100}%`, background: SHADE[l] }}
          />
        ))}
      </div>
    </div>
  );
}

/** The key for RegionLevelBar — shown once above a list of them. */
export function RegionLevelLegend() {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5" style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>
      {MASTERY_LEVELS.map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" style={{ width: 10, height: 10, background: SHADE[l] }} />
          {MASTERY_LEVEL_LABELS[l]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" style={{ width: 10, height: 10, ...EMPTY_TRACK }} />
        Not met
      </span>
    </div>
  );
}
