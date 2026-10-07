/**
 * THE LIVE BUNDLE, AGAINST THESE RULES.
 *
 * The rules on this branch are stricter than the ones in production in four
 * places: a guest may no longer hold a free area; creating a class needs
 * full access; a free area needs a CONFIRMED EMAIL ADDRESS (7 Oct 2026); and
 * a profile's `createdAt` may only be the server's time, because it is what
 * says whether an account was here before that rule. Rules deploy in an instant; the app does not — an installed
 * copy keeps the bundle it has until the student accepts the update prompt,
 * which can be days. So for days the OLD client talks to the NEW rules, and
 * what matters is whether anything it does is now refused.
 *
 * This file replays the writes the live code makes (commit 581dfe1, what
 * production served on 6 Oct 2026), document for document and field for
 * field. (Production moved on during 7 Oct to main at 9566d21, the accuracy
 * filter. Its two commits change one thing a client writes: an answer record
 * may now carry `hints`. That is replayed below too; nothing else these rules
 * look at differs.) The writes are made as the people who make them: a guest, a guest who then creates an
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
 * AND FOR THE CONFIRMED-ADDRESS RULE: every account below signs in with an
 * email and password and has NOT confirmed its address (`email_verified:
 * false`), because the live app never sent anybody a confirmation email. Not
 * one of their writes is refused, paying or free. The live app writes
 * `createdAt` exactly once, as the server's time, on a profile's first
 * write, which is what the pin allows; the one way it writes it twice (two
 * tabs opening at the same moment) is replayed below and goes through too.
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

describe("the confirmed-address rule, and the live bundle's unconfirmed accounts", () => {
  // Two tabs opened at once both find no profile and both write a first
  // one: the second arrives as an UPDATE carrying createdAt as the server's
  // time. A pin that only allowed "unchanged" would have refused it.
  it("accepts the profile's first write from two tabs at once", async () => {
    const db = guest('twin');
    const first = { uid: 'twin', displayName: null, email: null, isAnonymous: true, lastActiveAt: serverTimestamp(), createdAt: serverTimestamp(), cohort: null };
    await assertSucceeds(setDoc(doc(db, 'users', 'twin'), first));
    await assertSucceeds(setDoc(doc(db, 'users', 'twin'), first));
  });

  it('accepts every load of a profile that already carries its date, from long before the rule', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 's-old'), {
        uid: 's-old', displayName: 'Sam', email: 's-old@uni.ac.uk', isAnonymous: false, cohort: null,
        createdAt: new Date('2026-05-01T09:00:00Z'), lastActiveAt: new Date('2026-10-01T09:00:00Z'),
      }),
    );
    const db = account('s-old');
    await assertSucceeds(touchUserProfile(db, 's-old', { email: 's-old@uni.ac.uk', isAnonymous: false, displayName: 'Sam' }));
    await assertSucceeds(answerAQuestion(db, 's-old', 0));
    await assertSucceeds(finishASession(db, 's-old'));
    // The date it was first written is untouched by any of it.
    const stored = (await getDoc(doc(db, 'users', 's-old'))).data()?.createdAt as { toDate: () => Date };
    expect(stored.toDate().toISOString()).toBe('2026-05-01T09:00:00.000Z');
  });

  it('accepts a profile written before the app stamped a date at all', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'users', 's-undated'), { uid: 's-undated', displayName: null, email: 's-undated@uni.ac.uk', isAnonymous: false, cohort: null }),
    );
    const db = account('s-undated');
    await assertSucceeds(touchUserProfile(db, 's-undated', { email: 's-undated@uni.ac.uk', isAnonymous: false }));
    await assertSucceeds(answerAQuestion(db, 's-undated', 0));
  });

  // A paying educator on the live bundle has never confirmed anything.
  it('refuses nothing to a paying, unconfirmed account: the profile, answers, a class, an assignment', async () => {
    const db = account('paidEducator', 'pat@uni.ac.uk');
    await assertSucceeds(touchUserProfile(db, 'paidEducator', { email: 'pat@uni.ac.uk', isAnonymous: false, displayName: 'Pat' }));
    await assertSucceeds(answerAQuestion(db, 'paidEducator', 0));
    await assertSucceeds(finishASession(db, 'paidEducator'));
    await assertSucceeds(createCohort(db, 'paidEducator', 'class-two', 'TWO222'));
    await assertSucceeds(setDoc(doc(db, 'cohorts', COHORT, 'assignments', 'a2'), {
      id: 'a2', cohortId: COHORT, title: 'Week 2', scope: { areas: ['knee'] }, questionTypes: ['mcq'], questionCount: 10, createdAt: NOW(),
    }));
    // Its entitlement is exactly as the webhook left it.
    expect((await getDoc(doc(db, 'users', 'paidEducator'))).data()?.entitlement.tier).toBe('individual');
  });

  // The live bundle keeps the free area on the device and never writes it.
  // Shown refused for a NEW unconfirmed account, as it is for a guest above,
  // so that "the old client is unaffected" has something under it here too.
  it('never writes a free area, which is the one write these rules refuse an unconfirmed new account', async () => {
    const db = account('s-new');
    await touchUserProfile(db, 's-new', { email: 's-new@uni.ac.uk', isAnonymous: false });
    await assertFails(setDoc(doc(db, 'users', 's-new'), { freeArea: { area: 'knee', chosenAt: serverTimestamp(), switches: 0 } }, { merge: true }));
    await assertSucceeds(answerAQuestion(db, 's-new', 0));
  });
});

describe('the bundle released on 7 Oct 2026 (main at 9566d21)', () => {
  // lib/attemptFilter.ts: a typed fact card now records whether its hints
  // were shown, so the account page can filter by it. One more optional
  // field on a document whose only rule is "it is yours".
  it('records `hints` on an answer, for a guest and for an unconfirmed account, and it is accepted', async () => {
    for (const [db, uid] of [[guest('g7'), 'g7'], [account('s7'), 's7']] as const) {
      await assertSucceeds(touchUserProfile(db, uid, { email: uid === 'g7' ? null : `${uid}@uni.ac.uk`, isAnonymous: uid === 'g7' }));
      await assertSucceeds(setDoc(doc(db, 'attemptEvents', `${uid}-typed-1`), {
        id: `${uid}-typed-1`, userId: uid, questionId: 'oina-deltoid-nerve', questionType: 'oina', structureId: 'deltoid', promptKind: 'nerve',
        correct: true, selectedAnswer: 'axillary nerve', timestamp: NOW(), durationMs: 5100, sessionId: `${uid}-s1`, hints: 'none',
      }));
    }
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
