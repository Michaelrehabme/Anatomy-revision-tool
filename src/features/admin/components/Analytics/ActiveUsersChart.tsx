import type { ActiveUsersPoint } from '../../types/analytics';

/** Single-series column chart, one bar per day, horizontally scrollable so a long date range never overflows the page. */
export function ActiveUsersChart({ points }: { points: ActiveUsersPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
        No activity recorded yet.
      </div>
    );
  }

  const maxUsers = Math.max(...points.map((p) => p.activeUsers), 1);

  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex items-end gap-1" style={{ height: 140, minWidth: points.length * 14 }}>
        {points.map((point) => (
          <div key={point.date} className="flex flex-none flex-col items-center justify-end" style={{ width: 12, height: '100%' }}>
            <div
              title={`${point.date}: ${point.activeUsers} active user${point.activeUsers === 1 ? '' : 's'}`}
              style={{
                width: 10,
                height: `${Math.max(2, (point.activeUsers / maxUsers) * 100)}%`,
                background: 'var(--acc)',
                borderRadius: '3px 3px 0 0',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between" style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
