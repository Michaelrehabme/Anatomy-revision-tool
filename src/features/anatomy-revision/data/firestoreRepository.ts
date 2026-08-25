import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit as fsLimit,
} from 'firebase/firestore';
import type { AnatomyRepository, ImageAssetFilter } from './repository';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { ALL_STRUCTURES, ALL_IMAGES } from './seed';
import { getDb } from './firebase';

/**
 * Firestore layout: users/{uid}/attempts/{attemptId}, users/{uid}/mastery/{structureId},
 * users/{uid}/sessions/{sessionId} — see project README for the matching
 * security rules (request.auth.uid == userId, paired with Anonymous Auth
 * from firebase.ts/AnonymousUserProvider).
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
      await setDoc(doc(db, 'users', attempt.userId, 'attempts', attempt.id), attempt);
    },

    async getMastery(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'mastery'));
      return snapshot.docs.map((d) => d.data() as StructureMastery);
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
  };
}
