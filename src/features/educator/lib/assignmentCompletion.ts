import type { UserAttempt } from '../../anatomy-revision/types/attempt';
import type { Assignment } from '../types/cohort';

export interface StudentAssignmentStatus {
  uid: string;
  /** Has answered at least one question in the assigned region since the assignment was created. */
  attempted: boolean;
  attemptCount: number;
  accuracyPct: number | null;
  isOverdue: boolean;
}

/**
 * "Completion" here means "has engaged with the assigned region since it was
 * set" — attemptCount/accuracyPct since assignment.createdAt, not a stricter
 * pass/fail bar. A firmer definition (e.g. "10 correct answers") would need
 * either a lot more per-student tuning or a session/topic construct this app
 * doesn't have yet — deliberately scoped to what the existing attempt log can
 * answer honestly, rather than presenting a synthetic "completed" checkbox
 * that doesn't actually mean anything. Educators reading `attemptCount`/
 * `accuracyPct` can judge for themselves whether that counts as done.
 */
export function computeAssignmentCompletion(
  assignment: Assignment,
  studentUids: string[],
  attemptsByUid: Map<string, UserAttempt[]>,
  now: Date = new Date(),
): StudentAssignmentStatus[] {
  const isOverdue = now.getTime() > Date.parse(assignment.dueAt);

  return studentUids.map((uid) => {
    const relevant = (attemptsByUid.get(uid) ?? []).filter(
      (a) => a.region === assignment.region && Date.parse(a.timestamp) >= Date.parse(assignment.createdAt),
    );
    // attemptCount stays over every exposure — a student who worked through the
    // learn cards did engage with the assignment — but accuracy only counts
    // answers that were graded (CR-018).
    const graded = relevant.filter((a) => a.graded !== false);
    const correct = graded.filter((a) => a.correct).length;

    return {
      uid,
      attempted: relevant.length > 0,
      attemptCount: relevant.length,
      accuracyPct: graded.length > 0 ? Math.round((correct / graded.length) * 100) : null,
      isOverdue,
    };
  });
}
