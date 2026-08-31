import type { AnatomyStructure } from '../types/structure';
import type { AnatomyImageAsset } from '../types/image';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import type { AchievementDoc } from '../lib/achievements';
import { type StreakFreezeState, INITIAL_STREAK_FREEZE_STATE } from '../lib/streakFreeze';
import type { QuestionType } from '../types/question';

/** Per-user XP/streak-freeze state — CR-008. Kept separate from the users/{uid} auth profile doc (see firebase.ts's touchUserProfile), which is auth-layer, not repository-layer. */
export interface GamificationProfile {
  xpTotal: number;
  /** Day-key (YYYY-MM-DD) the xpToday counter applies to — reset when a new day is first seen. */
  xpTodayDayKey: string;
  xpToday: number;
  streakFreeze: StreakFreezeState;
  /** Cumulative set of question types ever answered — cheaper to maintain incrementally here than to scan the full attemptEvents history for the "every angle" milestone. */
  questionTypesUsedEver: QuestionType[];
}

export const INITIAL_GAMIFICATION_PROFILE: GamificationProfile = {
  xpTotal: 0,
  xpTodayDayKey: '',
  xpToday: 0,
  streakFreeze: INITIAL_STREAK_FREEZE_STATE,
  questionTypesUsedEver: [],
};

export interface ImageAssetFilter {
  region?: AnatomyImageAsset['region'];
  mode?: AnatomyImageAsset['mode'];
  structureId?: string;
}

export interface AttemptFilter {
  userId?: string;
  structureId?: string;
  questionId?: string;
  /** ISO timestamp — only attempts at or after this instant. */
  since?: string;
  limit?: number;
}

/**
 * Anatomy content (structures/images) is intentionally read-only here and
 * always resolves from the static seed modules — see data/seed/index.ts.
 * Only user-generated data (attempts, mastery, session summaries) is
 * actually persisted per-implementation; that's the boundary this interface
 * exists to enforce, so swapping local <-> Firestore never touches content.
 */
export interface AnatomyRepository {
  listStructures(filter?: StructureFilter): Promise<AnatomyStructure[]>;
  getStructure(id: string): Promise<AnatomyStructure | null>;
  listImageAssets(filter?: ImageAssetFilter): Promise<AnatomyImageAsset[]>;

  /** Appends one attempt event. attemptEvents is an append-only log — nothing ever updates or deletes a row. */
  recordAttempt(attempt: UserAttempt): Promise<void>;
  /** Cross-user analytics query over attemptEvents — the reason attempts live in a top-level collection, not a per-user subcollection. */
  listAttempts(filter: AttemptFilter): Promise<UserAttempt[]>;
  /**
   * Increments and returns this user's exposure count for a question ID —
   * the returned value becomes attemptNumber on the resulting UserAttempt.
   * Backed by a lightweight users/{uid}/questionExposure/{questionId}
   * counter doc rather than folding a count into StructureMastery: many
   * questionIds share one structureId, so per-question counts would need
   * either an unbounded map on the mastery doc (write contention with its
   * SM-2 scheduling updates) or one mastery doc per question (breaking its
   * per-structure meaning). A dedicated counter also works for every
   * question type, not just the ones that carry a confidence rating.
   */
  recordQuestionExposure(userId: string, questionId: string): Promise<number>;
  getMastery(userId: string): Promise<StructureMastery[]>;
  /** Single-structure mastery read — avoids fetching the entire mastery subcollection just to find one row. */
  getMasteryForStructure(userId: string, structureId: string): Promise<StructureMastery | null>;
  upsertMastery(mastery: StructureMastery): Promise<void>;
  /** Every mastery row for a user — same data as getMastery, named for the Today/Progress screens' use case. */
  listMastery(userId: string): Promise<StructureMastery[]>;
  /** Mastery rows with dueAt <= before (ISO), sorted soonest-due first. Powers the Today screen's due queue. */
  listDueMastery(userId: string, before: string): Promise<StructureMastery[]>;

  saveSessionSummary(summary: RevisionSessionSummary): Promise<void>;
  listSessionSummaries(userId: string, limit?: number): Promise<RevisionSessionSummary[]>;

  /** Never null — an unset profile reads back as INITIAL_GAMIFICATION_PROFILE. */
  getGamificationProfile(userId: string): Promise<GamificationProfile>;
  upsertGamificationProfile(userId: string, profile: GamificationProfile): Promise<void>;
  listAchievements(userId: string): Promise<AchievementDoc[]>;
  /** Achievement docs are keyed by their own id (one row per achievement, updated in place as records improve). */
  upsertAchievement(userId: string, achievement: AchievementDoc): Promise<void>;
}

export type PersistenceMode = 'local' | 'firestore';

let cached: AnatomyRepository | null = null;

/**
 * Factory: selects the repository implementation from VITE_PERSISTENCE
 * (default "local"). Firestore's SDK is only imported when actually
 * selected, so a "local" dev loop never pays for it.
 */
export async function getRepository(): Promise<AnatomyRepository> {
  if (cached) return cached;

  const mode: PersistenceMode = (import.meta.env.VITE_PERSISTENCE as PersistenceMode) ?? 'local';

  if (mode === 'firestore') {
    const { createFirestoreRepository } = await import('./firestoreRepository');
    cached = await createFirestoreRepository();
  } else {
    const { createLocalRepository } = await import('./localRepository');
    cached = createLocalRepository();
  }

  return cached;
}

/** Test/story helper — bypasses the env-based factory entirely. */
export function resetRepositoryCache(): void {
  cached = null;
}
