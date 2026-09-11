import type { RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import { isScopedAssignment, type Assignment, type RegionAssignment, type ScopedAssignment } from '../types/cohort';

export interface StudentAssignmentStatus {
  uid: string;
  /** Has answered at least one graded question toward the assignment since it was set. */
  attempted: boolean;
  /** Graded questions answered toward it. */
  attemptCount: number;
  /** Accuracy across every one of those questions. */
  accuracyPct: number | null;
  /** Scoped assignments: finished attempts at the set. Always 0 for a region assignment, which has no set to attempt. */
  attemptsTaken: number;
  /** Scoped assignments: the best single attempt's score. Null for region assignments and for a student with no finished attempt. */
  bestScorePct: number | null;
  /** Scoped assignments: the best attempt reached the pass mark. Null for region assignments, which have no bar to reach. */
  completed: boolean | null;
  isOverdue: boolean;
}

/**
 * A finished session's score out of everything it asked. Divided by
 * totalQuestions rather than by the questions answered, so an exam that ran out
 * of time counts what was left unanswered as wrong — otherwise three right
 * answers and a timeout would clear any pass mark.
 */
export function sessionScorePct(summary: RevisionSessionSummary): number | null {
  return summary.totalQuestions > 0 ? Math.round((summary.correctCount / summary.totalQuestions) * 100) : null;
}

/**
 * One student's finished attempts at a scoped assignment. Shared by the
 * educator's card and the student's own Today panel so the two can never
 * disagree about whether somebody has passed.
 *
 * Only sessions stamped with this assignment's id count — never free revision
 * that happens to overlap the scope. A student who revises the hip flexors
 * well has done something good, but they have not sat the set their educator
 * asked for, and a pass mark read off whatever they chose to answer would let
 * them pick easy questions. A session without `finishedAt` was abandoned
 * (only generated demo data has these; the app saves a summary on finishing).
 */
export function assignmentAttempts(
  assignment: ScopedAssignment,
  summaries: readonly RevisionSessionSummary[],
): { attempts: RevisionSessionSummary[]; bestScorePct: number | null; passed: boolean } {
  const attempts = summaries.filter((s) => s.assignmentId === assignment.id && !!s.finishedAt);
  const scores = attempts.map(sessionScorePct).filter((pct): pct is number => pct !== null);
  const bestScorePct = scores.length > 0 ? Math.max(...scores) : null;
  return { attempts, bestScorePct, passed: bestScorePct !== null && bestScorePct >= assignment.targetAccuracyPct };
}

/**
 * Two definitions of completion, one per generation of assignment.
 *
 * SCOPED ASSIGNMENTS have a real bar. The student starts a fixed-size exam
 * over the assignment's scope from their Today screen, the session is stamped
 * with the assignment id, and they are complete once one finished attempt
 * scores the pass mark. Retakes are allowed; the best counts.
 *
 * REGION ASSIGNMENTS (the first generation, still in Firestore) have no bar.
 * "Completion" there means "has engaged with the assigned region since it was
 * set" — attemptCount/accuracyPct since assignment.createdAt, read off each
 * session's breakdownByRegion because the cohort rollup counters carry a
 * region or a time window but never both (CR-031). Those figures are
 * graded-only: a session's breakdownByRegion excludes learn cards, so a
 * student who did nothing but learn cards in the region reads as not started.
 */
export function computeAssignmentCompletion(
  assignment: Assignment,
  studentUids: string[],
  summariesByUid: Map<string, RevisionSessionSummary[]>,
  now: Date = new Date(),
): StudentAssignmentStatus[] {
  const isOverdue = now.getTime() > Date.parse(assignment.dueAt);
  return studentUids.map((uid) => {
    const summaries = summariesByUid.get(uid) ?? [];
    return isScopedAssignment(assignment)
      ? scopedStatus(assignment, uid, summaries, isOverdue)
      : regionStatus(assignment, uid, summaries, isOverdue);
  });
}

function scopedStatus(
  assignment: ScopedAssignment,
  uid: string,
  summaries: RevisionSessionSummary[],
  isOverdue: boolean,
): StudentAssignmentStatus {
  const { attempts, bestScorePct, passed } = assignmentAttempts(assignment, summaries);
  const total = attempts.reduce((sum, s) => sum + s.totalQuestions, 0);
  const correct = attempts.reduce((sum, s) => sum + s.correctCount, 0);
  return {
    uid,
    attempted: attempts.length > 0,
    attemptCount: total,
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    attemptsTaken: attempts.length,
    bestScorePct,
    completed: passed,
    isOverdue,
  };
}

function regionStatus(
  assignment: RegionAssignment,
  uid: string,
  summaries: RevisionSessionSummary[],
  isOverdue: boolean,
): StudentAssignmentStatus {
  const createdMs = Date.parse(assignment.createdAt);
  let total = 0;
  let correct = 0;

  for (const summary of summaries) {
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
    attemptsTaken: 0,
    bestScorePct: null,
    completed: null,
    isOverdue,
  };
}
