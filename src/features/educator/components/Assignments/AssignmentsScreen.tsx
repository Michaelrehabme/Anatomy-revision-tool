import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { REGION_LABELS } from '../../../anatomy-revision/types/region';
import type { RevisionSessionSummary } from '../../../anatomy-revision/types/attempt';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { useEducatorSession } from '../RequireEducator';
import { listAssignments, createAssignment } from '../../data/assignmentsRepository';
import { computeAssignmentCompletion, type StudentAssignmentStatus } from '../../lib/assignmentCompletion';
import { ASSIGNMENT_QUESTION_TYPES, describeAssignmentScope } from '../../lib/assignmentScope';
import {
  isScopedAssignment,
  type Assignment,
  type CohortStudent,
  type NewAssignment,
  type RegionAssignment,
  type ScopedAssignment,
} from '../../types/cohort';
import { CreateAssignmentForm } from './CreateAssignmentForm';

const metaStyle = { font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--ink3)' } as const;

function CardHeader({ assignment, overdue }: { assignment: Assignment; overdue: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ font: '500 15px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{assignment.title}</span>
      <span className="whitespace-nowrap" style={{ font: '400 12px/1 var(--font-mono)', color: overdue ? 'var(--acc2d)' : 'var(--ink3)' }}>
        Due {new Date(assignment.dueAt).toLocaleDateString()}
        {overdue ? ' · overdue' : ''}
      </span>
    </div>
  );
}

/** First-generation assignments: a region, tracked by engagement. Unchanged from before scoped assignments existed. */
function RegionAssignmentCard({ assignment, statuses }: { assignment: RegionAssignment; statuses: StudentAssignmentStatus[] }) {
  const attemptedCount = statuses.filter((s) => s.attempted).length;
  const accuracies = statuses.filter((s) => s.accuracyPct !== null).map((s) => s.accuracyPct!);
  const meanAccuracy = accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : null;

  return (
    <div className="rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <CardHeader assignment={assignment} overdue={statuses[0]?.isOverdue ?? false} />
      <div className="mt-2" style={metaStyle}>
        {REGION_LABELS[assignment.region]}
      </div>
      <div className="mt-3" style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
        {attemptedCount}/{statuses.length} students have attempted this region since assigning
        {meanAccuracy !== null ? ` · mean accuracy ${meanAccuracy}%` : ''}
      </div>
    </div>
  );
}

type StudentRow = { student: CohortStudent; status: StudentAssignmentStatus };

/**
 * Who to chase comes first: below the pass mark (they are trying — the
 * lowest best score is the one most likely to need a conversation), then not
 * started, then passed.
 */
function rankRows(rows: StudentRow[]): StudentRow[] {
  const bucket = (s: StudentAssignmentStatus) => (s.completed ? 2 : s.attempted ? 0 : 1);
  return [...rows].sort(
    (a, b) =>
      bucket(a.status) - bucket(b.status) ||
      (a.status.bestScorePct ?? 0) - (b.status.bestScorePct ?? 0) ||
      (a.student.displayName ?? '').localeCompare(b.student.displayName ?? ''),
  );
}

function ScopedAssignmentCard({
  assignment,
  rows,
  cohortId,
}: {
  assignment: ScopedAssignment;
  rows: StudentRow[];
  cohortId: string;
}) {
  const passed = rows.filter((r) => r.status.completed).length;
  const below = rows.filter((r) => r.status.attempted && !r.status.completed).length;
  const notStarted = rows.length - passed - below;
  const overdue = rows[0]?.status.isOverdue ?? false;
  const formats = assignment.questionTypes
    .map((t) => ASSIGNMENT_QUESTION_TYPES.find((o) => o.value === t)?.label.replace(/ \(.*\)$/, '') ?? t)
    .join(', ');
  const target = assignment.targetAccuracyPct;
  const segments = [
    { count: passed, color: 'var(--acc)', label: 'passed' },
    { count: below, color: 'var(--acc2)', label: `below ${target}%` },
    { count: notStarted, color: 'var(--fig-off)', label: 'not started' },
  ];

  return (
    <div className="rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <CardHeader assignment={assignment} overdue={overdue} />
      <div className="mt-2" style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink2)' }}>
        {describeAssignmentScope(assignment.scope)}
      </div>
      <div className="mt-1" style={metaStyle}>
        {assignment.questionCount} questions · {formats} · pass mark {target}%
      </div>

      {rows.length > 0 && (
        <div className="mt-3.5 flex h-2 overflow-hidden rounded-full" style={{ background: 'var(--fig-off)' }} aria-hidden>
          {segments.map((s) =>
            s.count > 0 ? <div key={s.label} style={{ width: `${(s.count / rows.length) * 100}%`, background: s.color }} /> : null,
          )}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1" style={{ font: '500 13px/1.3 var(--font-mono)', color: 'var(--ink2)' }}>
        <span style={{ color: 'var(--accd)' }}>
          {passed}/{rows.length} passed
        </span>
        <span style={{ color: below > 0 ? 'var(--acc2d)' : 'var(--ink3)' }}>{below} below {target}%</span>
        <span style={{ color: 'var(--ink3)' }}>{notStarted} not started</span>
      </div>

      {rows.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer" style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--accd)' }}>
            Students
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr style={{ borderBottom: '1.2px solid var(--line)' }}>
                  {['Student', 'Status', 'Best', 'Attempts'].map((label) => (
                    <th
                      key={label}
                      className="pb-2 pr-4 whitespace-nowrap"
                      style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankRows(rows).map(({ student, status }) => (
                  <tr key={student.uid} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td className="py-2 pr-4">
                      <Link
                        to={`/educator/${cohortId}/students/${student.uid}`}
                        style={{ font: '500 13px/1.3 var(--font-ui)', color: 'var(--accd)', textDecoration: 'none' }}
                      >
                        {student.displayName ?? student.email ?? student.uid}
                      </Link>
                    </td>
                    <td
                      className="py-2 pr-4 whitespace-nowrap"
                      style={{
                        font: '400 12.5px/1 var(--font-ui)',
                        color: status.completed ? 'var(--accd)' : status.attempted ? 'var(--acc2d)' : 'var(--ink3)',
                      }}
                    >
                      {status.completed ? 'Passed' : status.attempted ? `Below ${target}%` : 'Not started'}
                    </td>
                    <td className="py-2 pr-4" style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                      {status.bestScorePct !== null ? `${status.bestScorePct}%` : '—'}
                    </td>
                    <td className="py-2 pr-4" style={{ font: '400 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
                      {status.attemptsTaken}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function AssignmentCard({
  assignment,
  students,
  summariesByUid,
  cohortId,
}: {
  assignment: Assignment;
  students: CohortStudent[];
  summariesByUid: Map<string, RevisionSessionSummary[]>;
  cohortId: string;
}) {
  const statuses = computeAssignmentCompletion(
    assignment,
    students.map((s) => s.uid),
    summariesByUid,
  );
  if (!isScopedAssignment(assignment)) return <RegionAssignmentCard assignment={assignment} statuses={statuses} />;
  const rows = students.map((student, i) => ({ student, status: statuses[i] }));
  return <ScopedAssignmentCard assignment={assignment} rows={rows} cohortId={cohortId} />;
}

/**
 * List + create form for cohorts/{cohortId}/assignments. New assignments are
 * scoped (areas, category, muscle groups) with a pass mark, and students start
 * them from their Today screen; see lib/assignmentCompletion.ts for how each
 * generation of assignment counts as done.
 */
export function EducatorAssignmentsScreen() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { uid: educatorUid } = useEducatorSession();
  const { students, snapshot, loading, error } = useCohortAnalytics(cohortId);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId) return;
    let cancelled = false;
    listAssignments(cohortId)
      .then((result) => {
        if (!cancelled) setAssignments(result);
      })
      .catch((err) => {
        if (!cancelled) setAssignmentsError(err instanceof Error ? err.message : 'Failed to load assignments.');
      });
    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  const handleCreate = async (input: NewAssignment) => {
    setAssignmentsError(null);
    try {
      const assignment = await createAssignment(input);
      setAssignments((prev) => [assignment, ...(prev ?? [])]);
      return true;
    } catch (err) {
      setAssignmentsError(err instanceof Error ? err.message : 'Failed to create assignment.');
      return false;
    }
  };

  if (!cohortId) return null;

  return (
    <div>
      <CreateAssignmentForm cohortId={cohortId} createdBy={educatorUid} onCreate={handleCreate} />

      {assignmentsError && (
        <div className="mt-4 text-sm" style={{ color: 'var(--acc2d)' }}>
          {assignmentsError}
        </div>
      )}

      {(loading || assignments === null) && (
        <div className="mt-6 text-sm" style={{ color: 'var(--ink3)' }}>
          Loading assignments…
        </div>
      )}
      {error && (
        <div className="mt-6 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </div>
      )}

      {!loading && !error && assignments && students && snapshot && (
        <div className="mt-6 flex flex-col gap-3">
          {assignments.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--ink3)' }}>
              No assignments yet — create one above.
            </div>
          )}
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              students={students}
              summariesByUid={snapshot.summariesByUid}
              cohortId={cohortId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
