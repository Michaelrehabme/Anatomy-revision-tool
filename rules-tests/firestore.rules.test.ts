/**
 * firestore.rules, tested against the emulator.
 *
 * The rules are the whole defence: the VITE_FIREBASE_* config ships to every
 * browser, so anyone can skip the app and call Firestore directly. Every
 * promise below is one the privacy policy, the join notice or the paywall
 * depends on, and each was until now kept only by reading the rules carefully
 * — which is how the create-time entitlement hole (29 Sep paywall trace) got
 * in. A test here is what stops an edit quietly reopening one.
 *
 *   npm run test:rules
 *
 * Needs Java (the emulator is a JVM process) and the firebase CLI. Runs under a
 * demo- project id, so it can never touch the real database.
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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const COHORT = 'cohort-a';
const OTHER_COHORT = 'cohort-b';
const CODE = 'JOIN42';

/** Signed-in contexts, named for who they are in the story. */
const as = {
  student: () => env.authenticatedContext('student', { email: 'student@uni.ac.uk', email_verified: true }).firestore(),
  classmate: () => env.authenticatedContext('classmate').firestore(),
  stranger: () => env.authenticatedContext('stranger', { email: 'stranger@uni.ac.uk' }).firestore(),
  educator: () => env.authenticatedContext('educator').firestore(),
  otherEducator: () => env.authenticatedContext('otherEducator').firestore(),
  claimAdmin: () => env.authenticatedContext('claimAdmin', { admin: true }).firestore(),
  roleAdmin: () => env.authenticatedContext('roleAdmin').firestore(),
  anon: () => env.unauthenticatedContext().firestore(),
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-locusmsk-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

/**
 * One cohort owned by `educator` that `student` and `classmate` have joined,
 * a second cohort owned by `otherEducator`, and `stranger` in neither.
 */
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'cohorts', COHORT), { ownerUid: 'educator', joinCode: CODE, name: 'Year 2' });
    await setDoc(doc(db, 'cohorts', OTHER_COHORT), { ownerUid: 'otherEducator', joinCode: 'OTHER1', name: 'Year 3' });
    await setDoc(doc(db, 'joinCodes', CODE), { cohortId: COHORT, ownerUid: 'educator' });
    await setDoc(doc(db, 'users', 'student'), { displayName: 'Sam', cohort: COHORT });
    await setDoc(doc(db, 'users', 'classmate'), { displayName: 'Cam', cohort: COHORT });
    await setDoc(doc(db, 'users', 'stranger'), { displayName: 'Stef', cohort: null });
    await setDoc(doc(db, 'users', 'student', 'sessions', 's1'), { missedStructureIds: ['x'], startedAt: 1 });
    await setDoc(doc(db, 'attemptEvents', 'a1'), { userId: 'student', selectedAnswer: 'x', correctAnswer: 'y' });
    await setDoc(doc(db, 'roles', 'roleAdmin'), { admin: true });
    await setDoc(doc(db, 'invites', 'stranger@uni.ac.uk__cohort-a'), { email: 'stranger@uni.ac.uk', cohortId: COHORT });
  });
});

describe('users/{uid}', () => {
  it('lets a student read and update their own profile', async () => {
    await assertSucceeds(getDoc(doc(as.student(), 'users', 'student')));
    await assertSucceeds(updateDoc(doc(as.student(), 'users', 'student'), { displayName: 'Samantha' }));
  });

  it("refuses another student's profile, and anyone signed out", async () => {
    await assertFails(getDoc(doc(as.classmate(), 'users', 'student')));
    await assertFails(updateDoc(doc(as.classmate(), 'users', 'student'), { displayName: 'x' }));
    await assertFails(getDoc(doc(as.anon(), 'users', 'student')));
  });

  describe('entitlement is never client-writable (CR-027)', () => {
    it('refuses a new profile that carries one', async () => {
      const db = env.authenticatedContext('fresh').firestore();
      await assertFails(setDoc(doc(db, 'users', 'fresh'), { entitlement: { tier: 'institutional', expiresAt: null } }));
      await assertSucceeds(setDoc(doc(db, 'users', 'fresh'), { displayName: 'New' }));
    });

    it('refuses adding, changing or removing one on update', async () => {
      await assertFails(updateDoc(doc(as.student(), 'users', 'student'), { entitlement: { tier: 'student' } }));

      await env.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore(), 'users', 'student'), { entitlement: { tier: 'student', expiresAt: 100 } }),
      );
      await assertFails(
        updateDoc(doc(as.student(), 'users', 'student'), { entitlement: { tier: 'student', expiresAt: 999 } }),
      );
      await assertFails(
        setDoc(doc(as.student(), 'users', 'student'), { displayName: 'Sam', cohort: COHORT }),
      );
      // An ordinary write that leaves it alone still goes through.
      await assertSucceeds(updateDoc(doc(as.student(), 'users', 'student'), { lastActiveAt: 5 }));
    });

    // The failed-payment flag, the cancellation date and the refund date all
    // live INSIDE the map (billing/lib/paddleWebhook.ts), so that the same
    // rule covers them: a student cannot clear "your payment failed", nor
    // mark a subscription cancelled to get past the deletion check, nor move
    // the expiry a past-due event set.
    it('refuses setting or clearing the payment flags the webhook writes', async () => {
      // As the webhook leaves a failed renewal: the expiry is the end of the
      // three days of grace (PAYMENT_GRACE_DAYS), and the flag says why.
      const stored = {
        tier: 'individual', source: 'paddle', expiresAt: '2026-05-15T10:18:47.635Z', externalId: 'sub_1',
        paymentIssueSince: '2026-05-12T10:19:26.014Z',
      };
      await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users', 'student'), { entitlement: stored }));
      const mine = doc(as.student(), 'users', 'student');

      await assertFails(updateDoc(mine, { 'entitlement.paymentIssueSince': deleteField() }));
      await assertFails(updateDoc(mine, { 'entitlement.expiresAt': '2099-01-01T00:00:00.000Z' }));
      // Not even by a day: the grace is the webhook's to give, once.
      await assertFails(updateDoc(mine, { 'entitlement.expiresAt': '2026-05-16T10:18:47.635Z' }));
      await assertFails(updateDoc(mine, { 'entitlement.paymentIssueSince': '2026-05-14T10:19:26.014Z' }));
      await assertFails(updateDoc(mine, { 'entitlement.cancelAt': '2026-05-12T10:18:47.635Z' }));
      await assertFails(updateDoc(mine, { 'entitlement.refundedAt': '2026-05-12T10:18:47.635Z' }));
      const { paymentIssueSince: _flag, ...cleared } = stored;
      void _flag;
      await assertFails(updateDoc(mine, { entitlement: cleared }));
      // Reading it — which is how the app knows to show the notice — is allowed.
      const snap = await assertSucceeds(getDoc(mine));
      expect(snap.data()?.entitlement.paymentIssueSince).toBe('2026-05-12T10:19:26.014Z');
    });

    it('does not let an owner delete and recreate the profile with one', async () => {
      await assertSucceeds(deleteDoc(doc(as.student(), 'users', 'student')));
      await assertFails(setDoc(doc(as.student(), 'users', 'student'), { entitlement: { tier: 'institutional' } }));
    });
  });

  /**
   * The free area (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 1). The content
   * function serves a free account exactly the area stored here, so every way
   * of getting a second one out of this field is a way round the paywall.
   * Each test below is one thing a client that skips the app might try.
   */
  describe('freeArea: chosen once, changed once after 30 days, nothing else', () => {
    const DAY = 86400000;
    const daysAgo = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY);
    const mine = () => doc(as.stranger(), 'users', 'stranger');
    const pick = (area: unknown, switches: unknown = 0, chosenAt: unknown = serverTimestamp()) => ({
      freeArea: { area, chosenAt, switches },
    });
    /** As the server would hold a choice made `days` ago. */
    const stored = (area: string, days: number, switches = 0) =>
      env.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore(), 'users', 'stranger'), {
          freeArea: { area, chosenAt: daysAgo(days), switches },
        }),
      );

    it('lets an account choose its free area, stamped by the server', async () => {
      await assertSucceeds(updateDoc(mine(), pick('knee')));
      const snap = await getDoc(mine());
      expect(snap.data()?.freeArea.area).toBe('knee');
      expect(snap.data()?.freeArea.switches).toBe(0);
      expect(Math.abs(snap.data()?.freeArea.chosenAt.toMillis() - Date.now())).toBeLessThan(60_000);
    });

    it('lets a brand-new profile arrive with its choice (a guest at onboarding)', async () => {
      const db = env.authenticatedContext('guest').firestore();
      await assertSucceeds(setDoc(doc(db, 'users', 'guest'), { cohort: null, ...pick('hip') }));
    });

    it('lets a choice already used on the device move up as used', async () => {
      await assertSucceeds(updateDoc(mine(), pick('knee', 1)));
    });

    it('lets ordinary profile writes through once a choice is stored', async () => {
      await stored('knee', 3);
      await assertSucceeds(updateDoc(mine(), { lastActiveAt: 5 }));
      await assertSucceeds(setDoc(mine(), { displayName: 'Stef again' }, { merge: true }));
    });

    it('refuses choosing twice', async () => {
      await assertSucceeds(updateDoc(mine(), pick('knee')));
      await assertFails(updateDoc(mine(), pick('hip')));
      await assertFails(updateDoc(mine(), pick('knee')));
    });

    it('refuses a change before 30 days are up, and allows it after', async () => {
      await stored('knee', 29);
      await assertFails(updateDoc(mine(), pick('hip', 1)));
      await stored('knee', 31);
      await assertSucceeds(updateDoc(mine(), pick('hip', 1)));
      expect((await getDoc(mine())).data()?.freeArea).toMatchObject({ area: 'hip', switches: 1 });
    });

    it('refuses a second change, however long is waited', async () => {
      await stored('hip', 400, 1);
      await assertFails(updateDoc(mine(), pick('knee', 1)));
      await assertFails(updateDoc(mine(), pick('knee', 2)));
      await assertFails(updateDoc(mine(), pick('knee', 0)));
    });

    it('refuses a change that does not count itself, or counts backwards', async () => {
      await stored('knee', 31);
      await assertFails(updateDoc(mine(), pick('hip', 0)));
      await assertFails(updateDoc(mine(), pick('hip', -1)));
      await assertFails(updateDoc(mine(), pick('hip', 2)));
    });

    it('refuses a backdated choice, on the first pick and on the change', async () => {
      await assertFails(updateDoc(mine(), pick('knee', 0, daysAgo(31))));
      await assertFails(updateDoc(mine(), pick('knee', 0, '2020-01-01T00:00:00.000Z')));
      await assertFails(updateDoc(mine(), pick('knee', 0, Timestamp.fromMillis(Date.now() + 5 * DAY))));
      await stored('knee', 31);
      await assertFails(updateDoc(mine(), pick('hip', 1, daysAgo(31))));
    });

    it('refuses re-timing or re-counting a stored choice without changing it', async () => {
      await stored('knee', 10);
      await assertFails(updateDoc(mine(), { 'freeArea.chosenAt': daysAgo(40) }));
      await assertFails(updateDoc(mine(), { 'freeArea.chosenAt': serverTimestamp() }));
      await assertFails(updateDoc(mine(), { 'freeArea.switches': -5 }));
      await assertFails(updateDoc(mine(), { 'freeArea.area': 'hip' }));
    });

    it('refuses removing the choice, which would make the next one a first pick again', async () => {
      await stored('knee', 10);
      await assertFails(updateDoc(mine(), { freeArea: deleteField() }));
      await assertFails(setDoc(mine(), { displayName: 'Stef', cohort: null }));
      await assertFails(updateDoc(mine(), { freeArea: null }));
    });

    it('refuses anything that is not one of the nine areas, or not this shape', async () => {
      await assertFails(updateDoc(mine(), pick('everything')));
      await assertFails(updateDoc(mine(), pick(['knee', 'hip'])));
      await assertFails(updateDoc(mine(), pick('')));
      await assertFails(updateDoc(mine(), pick('knee', '0')));
      await assertFails(updateDoc(mine(), pick('knee', 0.5)));
      await assertFails(updateDoc(mine(), pick('knee', 7)));
      await assertFails(updateDoc(mine(), { freeArea: 'knee' }));
      await assertFails(updateDoc(mine(), { freeArea: { area: 'knee', chosenAt: serverTimestamp() } }));
      await assertFails(
        updateDoc(mine(), { freeArea: { area: 'knee', chosenAt: serverTimestamp(), switches: 0, also: 'hip' } }),
      );
    });

    it("refuses writing another account's choice", async () => {
      await assertFails(updateDoc(doc(as.student(), 'users', 'stranger'), pick('knee')));
      await assertFails(updateDoc(doc(as.educator(), 'users', 'student'), pick('knee')));
      await assertFails(updateDoc(doc(as.claimAdmin(), 'users', 'student'), pick('knee')));
    });

    it('still refuses an entitlement slipped in beside a valid choice', async () => {
      await assertFails(updateDoc(mine(), { ...pick('knee'), entitlement: { tier: 'individual', expiresAt: null } }));
    });

    // NOT A PROMISE THE RULES KEEP, and written down so nobody assumes it is.
    // The owner may delete their profile (erasure), and a new profile may
    // carry a first pick. See the note above isArea() in firestore.rules.
    it('KNOWN LIMIT: deleting the profile and creating it again gives a fresh choice', async () => {
      await stored('hip', 400, 1);
      await assertSucceeds(deleteDoc(mine()));
      await assertSucceeds(setDoc(mine(), { cohort: null, ...pick('knee') }));
    });
  });

  describe("contentFetch, the content function's own count, is never client-writable", () => {
    it('refuses it on a new profile and on an existing one', async () => {
      const db = env.authenticatedContext('fresh').firestore();
      await assertFails(setDoc(doc(db, 'users', 'fresh'), { contentFetch: { count: 0 } }));
      await assertFails(updateDoc(doc(as.student(), 'users', 'student'), { contentFetch: { count: 0 } }));
    });

    it('refuses resetting or removing a stored count, and leaves other writes alone', async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore(), 'users', 'student'), { contentFetch: { windowStart: 1, count: 30 } }),
      );
      const mine = doc(as.student(), 'users', 'student');
      await assertFails(updateDoc(mine, { 'contentFetch.count': 0 }));
      await assertFails(updateDoc(mine, { contentFetch: deleteField() }));
      await assertSucceeds(updateDoc(mine, { lastActiveAt: 6 }));
    });
  });

  describe('cohort membership is proven, not asserted', () => {
    it('refuses joining by cohort id alone', async () => {
      await assertFails(updateDoc(doc(as.stranger(), 'users', 'stranger'), { cohort: COHORT }));
    });

    it('refuses a wrong join code', async () => {
      await assertFails(
        updateDoc(doc(as.stranger(), 'users', 'stranger'), { cohort: COHORT, cohortJoinCode: 'WRONG1' }),
      );
    });

    it('accepts the right join code', async () => {
      await assertSucceeds(
        updateDoc(doc(as.stranger(), 'users', 'stranger'), { cohort: COHORT, cohortJoinCode: CODE }),
      );
    });

    it('accepts an invitation addressed to this account, and no one else', async () => {
      const inviteId = 'stranger@uni.ac.uk__cohort-a';
      await assertSucceeds(
        updateDoc(doc(as.stranger(), 'users', 'stranger'), { cohort: COHORT, cohortInviteId: inviteId }),
      );
      // Someone else outside the cohort, holding the stranger's invite id.
      const outsider = env.authenticatedContext('outsider', { email: 'outsider@uni.ac.uk' }).firestore();
      await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', 'outsider'), { cohort: null }));
      await assertFails(
        updateDoc(doc(outsider, 'users', 'outsider'), { cohort: COHORT, cohortInviteId: inviteId }),
      );
    });

    it('refuses an invitation to one cohort used to join another', async () => {
      await assertFails(
        updateDoc(doc(as.stranger(), 'users', 'stranger'), {
          cohort: OTHER_COHORT,
          cohortInviteId: 'stranger@uni.ac.uk__cohort-a',
        }),
      );
    });

    it('always lets a student leave', async () => {
      await assertSucceeds(updateDoc(doc(as.student(), 'users', 'student'), { cohort: null }));
    });
  });

  describe('what an educator sees', () => {
    it("reads the profile of a student who joined their cohort", async () => {
      await assertSucceeds(getDoc(doc(as.educator(), 'users', 'student')));
    });

    it('cannot read a student who has not joined, or who joined someone else', async () => {
      await assertFails(getDoc(doc(as.educator(), 'users', 'stranger')));
      await assertFails(getDoc(doc(as.otherEducator(), 'users', 'student')));
    });

    it("cannot read a member's sessions or other subcollections (CR-031)", async () => {
      await assertFails(getDoc(doc(as.educator(), 'users', 'student', 'sessions', 's1')));
      await assertFails(getDocs(collection(as.educator(), 'users', 'student', 'sessions')));
    });

    it("cannot write a member's profile", async () => {
      await assertFails(updateDoc(doc(as.educator(), 'users', 'student'), { displayName: 'x' }));
    });
  });

  describe('admins read everything and write nothing', () => {
    it('reads profiles and subcollections', async () => {
      await assertSucceeds(getDoc(doc(as.claimAdmin(), 'users', 'student')));
      await assertSucceeds(getDoc(doc(as.roleAdmin(), 'users', 'student', 'sessions', 's1')));
    });

    it('cannot alter a student', async () => {
      await assertFails(updateDoc(doc(as.claimAdmin(), 'users', 'student'), { displayName: 'x' }));
      await assertFails(setDoc(doc(as.roleAdmin(), 'users', 'student', 'sessions', 's1'), { startedAt: 2 }));
    });
  });
});

describe('attemptEvents', () => {
  it('lets a student log their own answers, and only their own', async () => {
    await assertSucceeds(setDoc(doc(as.student(), 'attemptEvents', 'a2'), { userId: 'student' }));
    await assertFails(setDoc(doc(as.student(), 'attemptEvents', 'a3'), { userId: 'classmate' }));
  });

  it('never allows an answer to be rewritten', async () => {
    await assertFails(updateDoc(doc(as.student(), 'attemptEvents', 'a1'), { selectedAnswer: 'y' }));
  });

  it('lets the author delete (erasure) and nobody else', async () => {
    await assertFails(deleteDoc(doc(as.classmate(), 'attemptEvents', 'a1')));
    await assertFails(deleteDoc(doc(as.claimAdmin(), 'attemptEvents', 'a1')));
    await assertSucceeds(deleteDoc(doc(as.student(), 'attemptEvents', 'a1')));
  });

  it("keeps individual answers from the student's educator (CR-031) and classmates", async () => {
    await assertFails(getDoc(doc(as.educator(), 'attemptEvents', 'a1')));
    await assertFails(getDoc(doc(as.classmate(), 'attemptEvents', 'a1')));
    await assertSucceeds(getDoc(doc(as.student(), 'attemptEvents', 'a1')));
    await assertSucceeds(getDoc(doc(as.claimAdmin(), 'attemptEvents', 'a1')));
  });

  it('refuses an unfiltered query, which would read other people', async () => {
    await assertFails(getDocs(collection(as.student(), 'attemptEvents')));
    await assertSucceeds(
      getDocs(query(collection(as.student(), 'attemptEvents'), where('userId', '==', 'student'))),
    );
  });
});

describe('cohorts', () => {
  it('lets anyone signed in create a cohort they own', async () => {
    await assertSucceeds(
      setDoc(doc(as.stranger(), 'cohorts', 'new'), { ownerUid: 'stranger', joinCode: 'NEW123', name: 'Mine' }),
    );
    await assertFails(
      setDoc(doc(as.stranger(), 'cohorts', 'new2'), { ownerUid: 'educator', joinCode: 'NEW124', name: 'Theirs' }),
    );
  });

  it('refuses a self-issued licence, at creation or later', async () => {
    await assertFails(
      setDoc(doc(as.stranger(), 'cohorts', 'new'), {
        ownerUid: 'stranger',
        joinCode: 'NEW123',
        name: 'Mine',
        licensedUntil: 4102444800000,
      }),
    );
    await assertFails(updateDoc(doc(as.educator(), 'cohorts', COHORT), { licensedUntil: 4102444800000 }));
  });

  it('refuses handing a cohort, and its students, to another account', async () => {
    await assertFails(updateDoc(doc(as.educator(), 'cohorts', COHORT), { ownerUid: 'stranger' }));
    await assertSucceeds(updateDoc(doc(as.educator(), 'cohorts', COHORT), { name: 'Year 2, renamed' }));
  });

  it("refuses edits and deletes from anyone but the owner", async () => {
    await assertFails(updateDoc(doc(as.student(), 'cohorts', COHORT), { name: 'x' }));
    await assertFails(deleteDoc(doc(as.otherEducator(), 'cohorts', COHORT)));
  });

  it('lists only your own cohorts', async () => {
    await assertFails(getDocs(collection(as.educator(), 'cohorts')));
    await assertSucceeds(getDocs(query(collection(as.educator(), 'cohorts'), where('ownerUid', '==', 'educator'))));
  });

  describe('rollups', () => {
    it("lets a member write their own studentStats row, and not a classmate's", async () => {
      await assertSucceeds(setDoc(doc(as.student(), 'cohorts', COHORT, 'studentStats', 'student'), { correct: 1 }));
      await assertFails(setDoc(doc(as.student(), 'cohorts', COHORT, 'studentStats', 'classmate'), { correct: 99 }));
    });

    it('refuses rollup writes from a non-member', async () => {
      await assertFails(setDoc(doc(as.stranger(), 'cohorts', COHORT, 'studentStats', 'stranger'), { correct: 1 }));
      await assertFails(setDoc(doc(as.stranger(), 'cohorts', COHORT, 'confusionStats', 'x__y'), { count: 1 }));
    });

    it('shows rollups to the owner and not to students or other educators', async () => {
      await assertSucceeds(setDoc(doc(as.student(), 'cohorts', COHORT, 'confusionStats', 'x__y'), { count: 1 }));
      await assertSucceeds(getDocs(collection(as.educator(), 'cohorts', COHORT, 'studentStats')));
      await assertSucceeds(getDoc(doc(as.educator(), 'cohorts', COHORT, 'confusionStats', 'x__y')));
      await assertFails(getDoc(doc(as.classmate(), 'cohorts', COHORT, 'studentStats', 'student')));
      await assertFails(getDoc(doc(as.otherEducator(), 'cohorts', COHORT, 'confusionStats', 'x__y')));
    });
  });
});

describe('invites', () => {
  it('may only be created by the owner of the named cohort', async () => {
    const invite = { email: 'new@uni.ac.uk', cohortId: COHORT };
    await assertSucceeds(setDoc(doc(as.educator(), 'invites', 'new@uni.ac.uk__cohort-a'), invite));
    await assertFails(setDoc(doc(as.otherEducator(), 'invites', 'x__cohort-a'), invite));
    await assertFails(setDoc(doc(as.student(), 'invites', 'y__cohort-a'), invite));
  });

  it('is readable by the invitee and the educator, and nobody else', async () => {
    const id = 'stranger@uni.ac.uk__cohort-a';
    await assertSucceeds(getDoc(doc(as.stranger(), 'invites', id)));
    await assertSucceeds(getDoc(doc(as.educator(), 'invites', id)));
    await assertFails(getDoc(doc(as.student(), 'invites', id)));
    await assertFails(getDoc(doc(as.otherEducator(), 'invites', id)));
  });

  it('can never be repointed at another cohort', async () => {
    await assertFails(
      updateDoc(doc(as.educator(), 'invites', 'stranger@uni.ac.uk__cohort-a'), { cohortId: OTHER_COHORT }),
    );
  });
});

describe('joinCodes', () => {
  it('resolves a code by id but cannot be listed', async () => {
    await assertSucceeds(getDoc(doc(as.stranger(), 'joinCodes', CODE)));
    await assertFails(getDocs(collection(as.stranger(), 'joinCodes')));
  });

  it('can never be repointed', async () => {
    await assertFails(updateDoc(doc(as.educator(), 'joinCodes', CODE), { cohortId: OTHER_COHORT }));
  });

  it("cannot be claimed in someone else's name", async () => {
    await assertFails(setDoc(doc(as.stranger(), 'joinCodes', 'ZZZ999'), { cohortId: COHORT, ownerUid: 'educator' }));
  });
});

describe('roles', () => {
  it('cannot be self-issued', async () => {
    await assertFails(setDoc(doc(as.student(), 'roles', 'student'), { admin: true }));
  });

  it('can be granted by an admin, by claim, role doc or the bootstrap address', async () => {
    await assertSucceeds(setDoc(doc(as.claimAdmin(), 'roles', 'a'), { admin: true }));
    await assertSucceeds(setDoc(doc(as.roleAdmin(), 'roles', 'b'), { admin: true }));
    const bootstrap = env
      .authenticatedContext('owner', { email: 'nearyomichael@gmail.com', email_verified: true })
      .firestore();
    await assertSucceeds(setDoc(doc(bootstrap, 'roles', 'c'), { admin: true }));
  });

  it('does not honour the bootstrap address unverified', async () => {
    const unverified = env
      .authenticatedContext('impostor', { email: 'nearyomichael@gmail.com', email_verified: false })
      .firestore();
    await assertFails(setDoc(doc(unverified, 'roles', 'impostor'), { admin: true }));
  });
});

describe('site and admin collections', () => {
  it('shows settings/site to everyone and lets only admins change it', async () => {
    await assertSucceeds(getDoc(doc(as.anon(), 'settings', 'site')));
    await assertFails(setDoc(doc(as.student(), 'settings', 'site'), { showHome: false }));
    await assertSucceeds(setDoc(doc(as.claimAdmin(), 'settings', 'site'), { showHome: false }));
  });

  it('keeps changeRequests and questionReviews to admins', async () => {
    await assertFails(getDocs(collection(as.student(), 'changeRequests')));
    await assertFails(setDoc(doc(as.educator(), 'questionReviews', 'q1'), { reviewed: true }));
    await assertSucceeds(getDocs(collection(as.claimAdmin(), 'changeRequests')));
  });

  it('closes billingFailures to every client, admins included', async () => {
    await assertFails(getDocs(collection(as.claimAdmin(), 'billingFailures')));
    await assertFails(setDoc(doc(as.student(), 'billingFailures', 'e1'), { uid: 'student' }));
  });

  it('refuses any collection the rules do not name', async () => {
    await assertFails(setDoc(doc(as.student(), 'anythingElse', 'x'), { a: 1 }));
  });
});
