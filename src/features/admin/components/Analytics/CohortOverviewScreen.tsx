import { useCohortOverview } from '../../hooks/useCohortOverview';
import { StatTile } from './StatTile';
import { AccuracyByRegionChart } from './AccuracyByRegionChart';
import { ActiveUsersChart } from './ActiveUsersChart';

const sectionHeading = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 22,
  letterSpacing: '-.01em',
  margin: 0,
} as const;

function pctOrDash(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export function CohortOverviewScreen() {
  const { overview, loading, error } = useCohortOverview();

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading cohort data — this queries every active user's sessions, so it can take a moment…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--acc2d)' }}>
        {error}
      </div>
    );
  }
  if (!overview) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <StatTile label="Total sessions" value={String(overview.totalSessions)} />
        <StatTile label="Completion rate" value={pctOrDash(overview.completionRatePct)} />
        <StatTile
          label="Mean session length"
          value={overview.meanSessionLengthMinutes !== null ? `${overview.meanSessionLengthMinutes.toFixed(1)} min` : '—'}
        />
        <StatTile label="Day 1 retention" value={pctOrDash(overview.retention.day1Pct)} />
        <StatTile label="Day 7 retention" value={pctOrDash(overview.retention.day7Pct)} />
        <StatTile label="Day 30 retention" value={pctOrDash(overview.retention.day30Pct)} />
      </div>

      <section className="mt-12">
        <h2 style={sectionHeading}>Accuracy by region</h2>
        <AccuracyByRegionChart bars={overview.accuracyByRegion} />
      </section>

      <section className="mt-12">
        <h2 style={sectionHeading}>Active users over time</h2>
        <ActiveUsersChart points={overview.activeUsersByDay} />
      </section>
    </div>
  );
}
