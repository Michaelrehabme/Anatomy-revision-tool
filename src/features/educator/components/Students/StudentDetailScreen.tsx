import { Link, useParams } from 'react-router-dom';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { structureWeaknessForStudent } from '../../data/cohortAnalytics';
import { computeStreak } from '../../../anatomy-revision/lib/streak';
import { StatTile } from '../../../admin/components/Analytics/StatTile';
import { REGION_LABELS } from '../../../anatomy-revision/types/region';

const WEAKEST_LIMIT = 8;

/**
 * Per-student view: accuracy, streak, weakest structures, last active — CR-012's
 * explicit ask. Deliberately aggregate/summary only, never a session-by-session
 * or answer-by-answer log — see the privacy note on the students list screen.
 */
export function EducatorStudentDetailScreen() {
  const { cohortId, uid } = useParams<{ cohortId: string; uid: string }>();
  const { students, snapshot, loading, error } = useCohortAnalytics(cohortId);

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading student data…
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
  if (!students || !snapshot || !uid) return null;

  const student = students.find((s) => s.uid === uid);
  const attempts = snapshot.attemptsByUid.get(uid) ?? [];
  const summaries = snapshot.summariesByUid.get(uid) ?? [];

  if (!student) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        That student isn't in this cohort.
      </div>
    );
  }

  const correct = attempts.filter((a) => a.correct).length;
  const accuracyPct = attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : null;
  const streak = computeStreak(summaries);
  const weakest = structureWeaknessForStudent(attempts).slice(0, WEAKEST_LIMIT);

  return (
    <div>
      <Link to={`/educator/${cohortId}/students`} style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink3)', textDecoration: 'none' }}>
        ← Students
      </Link>
      <h1 className="mt-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 34, letterSpacing: '-.02em', margin: '12px 0 0' }}>
        {student.displayName ?? student.email ?? student.uid}
      </h1>

      <div className="mt-6 flex flex-wrap gap-3">
        <StatTile label="Total attempts" value={String(attempts.length)} />
        <StatTile label="Accuracy" value={accuracyPct !== null ? `${accuracyPct}%` : '—'} />
        <StatTile label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
        <StatTile label="Last active" value={student.lastActiveAt ? new Date(student.lastActiveAt).toLocaleDateString() : '—'} />
      </div>

      <section className="mt-10">
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, letterSpacing: '-.01em', margin: 0 }}>
          Weakest structures
        </h2>
        {weakest.length === 0 ? (
          <div className="mt-4 text-sm" style={{ color: 'var(--ink3)' }}>
            Not enough attempts yet.
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {weakest.map((row) => (
              <div key={row.structureId} className="flex items-center justify-between gap-4" style={{ font: '400 13.5px/1 var(--font-ui)' }}>
                <span style={{ color: 'var(--ink)' }}>
                  {row.name} <span style={{ color: 'var(--ink3)' }}>· {REGION_LABELS[row.region]}</span>
                </span>
                <span style={{ font: '500 13px/1 var(--font-mono)', color: row.accuracyPct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}>
                  {row.accuracyPct}% ({row.totalAttempts})
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
