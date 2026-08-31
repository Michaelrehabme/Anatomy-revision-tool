import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit as fsLimit,
  runTransaction,
  type QueryConstraint,
} from 'firebase/firestore';
import type { AnatomyRepository, AttemptFilter, ImageAssetFilter, GamificationProfile } from './repository';
import { INITIAL_GAMIFICATION_PROFILE } from './repository';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { ALL_STRUCTURES, ALL_IMAGES } from './seed';
import { getDb } from './firebase';
import type { AchievementDoc } from '../lib/achievements';

/**
 * Firestore layout: top-level attemptEvents/{attemptId} (queryable by userId
 * or structureId for cross-user analytics — see firestore.indexes.json for
 * the composite indexes this requires), plus users/{uid}/mastery/{structureId},
 * users/{uid}/questionExposure/{questionId}, users/{uid}/sessions/{sessionId},
 * users/{uid}/gamification/profile (single doc: XP totals, streak-freeze
 * state — CR-008), users/{uid}/achievements/{achievementId} — see
 * firestore.rules at the repo root for the matching security rules, paired
 * with the auth lifecycle in firebase.ts/AuthProvider.
 *
 * attemptEvents intentionally sits outside users/{uid}: Firestore has no
 * cross-subcollection query, so a per-user attempts subcollection can never
 * answer "how did all users do on structure X" — only a top-level collection
 * with userId as a plain field can.
 *
 * Content (structures/images) is NOT read from Firestore — same static seed
 * modules as localRepository, keeping the read-only content contract
 * identical across both implementations.
 */
export async function createFirestoreRepository(): Promise<AnatomyRepository> {
  const db = getDb();

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
      await setDoc(doc(db, 'attemptEvents', attempt.id), attempt);
    },

    /**
     * Supports two indexed query shapes — filter by userId or by
     * structureId, each ordered by timestamp desc (see
     * firestore.indexes.json). Only one of those two equality filters can
     * be pushed to Firestore at once without a further composite index, so
     * when both (or questionId) are given, the non-primary filters are
     * applied client-side after the primary indexed fetch. `since` rides
     * on the same composite index because it's a range filter on the same
     * field (timestamp) as the orderBy.
     */
    async listAttempts(filter: AttemptFilter) {
      const constraints: QueryConstraint[] = [];
      const primaryIsUserId = !!filter.userId;
      const primaryIsStructureId = !primaryIsUserId && !!filter.structureId;

      if (primaryIsUserId) {
        constraints.push(where('userId', '==', filter.userId));
      } else if (primaryIsStructureId) {
        constraints.push(where('structureId', '==', filter.structureId));
      }
      if (filter.since) {
        constraints.push(where('timestamp', '>=', filter.since));
      }
      constraints.push(orderBy('timestamp', 'desc'));

      const snapshot = await getDocs(query(collection(db, 'attemptEvents'), ...constraints));
      let results = snapshot.docs.map((d) => d.data() as UserAttempt);

      if (!primaryIsUserId && filter.userId) {
        results = results.filter((a) => a.userId === filter.userId);
      }
      if (!primaryIsStructureId && filter.structureId) {
        results = results.filter((a) => a.structureId === filter.structureId);
      }
      if (filter.questionId) {
        results = results.filter((a) => a.questionId === filter.questionId);
      }

      return filter.limit !== undefined ? results.slice(0, filter.limit) : results;
    },

    async recordQuestionExposure(userId: string, questionId: string) {
      const ref = doc(db, 'users', userId, 'questionExposure', questionId);
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const count = ((snap.data()?.count as number | undefined) ?? 0) + 1;
        tx.set(ref, { count });
        return count;
      });
    },

    async getMastery(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'mastery'));
      return snapshot.docs.map((d) => d.data() as StructureMastery);
    },

    async getMasteryForStructure(userId: string, structureId: string) {
      const snap = await getDoc(doc(db, 'users', userId, 'mastery', structureId));
      return snap.exists() ? (snap.data() as StructureMastery) : null;
    },

    async listMastery(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'mastery'));
      return snapshot.docs.map((d) => d.data() as StructureMastery);
    },

    /**
     * Requires a composite index on the users/{uid}/mastery subcollection
     * (dueAt ASC, filtered by equality isn't needed — the collection is
     * already scoped to the user by path) — create it in the Firebase
     * console (or via the link in the error the first time this runs)
     * before relying on this in a deployed Firestore-backed environment.
     */
    async listDueMastery(userId: string, before: string) {
      const q = query(
        collection(db, 'users', userId, 'mastery'),
        where('dueAt', '<=', before),
        orderBy('dueAt', 'asc'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data() as StructureMastery);
    },

    async upsertMastery(mastery: StructureMastery) {
      await setDoc(doc(db, 'users', mastery.userId, 'mastery', mastery.structureId), mastery);
    },

    async saveSessionSummary(summary: RevisionSessionSummary) {
      await setDoc(doc(db, 'users', summary.userId, 'sessions', summary.id), summary);
    },

    async listSessionSummaries(userId: string, limitCount = 20) {
      const q = query(
        collection(db, 'users', userId, 'sessions'),
        orderBy('startedAt', 'desc'),
        fsLimit(limitCount),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.data() as RevisionSessionSummary);
    },

    async getGamificationProfile(userId: string) {
      const snap = await getDoc(doc(db, 'users', userId, 'gamification', 'profile'));
      return snap.exists() ? (snap.data() as GamificationProfile) : INITIAL_GAMIFICATION_PROFILE;
    },

    async upsertGamificationProfile(userId: string, profile: GamificationProfile) {
      await setDoc(doc(db, 'users', userId, 'gamification', 'profile'), profile);
    },

    async listAchievements(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'achievements'));
      return snapshot.docs.map((d) => d.data() as AchievementDoc);
    },

    async upsertAchievement(userId: string, achievement: AchievementDoc) {
      await setDoc(doc(db, 'users', userId, 'achievements', achievement.id), achievement);
    },
  };
}
