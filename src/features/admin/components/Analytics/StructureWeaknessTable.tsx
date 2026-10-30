import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import { useIsDesktop } from '../../../anatomy-revision/hooks/useIsDesktop';
import { Facts, FoldList, FoldRow } from '../shared/AdminMobile';
import type { StructureWeaknessRow } from '../../types/analytics';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Green = doing better on repeats than cold (learning through practice); orange = doing worse than the first try (forgetting). */
function LearningDelta({ row }: { row: StructureWeaknessRow }) {
  if (row.firstAttemptAccuracyPct === null) return <span style={{ color: 'var(--ink3)' }}>—</span>;
  const delta = row.accuracyPct - row.firstAttemptAccuracyPct;
  if (delta === 0) return <span style={{ color: 'var(--ink3)' }}>flat</span>;
  const isLearning = delta > 0;
  return (
    <span style={{ color: isLearning ? 'var(--accd)' : 'var(--acc2d)', fontWeight: 500 }}>
      {isLearning ? '↑' : '↓'} {Math.abs(delta)}pt {isLearning ? 'learning' : 'forgetting'}
    </span>
  );
}

export function StructureWeaknessTable({ rows }: { rows: StructureWeaknessRow[] }) {
  const isDesktop = useIsDesktop();
  if (rows.length === 0) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        No structures match these filters at the current attempt threshold.
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <FoldList className="mt-6">
        {rows.map((row) => (
          <FoldRow
            key={row.structureId}
            title={row.name}
            aside={<span style={{ fontFamily: 'var(--font-mono)', color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}>{row.accuracyPct}%</span>}
          >
            <Facts
              items={[
                ['Region', REGION_LABELS[row.region]],
                ['Attempts', row.totalAttempts],
                ['First attempt', row.firstAttemptAccuracyPct !== null ? `${row.firstAttemptAccuracyPct}%` : '—'],
                ['Trend', <LearningDelta row={row} />],
                ['Users', row.distinctUsers],
                ['Mean time', formatDuration(row.meanAnswerTimeMs)],
              ]}
            />
          </FoldRow>
        ))}
      </FoldList>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
            {['Structure', 'Region', 'Attempts', 'Accuracy', 'First-attempt', 'Learning vs. forgetting', 'Users', 'Mean time'].map(
              (label) => (
                <th
                  key={label}
                  data-tour={label === 'Learning vs. forgetting' ? 'edu-weak-trend' : undefined}
                  className="pb-2.5 pr-4 whitespace-nowrap"
                  style={{
                    font: '500 10px/1 var(--font-mono)',
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ink3)',
                  }}
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.structureId} style={{ borderBottom: '1px solid var(--line)' }}>
              <td className="py-3 pr-4" style={{ font: '500 13.5px/1.3 var(--font-ui)', color: 'var(--ink)' }}>
                {row.name}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink2)' }}>
                {REGION_LABELS[row.region]}
              </td>
              <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {row.totalAttempts}
              </td>
              <td
                className="py-3 pr-4"
                style={{ font: '500 13px/1 var(--font-mono)', color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}
              >
                {row.accuracyPct}%
              </td>
              <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {row.firstAttemptAccuracyPct !== null ? `${row.firstAttemptAccuracyPct}%` : '—'}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap" style={{ font: '400 12.5px/1 var(--font-ui)' }}>
                <LearningDelta row={row} />
              </td>
              <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {row.distinctUsers}
              </td>
              <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink3)' }}>
                {formatDuration(row.meanAnswerTimeMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
