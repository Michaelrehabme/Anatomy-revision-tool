/**
 * THE LIVE BUNDLE, AGAINST THESE RULES.
 *
 * The rules on this branch are stricter than the ones in production in two
 * places: a guest may no longer hold a free area, and creating a class needs
 * full access. Rules deploy in an instant; the app does not — an installed
 * copy keeps the bundle it has until the student accepts the update prompt,
 * which can be days. So for days the OLD client talks to the NEW rules, and
 * what matters is whether anything it does is now refused.
 *
 * This file replays the writes the live code makes (commit 581dfe1, what
 * production served on 6 Oct 2026), document for document and field for
 * field, as the people who make them: a guest, a guest who then creates an
 * account, a student in a class, a paying educator, and a free account that
 * tries to create a class. Each write is named for the function in the live
 * code that makes it.
 *
 * THE FINDING, which docs/CONTENT-SERVER-STATUS.md's rollout order rests on:
 * the live client never writes users/{uid}.freeArea (it keeps the free area
 * on the device), so nothing a guest or a student does on the old bundle is
 * refused. The one thing that is refused is a FREE account creating a class,
 * which is the rule being introduced; the old screen shows it as "Could not
 * allocate a join code. Please try again."
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const COHORT = 'class-live';
const CODE = 'LIVE42';
const NOW = () => new Date().toISOString();

const ANONYMOUS = { firebase: { sign_in_provider: 'anonymous', identities: {} } };
const guest = (uid = 'g1') => env.authenticatedContext(uid, ANONYMOUS).firestore();
const account = (uid: string, email = `${uid}@uni.ac.uk`) =>
  env.authenticatedContext(uid, { email, email_verified: false, firebase: { sign_in_provider: 'password', identities: {} } }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-locusmsk-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // A class that exists today, owned by an educator who subscribes.
    await setDoc(doc(db, 'users', 'paidEducator'), {
      uid: 'paidEducator', displayName: 'Pat', email: 'pat@uni.ac.uk', isAnonymous: false, cohort: null,
      entitlement: { tier: 'individual', source: 'paddle', expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(), interval: 'month', externalId: 'sub_1' },
    });
    await setDoc(doc(db, 'cohorts', COHORT), {
      id: COHORT, name: 'Y1 Sports Therapy', institution: '', ownerUid: 'paidEducator', joinCode: CODE, createdAt: NOW(), archivedAt: null,
    });
    await setDoc(doc(db, 'joinCodes', CODE), { cohortId: COHORT, ownerUid: 'paidEducator', createdAt: NOW() });
  });
});

// ---- The live code's writes, as it makes them --------------------------------

/** data/firebase.ts touchUserProfile: create on first sight, merge after. */
async function touchUserProfile(db: Firestore, uid: string, who: { email: string | null; isAnonymous: boolean; displayName?: string | null }) {
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  const fields = { uid, displayName: who.displayName ?? null, email: who.email, isAnonymous: who.isAnonymous, lastActiveAt: serverTimestamp() };
  if (snapshot.exists()) await setDoc(ref, fields, { merge: true });
  else await setDoc(ref, { ...fields, createdAt: serverTimestamp(), cohort: null });
}

/** One answered question, as data/firestoreRepository.ts records it. */
async function answerAQuestion(db: Firestore, uid: string, n: number) {
  const attempt = {
    id: `${uid}-attempt-${n}`, userId: uid, questionId: `mcq-deltoid-nerve`, structureId: 'deltoid', promptKind: 'nerve',
    correct: n % 2 === 0, selectedAnswer: 'Axillary nerve', timestamp: NOW(), durationMs: 4200, sessionId: `${uid}-s1`,
  };
  await setDoc(doc(db, 'attemptEvents', attempt.id), attempt); // recordAttempt
  await runTransaction(db, async (tx) => { // recordQuestionExposure
    const ref = doc(db, 'users', uid, 'questionExposure', attempt.questionId);
    const snap = await tx.get(ref);
    tx.set(ref, { count: ((snap.data()?.count as number | undefined) ?? 0) + 1 });
  });
  await setDoc(doc(db, 'users', uid, 'mastery', 'deltoid'), { userId: uid, structureId: 'deltoid', level: 1, dueAt: NOW() }); // upsertMastery
  await setDoc(doc(db, 'users', uid, 'factMastery', 'deltoid__nerve'), { userId: uid, structureId: 'deltoid', promptKind: 'nerve', streak: 1 }); // upsertFactMastery
}

/** The end of a session. */
async function finishASession(db: Firestore, uid: string) {
  await setDoc(doc(db, 'users', uid, 'sessions', `${uid}-s1`), {
    id: `${uid}-s1`, userId: uid, startedAt: NOW(), finishedAt: NOW(), totalQuestions: 8, correct: 5, missedStructureIds: ['deltoid'],
  }); // saveSessionSummary
  await setDoc(doc(db, 'users', uid, 'gamification', 'profile'), { xpTotal: 80, streak: 1 }); // saveGamificationProfile
  await setDoc(doc(db, 'users', uid, 'achievements', 'first-session'), { id: 'first-session', earnedAt: NOW() }); // saveAchievement
}

/** educator/data/cohortsRepository.ts joinCohortByCode. */
async function joinCohortByCode(db: Firestore, uid: string) {
  const code = await getDoc(doc(db, 'joinCodes', CODE));
  const cohort = await getDoc(doc(db, 'cohorts', code.data()!.cohortId as string));
  await setDoc(
    doc(db, 'users', uid),
    { cohort: cohort.id, cohortJoinedAt: NOW(), cohortJoinCode: cohort.data()!.joinCode, cohortInviteId: deleteField() },
    { merge: true },
  );
}

/** educator/data/cohortRollups.ts: the counters a member's device writes per answer, and their summary. */
async function writeRollups(db: Firestore, uid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'cohorts', COHORT, 'confusionStats', 'deltoid__supraspinatus'), { a: 'deltoid', b: 'supraspinatus', count: increment(1) }, { merge: true });
  batch.set(
    doc(db, 'cohorts', COHORT, 'studentStats', uid),
    { uid, attemptsTotal: increment(1), gradedTotal: increment(1), gradedCorrect: increment(1), 'structures.deltoid.attempts': increment(1) },
    { merge: true },
  );
  await batch.commit();
  await setDoc(
    doc(db, 'cohorts', COHORT, 'studentStats', uid),
    { uid, displayName: null, rollup: { levels: {}, sessions: 1 }, rollupAt: serverTimestamp() },
    { mergeFields: ['uid', 'displayName', 'rollup', 'rollupAt'] },
  ); // syncStudentRollup
}

/** The version-1 diagnostic the live site sets: a class's own paper, no paper id. */
async function sitTheBaseline(db: Firestore, uid: string) {
  const takenAt = NOW();
  await setDoc(doc(db, 'users', uid, 'diagnostics', `baseline-${takenAt}`), {
    userId: uid, cohortId: COHORT, version: 1, phase: 'baseline', correct: 6, total: 15, takenAt, durationMs: 300000,
    questionIds: ['mcq-deltoid-nerve', 'mcq-popliteus-action'],
  });
}

/** educator/data/cohortsRepository.ts createCohort: claim a code, then write the class. */
async function createCohort(db: Firestore, ownerUid: string, id: string, code: string) {
  await setDoc(doc(db, 'joinCodes', code), { cohortId: id, ownerUid, createdAt: NOW() });
  await setDoc(doc(db, 'cohorts', id), { id, name: 'New class', institution: '', ownerUid, joinCode: code, createdAt: NOW(), archivedAt: null });
}

// -----------------------------------------------------------------------------

describe('an existing guest on the live bundle, once these rules are deployed', () => {
  it('can still open the app: the profile write on every load goes through, first time and after', async () => {
    const db = guest();
    await assertSucceeds(touchUserProfile(db, 'g1', { email: null, isAnonymous: true }));
    await assertSucceeds(touchUserProfile(db, 'g1', { email: null, isAnonymous: true }));
    // It reads its own entitlement on load, and finds none.
    expect((await getDoc(doc(db, 'users', 'g1'))).data()?.entitlement).toBeUndefined();
  });

  it('can still study and have every answer saved', async () => {
    const db = guest();
    await touchUserProfile(db, 'g1', { email: null, isAnonymous: true });
    for (let n = 0; n < 3; n++) await assertSucceeds(answerAQuestion(db, 'g1', n));
    await assertSucceeds(finishASession(db, 'g1'));
    // …and read back on the next load.
    await assertSucceeds(getDocs(collection(db, 'users', 'g1', 'mastery')));
    await assertSucceeds(getDocs(query(collection(db, 'attemptEvents'), where('userId', '==', 'g1'))));
    expect((await getDoc(doc(db, 'users', 'g1', 'questionExposure', 'mcq-deltoid-nerve'))).data()?.count).toBe(3);
  });

  it('can still join a class by its code, write the class counters, sit the baseline, and leave', async () => {
    const db = guest();
    await touchUserProfile(db, 'g1', { email: null, isAnonymous: true });
    await assertSucceeds(joinCohortByCode(db, 'g1'));
    await assertSucceeds(writeRollups(db, 'g1'));
    await assertSucceeds(sitTheBaseline(db, 'g1'));
    await assertSucceeds(
      setDoc(doc(db, 'users', 'g1'), { cohort: null, cohortJoinedAt: deleteField(), cohortJoinCode: deleteField(), cohortInviteId: deleteField() }, { merge: true }),
    ); // leaveCohort
  });

  it('can still create an account from the old screen, and carries on as that account', async () => {
    await touchUserProfile(guest(), 'g1', { email: null, isAnonymous: true });
    await answerAQuestion(guest(), 'g1', 0);
    // Linking keeps the uid; the old screen then needs a reload to notice,
    // and the next load writes the profile as an account.
    const db = account('g1');
    await assertSucceeds(touchUserProfile(db, 'g1', { email: 'g1@uni.ac.uk', isAnonymous: false }));
    await assertSucceeds(answerAQuestion(db, 'g1', 1));
    expect((await getDoc(doc(db, 'users', 'g1', 'mastery', 'deltoid'))).exists()).toBe(true);
  });

  // The live client keeps the free area on the device and writes nothing
  // about it. This is the write it does NOT make, shown refused, so that the
  // sentence "old clients are unaffected" has something under it: had the
  // live client written this as a guest, every guest would now see an error.
  it('never writes a free area, which is the one guest write these rules now refuse', async () => {
    const db = guest();
    await touchUserProfile(db, 'g1', { email: null, isAnonymous: true });
    await assertFails(setDoc(doc(db, 'users', 'g1'), { freeArea: { area: 'knee', chosenAt: serverTimestamp(), switches: 0 } }, { merge: true }));
    expect((await getDoc(doc(db, 'users', 'g1'))).data()?.freeArea).toBeUndefined();
  });
});

describe('a signed-in student on the live bundle', () => {
  it('writes everything it wrote before, in and out of a class', async () => {
    const db = account('s1');
    await assertSucceeds(touchUserProfile(db, 's1', { email: 's1@uni.ac.uk', isAnonymous: false, displayName: 'Sam' }));
    await assertSucceeds(answerAQuestion(db, 's1', 0));
    await assertSucceeds(finishASession(db, 's1'));
    await assertSucceeds(joinCohortByCode(db, 's1'));
    await assertSucceeds(writeRollups(db, 's1'));
    await assertSucceeds(sitTheBaseline(db, 's1'));
    await assertSucceeds(getDocs(collection(db, 'cohorts', COHORT, 'assignments')));
  });

  it('can still delete their account', async () => {
    const db = account('s1');
    await touchUserProfile(db, 's1', { email: 's1@uni.ac.uk', isAnonymous: false });
    await answerAQuestion(db, 's1', 0);
    await assertSucceeds(deleteDoc(doc(db, 'users', 's1', 'mastery', 'deltoid')));
    await assertSucceeds(deleteDoc(doc(db, 'attemptEvents', 's1-attempt-0')));
    await assertSucceeds(deleteDoc(doc(db, 'users', 's1')));
  });
});

describe('an educator on the live bundle', () => {
  it('with a subscription: creates a class, sets work and invites, as before', async () => {
    const db = account('paidEducator', 'pat@uni.ac.uk');
    await assertSucceeds(createCohort(db, 'paidEducator', 'class-new', 'NEW777'));
    await assertSucceeds(setDoc(doc(db, 'cohorts', COHORT, 'assignments', 'a1'), {
      id: 'a1', cohortId: COHORT, title: 'Week 1', scope: { areas: ['shoulder'] }, questionTypes: ['mcq'], questionCount: 20, createdAt: NOW(),
    }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'invites', `new@uni.ac.uk__${COHORT}`), {
      cohortId: COHORT, cohortName: 'Y1 Sports Therapy', email: 'new@uni.ac.uk', invitedByUid: 'paidEducator', invitedByName: 'Pat',
      createdAt: NOW(), createdAtServer: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDocs(query(collection(db, 'users'), where('cohort', '==', COHORT))));
    await assertSucceeds(getDocs(collection(db, 'cohorts', COHORT, 'studentStats')));
  });

  // THE ONE CHANGE AN OLD CLIENT SEES. The owner says no class is owned by a
  // free account, so this is somebody trying for the first time. The live
  // screen tries eight codes, is refused eight times, and says "Could not
  // allocate a join code. Please try again." Nothing is half-written.
  it('on a free account: is refused a class at the first step, and nothing is left behind', async () => {
    const db = account('freeEducator');
    await touchUserProfile(db, 'freeEducator', { email: 'freeEducator@uni.ac.uk', isAnonymous: false });
    await assertFails(setDoc(doc(db, 'joinCodes', 'FREE01'), { cohortId: 'class-free', ownerUid: 'freeEducator', createdAt: NOW() }));
    await assertFails(setDoc(doc(db, 'cohorts', 'class-free'), {
      id: 'class-free', name: 'x', institution: '', ownerUid: 'freeEducator', joinCode: 'FREE01', createdAt: NOW(), archivedAt: null,
    }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), 'joinCodes', 'FREE01'))).exists()).toBe(false);
      expect((await getDoc(doc(ctx.firestore(), 'cohorts', 'class-free'))).exists()).toBe(false);
    });
    // Their own account is otherwise untouched.
    await assertSucceeds(answerAQuestion(db, 'freeEducator', 0));
  });
});
