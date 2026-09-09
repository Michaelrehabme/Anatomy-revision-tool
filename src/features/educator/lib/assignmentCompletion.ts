import type { RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import type { Assignment } from '../types/cohort';

export interface StudentAssignmentStatus {
  uid: string;
  /** Has answered at least one graded question in the assigned region since the assignment was created. */
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
 * doesn't have yet, so this is deliberately scoped to what can be answered
 * honestly rather than presenting a synthetic "completed" checkbox that means
 * nothing. Educators reading attemptCount/accuracyPct judge for themselves.
 *
 * COUNTED FROM SESSION SUMMARIES, NOT ATTEMPTS (CR-031). An assignment is the
 * one figure on the dashboard that needs a region AND a time window at once,
 * and the cohort rollup counters carry neither together — they are lifetime
 * totals per structure. A session summary carries both: when it started, and
 * how the answers in it broke down by region.
 *
 * ONE THING CHANGED IN THE MOVE. attemptCount used to include ungraded learn
 * cards, on the reasoning that a student who worked through the cards had
 * engaged with the assignment. A session's breakdownByRegion excludes them
 * (see buildSummary in useRevisionSession — counting a card someone read as a
 * question they answered put "16/24" on a 16-question session), so both
 * figures are now graded-only. A student who did nothing but learn cards in
 * the assigned region now reads as not started. That is a narrower claim than
 * before, but it is the one both numbers on the card actually support, and it
 * no longer means the two columns count different things.
 */
export function computeAssignmentCompletion(
  assignment: Assignment,
  studentUids: string[],
  summariesByUid: Map<string, RevisionSessionSummary[]>,
  now: Date = new Date(),
): StudentAssignmentStatus[] {
  const isOverdue = now.getTime() > Date.parse(assignment.dueAt);
  const createdMs = Date.parse(assignment.createdAt);

  return studentUids.map((uid) => {
    let total = 0;
    let correct = 0;

    for (const summary of summariesByUid.get(uid) ?? []) {
      if (Date.parse(summary.startedAt) < createdMs) continue;
      const bucket = summary.breakdownByRegion[assignment.region];
      if (!bucket) continue;
      total += bucket.total;
      correct += bucket.correct;
    }

    return {
      uid,
      attempted: total > 0,
      attemptCount: total,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
      isOverdue,
    };
  });
}
