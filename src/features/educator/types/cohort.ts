import type { Region } from '../../anatomy-revision/types/region';

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

/** Firestore doc shape for cohorts/{cohortId}/assignments/{assignmentId}. */
export interface Assignment {
  id: string;
  cohortId: string;
  region: Region;
  title: string;
  dueAt: string;
  createdAt: string;
  createdBy: string;
}
