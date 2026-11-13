import type { Entitlement } from '../../anatomy-revision/lib/entitlement';
import type { Region } from '../../anatomy-revision/types/region';
import type { QuestionnaireSummary } from '../lib/questionnaire';

export interface AdminUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  /** users/{uid}.entitlement as parsed, or null for none. Absent in the demo's people. */
  entitlement?: Entitlement | null;
  /** The onboarding questionnaire's answers (users/{uid}.studyProfile). Absent in the demo's people. */
  questionnaire?: QuestionnaireSummary;
}

/** One row of the /admin/users table — profile fields plus derived stats from attemptEvents/sessions. */
export interface AdminUserRow extends AdminUserProfile {
  totalAttempts: number;
  accuracyPct: number;
  streak: number;
  /** When their most recent question session finished (or started, if it never finished). Null: never did one. */
  lastSessionAt: string | null;
  sessionCount: number;
}

export interface RegionAccuracy {
  region: Region;
  total: number;
  correct: number;
  accuracyPct: number;
}

export interface WeakStructureRow {
  structureId: string;
  name: string;
  attemptsTotal: number;
  accuracyPct: number;
}

export interface AdminUserDetail {
  profile: AdminUserProfile;
  totalAttempts: number;
  accuracyPct: number;
  streak: number;
  lastSessionAt: string | null;
  byRegion: RegionAccuracy[];
  weakestStructures: WeakStructureRow[];
}
