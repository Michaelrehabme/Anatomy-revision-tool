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
import { hasLiveSubscription, SUBSCRIPTION_STILL_RENEWS } from '../lib/subscriptionLiveness';

// The rule itself has no Firebase in it and lives where it can be tested
// without loading the SDK; re-exported so callers of this module are unchanged.
export { hasLiveSubscription, SUBSCRIPTION_STILL_RENEWS };

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
 *   questionReports, clientErrors,
 *   funnelEvents (userId == uid)       what the app reported under this uid
 *   cohorts/{id}/studentStats/{uid}    the summary an educator reads
 *   cohorts/{id}/members/{uid}         their entry on the class list
 *   invites (email == theirs)          invitations addressed to them
 *   cohorts they OWN                   the class, its list, summaries,
 *                                      assignments, invites and join code:
 *                                      the class goes with its educator
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
  'diagnostics',
  // An educator's saved assignment templates (educator/data/assignmentTemplatesRepository).
  'assignmentTemplates',
] as const;

/**
 * Top-level collections whose rows carry `userId` (feedback/data/telemetry.ts).
 * Exported and deleted with the account, like the answer log.
 */
const USER_REPORT_COLLECTIONS = ['questionReports', 'clientErrors', 'funnelEvents'] as const;

/** Firestore caps a batch at 500 writes; leave room rather than sail close. */
const BATCH_LIMIT = 400;

export interface AccountExport {
  exportedAt: string;
  uid: string;
  profile: Record<string, unknown> | null;
  attemptEvents: Record<string, unknown>[];
  cohortSummary: Record<string, unknown> | null;
  /** Their entry on their class's list: what the class owner sees of them as a person. */
  classListEntry: Record<string, unknown> | null;
  /** Invitations addressed to them that they have not answered. */
  invitesToYou: Record<string, unknown>[];
  /** Classes they run, with the invitations they sent for each. Their students' data is not theirs to export. */
  classesYouRun: Record<string, unknown>[];
  collections: Record<string, Record<string, unknown>[]>;
}

/** The signed-in account's email as invitations store it (invitesRepository: lower case). */
function ownEmail(uid: string): string | null {
  const user = getFirebaseAuth().currentUser;
  return user && user.uid === uid && user.email ? user.email.toLowerCase() : null;
}

async function invitesAddressedTo(db: Firestore, email: string | null) {
  if (!email) return [];
  return (await getDocs(query(collection(db, 'invites'), where('email', '==', email)))).docs;
}

async function cohortsOwnedBy(db: Firestore, uid: string) {
  return (await getDocs(query(collection(db, 'cohorts'), where('ownerUid', '==', uid)))).docs;
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
  for (const name of USER_REPORT_COLLECTIONS) {
    const rows = await getDocs(query(collection(db, name), where('userId', '==', uid)));
    collections[name] = rows.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  let cohortSummary: Record<string, unknown> | null = null;
  let classListEntry: Record<string, unknown> | null = null;
  if (cohortId) {
    const summary = await getDoc(doc(db, 'cohorts', cohortId, 'studentStats', uid));
    if (summary.exists()) cohortSummary = summary.data();
    const entry = await getDoc(doc(db, 'cohorts', cohortId, 'members', uid)).catch(() => null);
    if (entry?.exists()) classListEntry = entry.data();
  }

  const invitesToYou = (await invitesAddressedTo(db, ownEmail(uid))).map((d) => ({ id: d.id, ...d.data() }));
  const classesYouRun: Record<string, unknown>[] = [];
  for (const cohort of await cohortsOwnedBy(db, uid)) {
    const sent = await getDocs(query(collection(db, 'invites'), where('cohortId', '==', cohort.id)));
    classesYouRun.push({ id: cohort.id, ...cohort.data(), invitesSent: sent.docs.map((d) => ({ id: d.id, ...d.data() })) });
  }

  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    attemptEvents: attempts.docs.map((d) => ({ id: d.id, ...d.data() })),
    cohortSummary,
    classListEntry,
    invitesToYou,
    classesYouRun,
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
/** Firebase refuses to delete an Auth user signed in longer ago than this. */
const RECENT_SIGN_IN_MS = 5 * 60 * 1000;

function refusal(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

export async function deleteAccountData(
  uid: string,
  onProgress?: (progress: DeletionProgress) => void,
): Promise<void> {
  const db = getDb();
  const step = (s: string) => onProgress?.({ step: s });

  // BEFORE ANYTHING IS DELETED. Both refusals used to arrive too late: a
  // live subscription was never checked at all, and the recent-sign-in rule
  // only bit at the final step, after the profile and its entitlement were
  // already gone — leaving a paying student half-deleted and reading as free.
  const profileSnap = await getDoc(doc(db, 'users', uid));
  if (profileSnap.exists() && hasLiveSubscription(profileSnap.data().entitlement)) {
    throw refusal('subscription-active', SUBSCRIPTION_STILL_RENEWS);
  }
  const current: User | null = getFirebaseAuth().currentUser;
  // Anonymous accounts cannot sign in again, so the check would strand them;
  // they keep the old behaviour of finding out at the last step.
  if (current && current.uid === uid && !current.isAnonymous) {
    const { authTime } = await current.getIdTokenResult();
    if (Date.now() - Date.parse(authTime) > RECENT_SIGN_IN_MS) {
      throw refusal('auth/requires-recent-login', 'Please sign in again, then delete your account.');
    }
  }

  step('Removing you from your class');
  const cohortId = profileSnap.exists() && typeof profileSnap.data().cohort === 'string'
    ? (profileSnap.data().cohort as string)
    : null;
  if (cohortId) {
    await deleteDoc(doc(db, 'cohorts', cohortId, 'members', uid)).catch(() => {});
    await deleteDoc(doc(db, 'cohorts', cohortId, 'studentStats', uid)).catch(() => {
      // A summary that was never written is not an error.
    });
  }
  await deleteAll(db, (await invitesAddressedTo(db, ownEmail(uid))).map((d) => ({ path: d.ref.path })));

  // An educator's classes go with them. Everything under a class is removed
  // before the class itself, because the owner's right to remove it is read
  // from the class document (firestore.rules ownsCohort).
  const owned = await cohortsOwnedBy(db, uid);
  if (owned.length > 0) step('Removing the classes you run');
  for (const cohort of owned) {
    for (const sub of ['members', 'studentStats', 'confusionStats', 'assignments']) {
      const rows = await getDocs(collection(db, 'cohorts', cohort.id, sub));
      await deleteAll(db, rows.docs.map((d) => ({ path: d.ref.path })));
    }
    const sent = await getDocs(query(collection(db, 'invites'), where('cohortId', '==', cohort.id)));
    await deleteAll(db, sent.docs.map((d) => ({ path: d.ref.path })));
    const code = cohort.data().joinCode;
    if (typeof code === 'string' && code) await deleteDoc(doc(db, 'joinCodes', code)).catch(() => {});
    await deleteDoc(cohort.ref);
  }

  step('Deleting your answers');
  const attempts = await getDocs(query(collection(db, 'attemptEvents'), where('userId', '==', uid)));
  await deleteAll(db, attempts.docs.map((d) => ({ path: d.ref.path })));
  for (const name of USER_REPORT_COLLECTIONS) {
    const rows = await getDocs(query(collection(db, name), where('userId', '==', uid)));
    await deleteAll(db, rows.docs.map((d) => ({ path: d.ref.path })));
  }

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
