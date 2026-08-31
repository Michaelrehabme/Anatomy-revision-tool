import { Link, useParams } from 'react-router-dom';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';

function accuracyPct(attempts: { correct: boolean }[]): number | null {
  if (attempts.length === 0) return null;
  return Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100);
}

/** Per-student accuracy/attempt-count summary, worst accuracy first, linking to each student's drill-down. Never shows raw answer-by-answer logs — see CR-012's privacy requirement. */
export function EducatorStudentsListScreen() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { students, snapshot, loading, error } = useCohortAnalytics(cohortId);

  if (loading) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        Loading roster…
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
  if (!students || !snapshot) return null;

  if (students.length === 0) {
    return (
      <div className="mt-10 text-sm" style={{ color: 'var(--ink3)' }}>
        No students have joined this cohort yet — share the join code from the cohort overview.
      </div>
    );
  }

  const rows = students
    .map((s) => {
      const attempts = snapshot.attemptsByUid.get(s.uid) ?? [];
      return { student: s, attemptCount: attempts.length, accuracyPct: accuracyPct(attempts) };
    })
    .sort((a, b) => (a.accuracyPct ?? 101) - (b.accuracyPct ?? 101));

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
            {['Student', 'Attempts', 'Accuracy', 'Last active'].map((label) => (
              <th
                key={label}
                className="pb-2.5 pr-4 whitespace-nowrap"
                style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, attemptCount, accuracyPct: pct }) => (
            <tr key={student.uid} style={{ borderBottom: '1px solid var(--line)' }}>
              <td className="py-3 pr-4">
                <Link
                  to={`/educator/${cohortId}/students/${student.uid}`}
                  style={{ font: '500 13.5px/1.3 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
                >
                  {student.displayName ?? student.email ?? student.uid}
                </Link>
              </td>
              <td className="py-3 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                {attemptCount}
              </td>
              <td
                className="py-3 pr-4"
                style={{ font: '500 13px/1 var(--font-mono)', color: pct !== null && pct < 60 ? 'var(--acc2d)' : 'var(--accd)' }}
              >
                {pct !== null ? `${pct}%` : '—'}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}>
                {student.lastActiveAt ? new Date(student.lastActiveAt).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
