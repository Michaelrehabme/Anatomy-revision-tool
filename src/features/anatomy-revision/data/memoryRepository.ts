import type { AnatomyRepository, AttemptFilter, ImageAssetFilter, GamificationProfile } from './repository';
import { INITIAL_GAMIFICATION_PROFILE } from './repository';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { ALL_STRUCTURES, ALL_IMAGES } from './seed';
import type { AchievementDoc } from '../lib/achievements';

/**
 * Pure in-memory implementation — no localStorage, no Firestore. Used by
 * unit tests and anywhere a fresh, isolated repository instance is needed
 * without touching browser storage.
 */
export function createMemoryRepository(): AnatomyRepository {
  const attempts: UserAttempt[] = [];
  const exposureByKey = new Map<string, number>();
  const masteryByKey = new Map<string, StructureMastery>();
  const sessions: RevisionSessionSummary[] = [];
  const gamificationByUser = new Map<string, GamificationProfile>();
  const achievementsByUser = new Map<string, Map<string, AchievementDoc>>();

  const masteryKey = (userId: string, structureId: string) => `${userId}::${structureId}`;
  const exposureKey = (userId: string, questionId: string) => `${userId}::${questionId}`;

  return {
    async listStructures(filter?: StructureFilter) {
      return filterStructures(ALL_STRUCTURES, filter);
    },

    async getStructure(id: string) {
      return ALL_STRUCTURES.find((s) => s.id === id) ?? null;
    },

    async listImageAssets(filter?: ImageAssetFilter) {
      return ALL_IMAGES.filter(
        (img) =>
          (!filter?.region || img.region === filter.region) &&
          (!filter?.mode || img.mode === filter.mode) &&
          (!filter?.structureId ||
            img.structureId === filter.structureId ||
            (img.hotspots ?? []).some((h) => h.structureId === filter.structureId)),
      );
    },

    async recordAttempt(attempt: UserAttempt) {
      attempts.push(attempt);
    },

    async listAttempts(filter: AttemptFilter) {
      const results = attempts
        .filter(
          (a) =>
            (!filter.userId || a.userId === filter.userId) &&
            (!filter.structureId || a.structureId === filter.structureId) &&
            (!filter.questionId || a.questionId === filter.questionId) &&
            (!filter.since || a.timestamp >= filter.since),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filter.limit !== undefined ? results.slice(0, filter.limit) : results;
    },

    async recordQuestionExposure(userId: string, questionId: string) {
      const key = exposureKey(userId, questionId);
      const next = (exposureByKey.get(key) ?? 0) + 1;
      exposureByKey.set(key, next);
      return next;
    },

    async getMastery(userId: string) {
      return [...masteryByKey.values()].filter((m) => m.userId === userId);
    },

    async getMasteryForStructure(userId: string, structureId: string) {
      return masteryByKey.get(masteryKey(userId, structureId)) ?? null;
    },

    async listMastery(userId: string) {
      return [...masteryByKey.values()].filter((m) => m.userId === userId);
    },

    async listDueMastery(userId: string, before: string) {
      return [...masteryByKey.values()]
        .filter((m) => m.userId === userId && m.dueAt !== undefined && m.dueAt <= before)
        .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
    },

    async upsertMastery(mastery: StructureMastery) {
      masteryByKey.set(masteryKey(mastery.userId, mastery.structureId), mastery);
    },

    async saveSessionSummary(summary: RevisionSessionSummary) {
      sessions.push(summary);
    },

    async listSessionSummaries(userId: string, limit = 20) {
      return sessions
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },

    async getGamificationProfile(userId: string) {
      return gamificationByUser.get(userId) ?? INITIAL_GAMIFICATION_PROFILE;
    },

    async upsertGamificationProfile(userId: string, profile: GamificationProfile) {
      gamificationByUser.set(userId, profile);
    },

    async listAchievements(userId: string) {
      return [...(achievementsByUser.get(userId)?.values() ?? [])];
    },

    async upsertAchievement(userId: string, achievement: AchievementDoc) {
      const forUser = achievementsByUser.get(userId) ?? new Map<string, AchievementDoc>();
      forUser.set(achievement.id, achievement);
      achievementsByUser.set(userId, forUser);
    },
  };
}
