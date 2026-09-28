import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import { RegionLevelBar, RegionLevelLegend } from '../../../anatomy-revision/components/shared/RegionLevelBar';
import type { RegionMasteryMix } from '../../lib/rollupAggregation';

/**
 * Mastery level mix per region (lib/rollupAggregation.ts masteryMixByRegion),
 * the same bars a student sees on their own Progress screen. For a class each
 * bar counts every student-structure pair; for one student, their structures.
 *
 * `studentsReporting` below `enrolled` means some students' apps have not yet
 * written a rollup — said outright, because otherwise those students would
 * silently read as having met nothing.
 */
export function MasteryByRegion({
  regions,
  studentsReporting,
  enrolled,
}: {
  regions: readonly RegionMasteryMix[];
  studentsReporting: number;
  enrolled?: number;
}) {
  if (studentsReporting === 0) {
    return (
      <p className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
        No mastery levels yet. They appear once a student opens the app or finishes a session.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-5">
      <RegionLevelLegend />
      {enrolled !== undefined && studentsReporting < enrolled && (
        <p className="text-sm" style={{ color: 'var(--ink3)' }}>
          Counting {studentsReporting} of {enrolled} students. The rest appear the next time they open the app.
        </p>
      )}
      {regions.map(({ region, levels }) => {
        const all = Object.values(levels).reduce((a, b) => a + b, 0);
        const advancedUp = levels.advanced + levels.master;
        return (
          <div key={region}>
            <div className="flex items-baseline gap-3">
              <span className="flex-1" style={{ fontSize: 15, color: 'var(--ink)' }}>
                {REGION_LABELS[region]}
              </span>
              <span style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                {all - levels.unmet} / {all} met
              </span>
              <span style={{ font: '500 12.5px/1 var(--font-mono)', color: 'var(--accd)', minWidth: 110, textAlign: 'right' }}>
                {advancedUp} advanced or better
              </span>
            </div>
            <div className="mt-2">
              <RegionLevelBar levels={levels} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
