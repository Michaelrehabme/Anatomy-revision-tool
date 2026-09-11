import type { Area, Region } from '../../anatomy-revision/types/region';
import type { Category } from '../../anatomy-revision/types/structure';
import type { QuestionType } from '../../anatomy-revision/types/question';

/**
 * Firestore doc shape for cohorts/{cohortId} — see firestore.rules for the
 * matching security rules. A cohort's real access-control boundary is the
 * `cohorts: string[]` array on an educator's custom claim (set via
 * scripts/setEducator.ts), not this document: the doc itself is readable by
 * any signed-in user (needed so a student can resolve a join code and see
 * which cohort they're in), while student DATA — attempts, mastery, session
 * summaries — stays gated by the claim.
 */
export interface Cohort {
  id: string;
  name: string;
  institution: string;
  ownerUid: string;
  joinCode: string;
  createdAt: string;
  archivedAt: string | null;
}

/** Row shape for the educator's student list/detail screens — assembled from users/{uid} plus derived stats, not a raw Firestore doc. */
export interface CohortStudent {
  uid: string;
  displayName: string | null;
  email: string | null;
  joinedAt: string | null;
  lastActiveAt: string | null;
}

interface AssignmentBase {
  id: string;
  cohortId: string;
  title: string;
  dueAt: string;
  createdAt: string;
  createdBy: string;
}

/**
 * The first generation of assignment: a region and a due date, nothing a
 * student can start. Tracked by engagement only — see lib/assignmentCompletion.ts.
 * No longer created, but documents of this shape exist in Firestore and must
 * keep rendering.
 */
export interface RegionAssignment extends AssignmentBase {
  region: Region;
}

/** What a scoped assignment asks about. Matched exactly as the student study screen matches it (filterStructures). */
export interface AssignmentScope {
  /** At least one. OR-matched. */
  areas: Area[];
  /** Absent = every category. */
  category?: Category;
  /** MUSCLE_GROUP_LABELS keys, OR-matched. Absent = no group restriction. Only muscles carry groups, so any group narrows the set to muscles. */
  groups?: string[];
}

/**
 * An assignment a student starts from their Today screen: a fixed-size exam
 * over `scope`, complete once one finished attempt scores `targetAccuracyPct`
 * or better. Retakes are allowed and the best attempt counts.
 */
export interface ScopedAssignment extends AssignmentBase {
  scope: AssignmentScope;
  questionTypes: QuestionType[];
  questionCount: number;
  /** Pass mark, 1-100. */
  targetAccuracyPct: number;
}

/** Firestore doc shape for cohorts/{cohortId}/assignments/{assignmentId}. */
export type Assignment = RegionAssignment | ScopedAssignment;

/** What the create form hands a repository; only scoped assignments are created now. */
export type NewAssignment = Omit<ScopedAssignment, 'id' | 'createdAt'>;

export const isScopedAssignment = (a: Assignment): a is ScopedAssignment => 'scope' in a && !!a.scope;
