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
import type { UserAttempt, StructureMastery, FactMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';
import { filterStructures } from '../lib/indexes';
import { BUNDLED_CONTENT } from './content/bundledContent';
import { ALL_IMAGES } from './images';
import { attachHotspots } from './seed/hotspots';
import { rollUpAttemptDetached, syncStudentRollup } from '../../educator/data/cohortRollups';
import type { DiagnosticResult } from '../lib/diagnostic';
import { getDb, getFirebaseAuth } from './firebase';
import type { AchievementDoc } from '../lib/achievements';
import { factMasteryKey } from '../lib/factMastery';

/**
 * Firestore layout: top-level attemptEvents/{attemptId} (queryable by userId
 * or structureId for cross-user analytics — see firestore.indexes.json for
 * the composite indexes this requires), plus users/{uid}/mastery/{structureId},
 * users/{uid}/questionExposure/{questionId}, users/{uid}/sessions/{sessionId},
 * users/{uid}/factMastery/{structureId}__{promptKind} (CR-018 — covered by
 * the existing `match /users/{uid}/{document=**}` rule, and read whole with
 * no where/orderBy, so it needs neither a rules change nor a composite index),
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
/**
 * Firestore rejects any document containing an `undefined` field value, and
 * every one of our records has optional fields — a flashcard attempt carries
 * no confidence since CR-018 made learn cards ungraded, an exam answer
 * carries none either, and StructureMastery has no dueAt until it has been
 * scheduled. Dropping the keys entirely is the right shape anyway: absent
 * and "explicitly undefined" mean the same thing to every reader here.
 *
 * Found by running a real session against Firestore — the flashcard reveal
 * failed with "Unsupported field value: undefined (found in field
 * confidence)" and surfaced the persist-error banner on the very first card.
 */
function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * How many of a student's session summaries the cohort rollup is rebuilt
 * from — the figure the educator dashboard used to read per student.
 */
const ROLLUP_SESSION_LIMIT = 300;

export async function createFirestoreRepository(): Promise<AnatomyRepository> {
  const db = getDb();

  const listMasteryRows = async (userId: string) => {
    const snapshot = await getDocs(collection(db, 'users', userId, 'mastery'));
    return snapshot.docs.map((d) => d.data() as StructureMastery);
  };

  const listSummaries = async (userId: string, limitCount: number) => {
    const q = query(collection(db, 'users', userId, 'sessions'), orderBy('startedAt', 'desc'), fsLimit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as RevisionSessionSummary);
  };

  /** See educator/data/cohortRollups.ts syncStudentRollup. Never throws: a stale class chart is not worth an error. */
  const syncCohortRollup = async (userId: string) => {
    try {
      await syncStudentRollup(db, userId, getFirebaseAuth().currentUser?.displayName ?? null, async () => ({
        mastery: await listMasteryRows(userId),
        summaries: await listSummaries(userId, ROLLUP_SESSION_LIMIT),
        facts: (await getDocs(collection(db, 'users', userId, 'factMastery'))).docs.map((d) => d.data() as FactMastery),
      }));
    } catch {
      /* Rebuilt again after the next session or app open. */
    }
  };

  return {
    async listStructures(filter?: StructureFilter) {
      // The structures whose facts are IN THIS BUNDLE: all of them in a bundled
      // build, none in one that fetches facts per area. The app reads content
      // through hooks/useAnatomyContent, which knows the difference; this is
      // kept for the scripts and tests that want the bundled list as it is.
      return filterStructures([...BUNDLED_CONTENT.structures], filter);
    },

    async getStructure(id: string) {
      return BUNDLED_CONTENT.structures.find((s) => s.id === id) ?? null;
    },

    async listImageAssets(filter?: ImageAssetFilter) {
      // The polygons load separately from the images they belong to, and the
      // filter below reads them — see seed/hotspots.ts.
      await attachHotspots();
      return ALL_IMAGES.filter(
        (img) =>
          (!filter?.region || img.region === filter.region) &&
          (!filter?.mode || img.mode === filter.mode) &&
          (!filter?.structureId ||
            img.structureId === filter.structureId ||
            (img.hotspots ?? []).some((h) => h.structureId === filter.structureId)),
      );
    },

    /**
     * The attempt is the write that matters and is awaited; the cohort rollup
     * is not (CR-031). If a student is in a class, answering also increments
     * that class's aggregate counters — which is what an educator reads, so
     * that nobody needs read access to these rows. See educator/data/
     * cohortRollups.ts for why the counters exist and why they are counters.
     *
     * Detached on purpose: a dropped counter is a slightly wrong chart, a
     * thrown one is a lost answer.
     */
    async recordAttempt(attempt: UserAttempt) {
      await setDoc(doc(db, 'attemptEvents', attempt.id), omitUndefined(attempt));
      rollUpAttemptDetached(db, attempt, getFirebaseAuth().currentUser?.displayName ?? null);
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
      return listMasteryRows(userId);
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
      await setDoc(doc(db, 'users', mastery.userId, 'mastery', mastery.structureId), omitUndefined(mastery));
    },

    async listFactMastery(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'factMastery'));
      return snapshot.docs.map((d) => d.data() as FactMastery);
    },

    async upsertFactMastery(fact: FactMastery) {
      await setDoc(
        doc(db, 'users', fact.userId, 'factMastery', factMasteryKey(fact.structureId, fact.promptKind)),
        omitUndefined(fact),
      );
    },

    async saveDiagnosticResult(result: DiagnosticResult) {
      // Keyed by phase and timestamp: sortable, unique per sitting, and
      // readable in the console without a lookup.
      const id = `${result.phase}-${result.takenAt}`;
      await setDoc(doc(db, 'users', result.userId, 'diagnostics', id), omitUndefined(result));
    },

    async listDiagnosticResults(userId: string) {
      const snapshot = await getDocs(
        query(collection(db, 'users', userId, 'diagnostics'), orderBy('takenAt', 'asc')),
      );
      return snapshot.docs.map((d) => d.data() as DiagnosticResult);
    },

    /**
     * A finished session also rebuilds the student's cohort rollup — levels,
     * session totals, assignment scores — detached, like the per-answer
     * counters. It is what an educator reads instead of this summary.
     */
    async saveSessionSummary(summary: RevisionSessionSummary) {
      await setDoc(doc(db, 'users', summary.userId, 'sessions', summary.id), omitUndefined(summary));
      void syncCohortRollup(summary.userId);
    },

    async listSessionSummaries(userId: string, limitCount = 20) {
      return listSummaries(userId, limitCount);
    },

    syncCohortRollup,

    async getGamificationProfile(userId: string) {
      const snap = await getDoc(doc(db, 'users', userId, 'gamification', 'profile'));
      return snap.exists() ? (snap.data() as GamificationProfile) : INITIAL_GAMIFICATION_PROFILE;
    },

    async upsertGamificationProfile(userId: string, profile: GamificationProfile) {
      await setDoc(doc(db, 'users', userId, 'gamification', 'profile'), omitUndefined(profile));
    },

    async listAchievements(userId: string) {
      const snapshot = await getDocs(collection(db, 'users', userId, 'achievements'));
      return snapshot.docs.map((d) => d.data() as AchievementDoc);
    },

    async upsertAchievement(userId: string, achievement: AchievementDoc) {
      await setDoc(doc(db, 'users', userId, 'achievements', achievement.id), omitUndefined(achievement));
    },
  };
}
