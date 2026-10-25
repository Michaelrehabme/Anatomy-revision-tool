/**
 * One-off: writes cohorts/{id}/members/{uid} for every student already in a
 * class.
 *
 * WHY. A class owner used to list their class by reading each member's whole
 * users/{uid} profile, which carried their email, payment ids and plan. The
 * rules no longer allow that; the class list is cohorts/{id}/members, which a
 * student writes when they join (cohortRollups.writeMembership). Students who
 * joined before that write their entry the next time they use the app. This
 * covers the rest, so no educator opens their class to find it shorter.
 *
 * RUN IT WHEN THE NEW RULES ARE DEPLOYED, not before: an entry written early
 * is harmless, but an educator's class list stays empty from the rules deploy
 * until this has run.
 *
 *   npx tsx scripts/backfillCohortMembers.ts            # report only
 *   npx tsx scripts/backfillCohortMembers.ts --apply    # write the entries
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS — see the README's "Admin scripts".
 * Safe to run again: each entry is merged, never duplicated.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './firebaseAdmin';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const members = await db.collection('users').where('cohort', '!=', null).get();
  console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: dry run — nothing will be written\n');

  let written = 0;
  let skipped = 0;
  for (const user of members.docs) {
    const data = user.data();
    const cohortId = typeof data.cohort === 'string' ? data.cohort : '';
    if (!cohortId || !(await db.doc(`cohorts/${cohortId}`).get()).exists) {
      skipped += 1;
      continue;
    }
    const entry: Record<string, unknown> = {
      uid: user.id,
      displayName: (data.displayName as string | null) ?? null,
      email: (data.email as string | null) ?? null,
    };
    if (typeof data.cohortJoinedAt === 'string') entry.joinedAt = data.cohortJoinedAt;
    if (APPLY) await db.doc(`cohorts/${cohortId}/members/${user.id}`).set(entry, { merge: true });
    written += 1;
    console.log(`${APPLY ? 'wrote' : 'would write'}  cohorts/${cohortId}/members/${user.id}`);
  }

  console.log(`\n${written} entr${written === 1 ? 'y' : 'ies'}${APPLY ? ' written' : ' to write'}; ${skipped} pointing at a class that no longer exists.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
