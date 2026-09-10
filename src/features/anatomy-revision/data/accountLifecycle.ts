import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { deleteUser, type User } from 'firebase/auth';
import { getDb, getFirebaseAuth } from './firebase';

/**
 * Account export and erasure (CR-025 items 3 and 4).
 *
 * The privacy policy says "delete your account at any time" and offers a
 * portable copy of your data. Until this existed, neither was true: the only
 * route was emailing the controller, which is a lawful answer to a rights
 * request and a poor one to give a university's data protection officer.
 *
 * EVERY PLACE A PERSON'S DATA LIVES. Missing one is the failure that matters,
 * because it leaves a policy claiming erasure that did not erase:
 *
 *   users/{uid}                        profile: email, display name, cohort
 *   users/{uid}/mastery                per-structure scheduling state
 *   users/{uid}/factMastery            per-fact recall state
 *   users/{uid}/sessions               session summaries
 *   users/{uid}/achievements           earned badges
 *   users/{uid}/gamification           XP, streak, freezes
 *   users/{uid}/questionExposure       per-question exposure counters
 *   attemptEvents (userId == uid)      the answer log, top-level
 *   cohorts/{id}/studentStats/{uid}    the summary an educator reads
 *   roles/{uid}                        admin grant, if any
 *   Firebase Auth user                 the identity itself
 *
 * WHAT IS DELIBERATELY NOT DELETED. cohorts/{id}/confusionStats holds counts
 * of "answered X when the answer was Y" with no uid, no timestamp and no row
 * per person — it is the anonymous aggregate CR-031 introduced precisely so
 * an educator never reads individual answers. There is nothing in it to
 * identify anyone and therefore nothing erasure requires removing, and it
 * cannot be decremented per-student anyway because nothing records whose
 * answers made up a count.
 */

/** Subcollections under users/{uid}. Adding one here is the only change a new subcollection needs. */
const USER_SUBCOLLECTIONS = [
  'mastery',
  'factMastery',
  'sessions',
  'achievements',
  'gamification',
  'questionExposure',
] as const;

/** Firestore caps a batch at 500 writes; leave room rather than sail close. */
const BATCH_LIMIT = 400;

export interface AccountExport {
  exportedAt: string;
  uid: string;
  profile: Record<string, unknown> | null;
  attemptEvents: Record<string, unknown>[];
  cohortSummary: Record<string, unknown> | null;
  collections: Record<string, Record<string, unknown>[]>;
}

async function readCollection(db: Firestore, uid: string, name: string): Promise<Record<string, unknown>[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, name));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Everything held about one person, as JSON.
 *
 * Read with the user's own credentials, so it can only ever return their own
 * data — the same rules that stop them reading anyone else's apply here, and
 * an export that ran with elevated rights would be a far more dangerous thing
 * to have in the codebase.
 */
export async function exportAccountData(uid: string): Promise<AccountExport> {
  const db = getDb();

  const profileSnap = await getDoc(doc(db, 'users', uid));
  const profile = profileSnap.exists() ? profileSnap.data() : null;
  const cohortId = typeof profile?.cohort === 'string' ? profile.cohort : null;

  const collections: Record<string, Record<string, unknown>[]> = {};
  for (const name of USER_SUBCOLLECTIONS) {
    collections[name] = await readCollection(db, uid, name);
  }

  const attempts = await getDocs(query(collection(db, 'attemptEvents'), where('userId', '==', uid)));

  let cohortSummary: Record<string, unknown> | null = null;
  if (cohortId) {
    const summary = await getDoc(doc(db, 'cohorts', cohortId, 'studentStats', uid));
    if (summary.exists()) cohortSummary = summary.data();
  }

  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    attemptEvents: attempts.docs.map((d) => ({ id: d.id, ...d.data() })),
    cohortSummary,
    collections,
  };
}

async function deleteAll(db: Firestore, refs: { path: string }[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(doc(db, ref.path));
    await batch.commit();
  }
}

export interface DeletionProgress {
  /** What is being removed, for a UI that should not look frozen while a term of attempts goes. */
  step: string;
}

/**
 * Erases the account and everything belonging to it.
 *
 * ORDER IS LOAD-BEARING, because the rules that permit each delete depend on
 * data this function is in the middle of destroying:
 *
 *   1. studentStats first. Writing it requires being a member of the cohort,
 *      and membership is read from users/{uid}.cohort — delete the profile
 *      first and the student loses permission to remove the very document
 *      their educator can see.
 *   2. attemptEvents, subcollections, then the profile. Once the profile is
 *      gone cohortOfUser() returns nothing, so educator visibility stops even
 *      if a later step fails.
 *   3. The Auth user last. It is the credential every preceding step
 *      authenticates with; delete it first and the rest becomes impossible.
 *
 * NOT ATOMIC, and it cannot be without Cloud Functions, which need a billing
 * account this project does not have (the same constraint that shaped
 * CR-031). A failure part-way leaves less data than before, never more, and
 * re-running finishes the job — every step is a delete, so all of them are
 * idempotent. The ordering above is what makes a partial failure safe rather
 * than merely survivable: visibility to an educator is revoked in the first
 * two steps, before anything slow happens.
 */
export async function deleteAccountData(
  uid: string,
  onProgress?: (progress: DeletionProgress) => void,
): Promise<void> {
  const db = getDb();
  const step = (s: string) => onProgress?.({ step: s });

  step('Removing you from your class');
  const profileSnap = await getDoc(doc(db, 'users', uid));
  const cohortId = profileSnap.exists() && typeof profileSnap.data().cohort === 'string'
    ? (profileSnap.data().cohort as string)
    : null;
  if (cohortId) {
    await deleteDoc(doc(db, 'cohorts', cohortId, 'studentStats', uid)).catch(() => {
      // A summary that was never written is not an error.
    });
  }

  step('Deleting your answers');
  const attempts = await getDocs(query(collection(db, 'attemptEvents'), where('userId', '==', uid)));
  await deleteAll(db, attempts.docs.map((d) => ({ path: d.ref.path })));

  step('Deleting your progress');
  for (const name of USER_SUBCOLLECTIONS) {
    const snapshot = await getDocs(collection(db, 'users', uid, name));
    await deleteAll(db, snapshot.docs.map((d) => ({ path: d.ref.path })));
  }

  step('Deleting your profile');
  await deleteDoc(doc(db, 'users', uid));
  // Only an admin can write roles/{uid}, so this succeeds exactly when the
  // account being deleted is an admin's own — and is a no-op otherwise.
  await deleteDoc(doc(db, 'roles', uid)).catch(() => {});

  step('Closing your account');
  const user: User | null = getFirebaseAuth().currentUser;
  if (user && user.uid === uid) await deleteUser(user);
}
