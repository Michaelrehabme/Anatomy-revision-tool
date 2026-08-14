import type { AnatomyRepository, ImageAssetFilter } from './repository';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { ALL_STRUCTURES, ALL_IMAGES } from './seed';

/**
 * Pure in-memory implementation — no localStorage, no Firestore. Used by
 * unit tests and anywhere a fresh, isolated repository instance is needed
 * without touching browser storage.
 */
export function createMemoryRepository(): AnatomyRepository {
  const attempts: UserAttempt[] = [];
  const masteryByKey = new Map<string, StructureMastery>();
  const sessions: RevisionSessionSummary[] = [];

  const masteryKey = (userId: string, structureId: string) => `${userId}::${structureId}`;

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

    async getMastery(userId: string) {
      return [...masteryByKey.values()].filter((m) => m.userId === userId);
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
  };
}
