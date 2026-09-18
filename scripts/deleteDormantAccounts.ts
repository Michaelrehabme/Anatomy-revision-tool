/**
 * Deletes accounts dormant longer than the published retention period.
 *
 * WHY THIS EXISTS. The privacy policy has always promised deletion after
 * 24 months of inactivity and nothing enforced it — found while writing the
 * DPIA, recorded there as risk R2. A commitment in a published policy that no
 * code keeps is the kind of thing a university's DPO finds, and it is much
 * better found by us.
 *
 * WHY IT IS A SCRIPT AND NOT A SCHEDULED FUNCTION. A Cloud Function on a timer
 * would be tidier, and needs the Blaze plan and a billing account — the same
 * trade-off cohortRollups.ts records for aggregation. Deletion that runs a few
 * days late is not a breach; a billing commitment before the first paying user
 * is a real cost. Run this monthly. Move it to a Function when there is revenue.
 *
 * DRY RUN BY DEFAULT. It prints what it would delete and exits. `--apply` is
 * required to remove anything, because this is the one script in the repository
 * that destroys student data and a mistyped date should cost nothing.
 *
 *   npx tsx scripts/deleteDormantAccounts.ts                # report only
 *   npx tsx scripts/deleteDormantAccounts.ts --apply        # actually delete
 *   npx tsx scripts/deleteDormantAccounts.ts --asOf 2027-01-01
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS — see the README's "Admin scripts".
 */
import { getFirestore, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';
import { INACTIVITY_MONTHS, dormantBefore } from '../src/features/anatomy-revision/data/retention';

/**
 * Mirrors data/accountLifecycle.ts. Deleting less than the student's own
 * "delete my account" button would leave the promise half-kept, so the two
 * lists must stay together — if one gains a collection, so does the other.
 */
const USER_SUBCOLLECTIONS = [
  'mastery',
  'factMastery',
  'sessions',
  'achievements',
  'gamification',
  'questionExposure',
  'diagnostics',
];

const APPLY = process.argv.includes('--apply');
const asOfArg = process.argv.indexOf('--asOf');
const NOW = asOfArg > -1 && process.argv[asOfArg + 1] ? new Date(process.argv[asOfArg + 1]) : new Date();

/** Firestore caps a batch at 500; deletes are chunked rather than assumed small. */
async function deleteAll(db: Firestore, docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<number> {
  let done = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
    done += Math.min(400, docs.length - i);
  }
  return done;
}

async function purge(db: Firestore, uid: string, cohortId: string | null): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // The educator-visible summary first, for the reason accountLifecycle gives:
  // an educator should stop seeing a student before the rest disappears.
  if (cohortId) {
    await db.doc(`cohorts/${cohortId}/studentStats/${uid}`).delete().catch(() => {});
    counts.studentStats = 1;
  }

  const attempts = await db.collection('attemptEvents').where('userId', '==', uid).get();
  counts.attemptEvents = await deleteAll(db, attempts.docs);

  for (const name of USER_SUBCOLLECTIONS) {
    const snap = await db.collection(`users/${uid}/${name}`).get();
    if (snap.size > 0) counts[name] = await deleteAll(db, snap.docs);
  }

  await db.doc(`users/${uid}`).delete();
  counts.userDoc = 1;
  await db.doc(`roles/${uid}`).delete().catch(() => {});

  // The Auth record last: while it exists the data is recoverable by signing
  // in, and if this throws we would rather have left the account intact.
  await getAuth().deleteUser(uid).catch((e) => {
    console.warn(`  ! auth record for ${uid} not removed: ${e.message}`);
  });

  return counts;
}

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const cutoff = dormantBefore(NOW);

  console.log(`Retention: ${INACTIVITY_MONTHS} months of inactivity`);
  console.log(`As of:     ${NOW.toISOString().slice(0, 10)}`);
  console.log(`Cutoff:    accounts last active before ${cutoff.toISOString().slice(0, 10)}`);
  console.log(APPLY ? 'Mode:      APPLY — data will be deleted\n' : 'Mode:      dry run — nothing will be deleted\n');

  const snapshot = await db
    .collection('users')
    .where('lastActiveAt', '<', Timestamp.fromDate(cutoff))
    .get();

  if (snapshot.empty) {
    console.log('No dormant accounts. Nothing to do.');
    return;
  }

  let deleted = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const last = (data.lastActiveAt as Timestamp | undefined)?.toDate();
    const cohortId = (data.cohort as string | null) || null;
    const label = `${doc.id}  last active ${last ? last.toISOString().slice(0, 10) : 'unknown'}${cohortId ? `  cohort ${cohortId}` : ''}`;

    if (!APPLY) {
      console.log(`would delete  ${label}`);
      continue;
    }

    const counts = await purge(db, doc.id, cohortId);
    deleted += 1;
    console.log(`deleted       ${label}  ${JSON.stringify(counts)}`);
  }

  console.log(
    APPLY
      ? `\nDone: ${deleted} account${deleted === 1 ? '' : 's'} deleted.`
      : `\n${snapshot.size} account${snapshot.size === 1 ? '' : 's'} would be deleted. Re-run with --apply.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
