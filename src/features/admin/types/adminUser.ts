import type { Region } from '../../anatomy-revision/types/region';

export interface AdminUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
}

/** One row of the /admin/users table — profile fields plus derived stats from attemptEvents/sessions. */
export interface AdminUserRow extends AdminUserProfile {
  totalAttempts: number;
  accuracyPct: number;
  streak: number;
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
  byRegion: RegionAccuracy[];
  weakestStructures: WeakStructureRow[];
}
