import type { AnatomyRepository, ImageAssetFilter } from './repository';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { ALL_STRUCTURES, ALL_IMAGES } from './seed';

const STORAGE_PREFIX = 'anatomy-revision:v1:';
const ATTEMPTS_KEY = `${STORAGE_PREFIX}attempts`;
const MASTERY_KEY = `${STORAGE_PREFIX}mastery`;
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt/unavailable storage shouldn't crash a revision session — fall back to empty state.
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full/unavailable (private browsing etc.) — silently drop the write.
    // Content/questions still work; only history tracking degrades.
  }
}

const masteryKey = (userId: string, structureId: string) => `${userId}::${structureId}`;

/**
 * Default dev-mode persistence: everything lives in localStorage under this
 * device/browser. No backend required — good for local development and for
 * running the app without a Firebase project configured. Content
 * (structures/images) still comes from the static seed modules, matching
 * firestoreRepository's read-only content contract.
 */
export function createLocalRepository(): AnatomyRepository {
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
      const attempts = readJson<UserAttempt[]>(ATTEMPTS_KEY, []);
      attempts.push(attempt);
      writeJson(ATTEMPTS_KEY, attempts);
    },

    async getMastery(userId: string) {
      const mastery = readJson<Record<string, StructureMastery>>(MASTERY_KEY, {});
      return Object.values(mastery).filter((m) => m.userId === userId);
    },

    async upsertMastery(mastery: StructureMastery) {
      const all = readJson<Record<string, StructureMastery>>(MASTERY_KEY, {});
      all[masteryKey(mastery.userId, mastery.structureId)] = mastery;
      writeJson(MASTERY_KEY, all);
    },

    async saveSessionSummary(summary: RevisionSessionSummary) {
      const sessions = readJson<RevisionSessionSummary[]>(SESSIONS_KEY, []);
      sessions.push(summary);
      writeJson(SESSIONS_KEY, sessions);
    },

    async listSessionSummaries(userId: string, limit = 20) {
      const sessions = readJson<RevisionSessionSummary[]>(SESSIONS_KEY, []);
      return sessions
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },
  };
}
