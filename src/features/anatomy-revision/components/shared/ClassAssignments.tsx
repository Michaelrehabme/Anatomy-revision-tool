import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../../data/repository';
import type { AnatomyContent } from '../../hooks/useAnatomyContent';
import type { RevisionSetupParams } from '../../hooks/useRevisionSession';
import type { RevisionQuestion } from '../../types/question';
import type { RevisionSessionSummary } from '../../types/attempt';
import { generateRevisionSet } from '../../lib/questionGenerators/generateSet';
import { AUTH_ENABLED } from '../../context/AuthProvider';
import { isScopedAssignment, type ScopedAssignment } from '../../../educator/types/cohort';
import { assignmentSetConfig, describeAssignmentScope } from '../../../educator/lib/assignmentScope';
import { assignmentAttempts } from '../../../educator/lib/assignmentCompletion';

const DAY_MS = 86_400_000;
/** A passed assignment stays listed until a week past its due date, so a student sees the tick they earned before it goes. */
const PASSED_GRACE_DAYS = 7;

interface ClassAssignmentsProps {
  repository: AnatomyRepository | null;
  userId: string | null;
  content: AnatomyContent;
  onStart: (questions: RevisionQuestion[], params: RevisionSetupParams) => void;
  /** Mobile type scale. */
  compact?: boolean;
}

interface Row {
  assignment: ScopedAssignment;
  bestScorePct: number | null;
  attemptsTaken: number;
  passed: boolean;
}

function dueLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime()) return 'Overdue';
  const days = Math.floor((due.getTime() - now.getTime()) / DAY_MS);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${due.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

/**
 * The student's half of a class assignment: what their educator has set, how
 * they stand against the pass mark, and the button that starts an attempt.
 *
 * Renders nothing — not an empty state — for anyone not in a class or whose
 * class has set nothing. Most students are in neither, and Today is the one
 * screen whose whole design is "a single decision on open".
 *
 * The cohort and assignment repositories are loaded with `import()` for the
 * reason CohortMembership gives: they pull the Firebase SDK, and local mode
 * must never pay for that because this component exists. Region assignments
 * (the first generation) are not listed: they have no set to start, and
 * listing one with nothing to press would be a dead end.
 */
export function ClassAssignments({ repository, userId, content, onStart, compact }: ClassAssignmentsProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || !userId || !repository) return;
    let cancelled = false;
    (async () => {
      const { getMyCohort } = await import('../../../educator/data/cohortsRepository');
      const cohort = await getMyCohort(userId);
      if (!cohort) return;
      const { listAssignments } = await import('../../../educator/data/assignmentsRepository');
      const [assignments, summaries] = await Promise.all([
        listAssignments(cohort.id),
        // Generous: an attempt made weeks ago still decides whether it passed.
        repository.listSessionSummaries(userId, 200),
      ]);
      if (cancelled) return;
      setRows(buildRows(assignments.filter(isScopedAssignment), summaries, new Date()));
    })()
      // A secondary panel on Today, like CohortMembership's invitations: a
      // failed read hides it rather than taking the screen down.
      .catch((err: unknown) => console.warn('[LocusMSK] Could not load class assignments.', err));
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  if (!rows || rows.length === 0) return null;

  const start = async (assignment: ScopedAssignment) => {
    setStartingId(assignment.id);
    setError(null);
    try {
      // generateSet is repository-free (CR-009), so fact mastery is fetched
      // here — it decides whether each OINA fact is asked as select or typed.
      const factMastery =
        assignment.questionTypes.includes('oina') && repository && userId ? await repository.listFactMastery(userId) : undefined;
      const questions = generateRevisionSet(content.structures, content.images, { ...assignmentSetConfig(assignment), factMastery });
      if (questions.length === 0) {
        setError('This assignment has no questions any more — let your educator know.');
        return;
      }
      onStart(questions, {
        types: assignment.questionTypes,
        areas: assignment.scope.areas,
        category: assignment.scope.category,
        groups: assignment.scope.groups,
        mode: 'assessment',
        assignment: { id: assignment.id, title: assignment.title, targetAccuracyPct: assignment.targetAccuracyPct },
      });
    } finally {
      setStartingId(null);
    }
  };

  const now = new Date();
  const titleSize = compact ? 19 : 22;

  return (
    <div className={compact ? 'mt-9' : 'mt-14'}>
      <div style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
        From your class
      </div>
      <div className="mt-3 flex flex-col">
        {rows.map(({ assignment, bestScorePct, attemptsTaken, passed }) => {
          const overdue = !passed && Date.parse(assignment.dueAt) < now.getTime();
          return (
            <div key={assignment.id} className="flex items-center gap-4 border-b py-4" style={{ borderColor: 'var(--line)' }}>
              <div className="min-w-0 flex-1">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: titleSize, lineHeight: 1.2, color: 'var(--ink)' }}>
                  {assignment.title}
                </div>
                <div className="mt-1" style={{ font: '400 12.5px/1.45 var(--font-ui)', color: 'var(--ink3)' }}>
                  {describeAssignmentScope(assignment.scope)} · {assignment.questionCount} questions
                </div>
                <div className="mt-1.5" style={{ font: '500 12px/1.3 var(--font-mono)' }}>
                  {passed ? (
                    <span style={{ color: 'var(--accd)' }}>Passed · {bestScorePct}%</span>
                  ) : (
                    <>
                      <span style={{ color: overdue ? 'var(--acc2d)' : 'var(--ink2)' }}>{dueLabel(assignment.dueAt, now)}</span>
                      <span style={{ color: 'var(--ink3)' }}>
                        {' · '}
                        {attemptsTaken > 0 ? `best ${bestScorePct}%, ` : ''}pass at {assignment.targetAccuracyPct}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => start(assignment)}
                disabled={startingId !== null}
                className="flex-none rounded-[3px] disabled:opacity-60"
                style={{
                  minHeight: compact ? 44 : 42,
                  padding: '0 16px',
                  font: '500 14px/1 var(--font-ui)',
                  ...(passed
                    ? { background: 'transparent', border: '1.2px solid var(--line)', color: 'var(--ink2)' }
                    : { background: 'var(--acc-fill)', border: 0, color: 'var(--onacc)' }),
                }}
              >
                {startingId === assignment.id ? 'Starting…' : passed ? 'Retake' : attemptsTaken > 0 ? 'Try again' : 'Start'}
              </button>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--acc2d)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Still to pass first, soonest due at the top; passed ones after, until their grace period is over. */
function buildRows(assignments: ScopedAssignment[], summaries: RevisionSessionSummary[], now: Date): Row[] {
  return assignments
    .map((assignment) => {
      const { attempts, bestScorePct, passed } = assignmentAttempts(assignment, summaries);
      return { assignment, bestScorePct, attemptsTaken: attempts.length, passed };
    })
    .filter((row) => !row.passed || Date.parse(row.assignment.dueAt) + PASSED_GRACE_DAYS * DAY_MS > now.getTime())
    .sort((a, b) => Number(a.passed) - Number(b.passed) || a.assignment.dueAt.localeCompare(b.assignment.dueAt));
}
