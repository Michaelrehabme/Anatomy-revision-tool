import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import type { RegionAccuracyBar } from '../../types/analytics';

/** Single-series column chart — one bar per region, capped at 24px wide with a 4px rounded top and a 2px surface gap between bars (see the dataviz skill's mark spec). */
export function AccuracyByRegionChart({ bars }: { bars: RegionAccuracyBar[] }) {
  if (bars.length === 0) {
    return (
      <div className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
        No attempts recorded yet.
      </div>
    );
  }

  const sorted = [...bars].sort((a, b) => a.region.localeCompare(b.region));

  return (
    <div className="mt-6 flex items-end gap-4" style={{ height: 180 }}>
      {sorted.map((bar) => (
        <div key={bar.region} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
          <div style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--ink2)', marginBottom: 6 }}>{bar.accuracyPct}%</div>
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              title={`${bar.region}: ${bar.correct}/${bar.total} correct (${bar.accuracyPct}%)`}
              style={{
                width: 24,
                height: `${Math.max(2, bar.accuracyPct)}%`,
                background: bar.accuracyPct < 60 ? 'var(--acc2)' : 'var(--acc)',
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
          <div
            className="mt-2 text-center"
            style={{ font: '400 11px/1.3 var(--font-ui)', color: 'var(--ink3)', maxWidth: 90 }}
          >
            {REGION_LABELS[bar.region]}
          </div>
        </div>
      ))}
    </div>
  );
}
