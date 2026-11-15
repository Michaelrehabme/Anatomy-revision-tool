import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

/**
 * Everything held under one uid, deleted with the Admin SDK — the same
 * clean-up as the student's own "Delete my account"
 * (src/features/anatomy-revision/data/accountLifecycle.ts) and
 * scripts/deleteDormantAccounts.ts. Kept in step with those two by hand: a
 * collection added to one belongs in all three.
 *
 * The sign-in record is not touched here; the caller removes it last, so that
 * a failure part-way leaves an account that can still sign in and be cleaned
 * up again rather than orphaned data nobody can reach.
 */
const USER_SUBCOLLECTIONS = [
  'mastery',
  'factMastery',
  'sessions',
  'achievements',
  'gamification',
  'questionExposure',
  'diagnostics',
  'assignmentTemplates',
];
const USER_REPORT_COLLECTIONS = ['questionReports', 'clientErrors', 'funnelEvents'];

async function deleteAll(db: Firestore, docs: QueryDocumentSnapshot[]): Promise<number> {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
  return docs.length;
}

export async function purgeAccountData(
  db: Firestore,
  uid: string,
  profile: { cohort?: unknown; email?: unknown } | undefined,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const cohortId = typeof profile?.cohort === 'string' && profile.cohort ? profile.cohort : null;
  const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : null;

  if (cohortId) {
    await db.doc(`cohorts/${cohortId}/members/${uid}`).delete().catch(() => {});
    await db.doc(`cohorts/${cohortId}/studentStats/${uid}`).delete().catch(() => {});
  }
  if (email) {
    const invites = await db.collection('invites').where('email', '==', email).get();
    counts.invites = await deleteAll(db, invites.docs);
  }

  const owned = await db.collection('cohorts').where('ownerUid', '==', uid).get();
  for (const cohort of owned.docs) {
    for (const sub of ['members', 'studentStats', 'confusionStats', 'assignments']) {
      await deleteAll(db, (await db.collection(`cohorts/${cohort.id}/${sub}`).get()).docs);
    }
    await deleteAll(db, (await db.collection('invites').where('cohortId', '==', cohort.id).get()).docs);
    const code = cohort.data().joinCode;
    if (typeof code === 'string' && code) await db.doc(`joinCodes/${code}`).delete().catch(() => {});
    await cohort.ref.delete();
  }
  if (owned.size) counts.classesRun = owned.size;

  counts.billingFailures = await deleteAll(db, (await db.collection('billingFailures').where('uid', '==', uid).get()).docs);
  counts.attemptEvents = await deleteAll(db, (await db.collection('attemptEvents').where('userId', '==', uid).get()).docs);
  for (const name of USER_REPORT_COLLECTIONS) {
    counts[name] = await deleteAll(db, (await db.collection(name).where('userId', '==', uid).get()).docs);
  }
  for (const name of USER_SUBCOLLECTIONS) {
    counts[name] = await deleteAll(db, (await db.collection(`users/${uid}/${name}`).get()).docs);
  }

  await db.doc(`users/${uid}`).delete();
  await db.doc(`roles/${uid}`).delete().catch(() => {});
  await db.doc(`adminTestAccounts/${uid}`).delete().catch(() => {});
  return counts;
}
