import { useParams } from 'react-router-dom';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { StatTile } from '../../../admin/components/Analytics/StatTile';
import { AccuracyByRegionChart } from '../../../admin/components/Analytics/AccuracyByRegionChart';
import { ActiveUsersChart } from '../../../admin/components/Analytics/ActiveUsersChart';

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

/** Educator's cohort-scoped counterpart to admin's platform-wide CohortOverviewScreen — same presentational pieces, cohort-scoped data. */
export function EducatorCohortOverviewScreen() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { students, snapshot, loading, error } = useCohortAnalytics(cohortId);

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading cohort data — this queries every student's sessions, so it can take a moment…
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
  if (!snapshot || !students) return null;

  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink2)', maxWidth: 640 }}>
        {students.length} {students.length === 1 ? 'student' : 'students'} enrolled, aggregated from their own
        attempt data only — no individual answer-by-answer logs are shown here. See the Students tab for per-student
        breakdowns.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <StatTile label="Enrolled students" value={String(students.length)} />
        <StatTile label="Active students" value={String(snapshot.overview.activeStudentCount)} />
        <StatTile label="Total sessions" value={String(snapshot.overview.totalSessions)} />
        <StatTile label="Completion rate" value={pctOrDash(snapshot.overview.completionRatePct)} />
        <StatTile
          label="Mean session length"
          value={
            snapshot.overview.meanSessionLengthMinutes !== null
              ? `${snapshot.overview.meanSessionLengthMinutes.toFixed(1)} min`
              : '—'
          }
        />
      </div>

      <section className="mt-12">
        <h2 style={sectionHeading}>Accuracy by region</h2>
        <AccuracyByRegionChart bars={snapshot.overview.accuracyByRegion} />
      </section>

      <section className="mt-12">
        <h2 style={sectionHeading}>Engagement over time</h2>
        <ActiveUsersChart points={snapshot.overview.activeUsersByDay} />
      </section>
    </div>
  );
}
