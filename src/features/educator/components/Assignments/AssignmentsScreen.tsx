import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { REGIONS, REGION_LABELS, type Region } from '../../../anatomy-revision/types/region';
import type { UserAttempt } from '../../../anatomy-revision/types/attempt';
import { useCohortAnalytics } from '../../hooks/useCohortAnalytics';
import { useEducatorClaims } from '../RequireEducator';
import { listAssignments, createAssignment } from '../../data/assignmentsRepository';
import { computeAssignmentCompletion } from '../../lib/assignmentCompletion';
import type { Assignment } from '../../types/cohort';

const inputStyle = {
  font: '400 13.5px/1 var(--font-ui)',
  color: 'var(--ink)',
  background: 'var(--pg)',
  border: '1.2px solid var(--line)',
  borderRadius: 3,
  padding: '8px 10px',
} as const;

function AssignmentCard({ assignment, studentUids, attemptsByUid }: {
  assignment: Assignment;
  studentUids: string[];
  attemptsByUid: Map<string, UserAttempt[]>;
}) {
  const statuses = computeAssignmentCompletion(assignment, studentUids, attemptsByUid);
  const attemptedCount = statuses.filter((s) => s.attempted).length;
  const accuracies = statuses.filter((s) => s.accuracyPct !== null).map((s) => s.accuracyPct!);
  const meanAccuracy = accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : null;
  const overdue = statuses[0]?.isOverdue ?? false;

  return (
    <div className="rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ font: '500 15px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{assignment.title}</span>
        <span style={{ font: '400 12px/1 var(--font-mono)', color: overdue ? 'var(--acc2d)' : 'var(--ink3)' }}>
          Due {new Date(assignment.dueAt).toLocaleDateString()}
          {overdue ? ' · overdue' : ''}
        </span>
      </div>
      <div className="mt-2" style={{ font: '400 12.5px/1 var(--font-ui)', color: 'var(--ink3)' }}>
        {REGION_LABELS[assignment.region]}
      </div>
      <div className="mt-3" style={{ font: '500 13px/1 var(--font-mono)', color: 'var(--ink2)' }}>
        {attemptedCount}/{studentUids.length} students have attempted this region since assigning
        {meanAccuracy !== null ? ` · mean accuracy ${meanAccuracy}%` : ''}
      </div>
    </div>
  );
}

/** List + create form for cohorts/{cohortId}/assignments — completion is "has attempted the assigned region since assignment", not a strict pass/fail bar. See lib/assignmentCompletion.ts for why. */
export function EducatorAssignmentsScreen() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { uid: educatorUid } = useEducatorClaims();
  const { students, snapshot, loading, error } = useCohortAnalytics(cohortId);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const [dueAt, setDueAt] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!cohortId || !title.trim() || !dueAt) return;
    setCreating(true);
    try {
      const assignment = await createAssignment({
        cohortId,
        region,
        title: title.trim(),
        dueAt: new Date(dueAt).toISOString(),
        createdBy: educatorUid,
      });
      setAssignments((prev) => [assignment, ...(prev ?? [])]);
      setTitle('');
      setDueAt('');
    } catch (err) {
      setAssignmentsError(err instanceof Error ? err.message : 'Failed to create assignment.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <section className="flex flex-wrap items-end gap-3 rounded-[4px] p-4" style={{ background: 'var(--sf)', border: '1px solid var(--line)' }}>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rotator cuff review" style={{ ...inputStyle, minWidth: 220 }} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value as Region)} style={inputStyle}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={{ font: '500 11px/1 var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Due date</span>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !title.trim() || !dueAt}
          className="rounded-[3px] px-4 py-2 disabled:opacity-50"
          style={{ font: '500 13.5px/1 var(--font-ui)', background: 'var(--acc)', color: 'var(--onacc)', border: 0 }}
        >
          {creating ? 'Creating…' : 'Create assignment'}
        </button>
      </section>

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
              studentUids={students.map((s) => s.uid)}
              attemptsByUid={snapshot.attemptsByUid}
            />
          ))}
        </div>
      )}
    </div>
  );
}
