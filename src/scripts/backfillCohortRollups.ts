import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAdminApp } from '../../scripts/firebaseAdmin';
import type { UserAttempt } from '../features/anatomy-revision/types/attempt';
import { buildConfusionStats, buildStudentStats, confusionKeyFor } from '../features/educator/lib/rollupFromAttempts';

/**
 * One-off migration for CR-031: rebuilds every cohort's rollup counters from
 * the attempt log.
 *
 * WHY IT EXISTS. The counters are written incrementally as students answer
 * questions, so without this a class that has been running all term shows its
 * educator an empty dashboard from the moment the new read path ships — the
 * worst possible morning for it, since that is the morning they were told to
 * go and look at it.
 *
 * WHY THE ADMIN SDK. It reads attemptEvents across every user, which is
 * exactly the access CR-031 takes away from educators. Going through the
 * Admin SDK rather than signing in as an admin in the client means the rules
 * need no admin write grant on the rollup collections at all — a permanent
 * widening of who may write derived student data, in exchange for a migration
 * that runs once, was the wrong trade. It also sidesteps the fact that an
 * owner who only ever signs in with Google has no password to sign a script
 * in with.
 *
 * WHAT IT CANNOT RECOVER. Nothing, from the attempt log — confusion pairs
 * included, since attemptEvents still carries the answer text. This is the
 * last moment that is true for any data being migrated: the counters are the
 * only record from here on.
 *
 * Usage — dry run first, always:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npx tsx src/scripts/backfillCohortRollups.ts
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npx tsx src/scripts/backfillCohortRollups.ts --write
 *
 * The key comes from Firebase console -> Project settings -> Service accounts
 * -> Generate new private key, the same one scripts/setAdmin.ts needs. Never
 * commit it.
 *
 * Idempotent: every document is written with set() rather than incremented,
 * so running it twice gives the same result as running it once. It is a
 * REPLACEMENT, though — run it while students are actively answering and any
 * counter that moved between the read and the write is lost. Run it at a
 * quiet hour, or before the class is told about the dashboard.
 */

const WRITE = process.argv.includes('--write');
const BATCH_LIMIT = 400; // Firestore's limit is 500; leave headroom.

interface CohortPlan {
  cohortId: string;
  cohortName: string;
  students: { uid: string; displayName: string | null; attempts: UserAttempt[] }[];
}

async function plan(db: Firestore): Promise<CohortPlan[]> {
  const cohorts = await db.collection('cohorts').get();
  const plans: CohortPlan[] = [];

  for (const cohortDoc of cohorts.docs) {
    const cohortId = cohortDoc.id;
    const cohortName = (cohortDoc.data().name as string) ?? cohortId;

    // Membership lives on the student's own profile, not in a roster array on
    // the cohort — see educator/data/cohortsRepository.ts.
    const members = await db.collection('users').where('cohort', '==', cohortId).get();

    const students = [];
    for (const member of members.docs) {
      const snapshot = await db.collection('attemptEvents').where('userId', '==', member.id).get();
      students.push({
        uid: member.id,
        displayName: (member.data().displayName as string | null) ?? null,
        attempts: snapshot.docs.map((d) => d.data() as UserAttempt),
      });
    }

    plans.push({ cohortId, cohortName, students });
  }

  return plans;
}

async function apply(db: Firestore, plans: CohortPlan[]): Promise<void> {
  for (const { cohortId, students } of plans) {
    let batch = db.batch();
    let queued = 0;

    const flush = async () => {
      if (queued === 0) return;
      await batch.commit();
      batch = db.batch();
      queued = 0;
    };

    for (const student of students) {
      if (student.attempts.length === 0) continue;
      const stats = buildStudentStats(student.uid, student.displayName, student.attempts);

      batch.set(db.doc(`cohorts/${cohortId}/studentStats/${student.uid}`), {
        uid: stats.uid,
        displayName: stats.displayName,
        attemptsTotal: stats.attemptsTotal,
        gradedTotal: stats.gradedTotal,
        gradedCorrect: stats.gradedCorrect,
        lastActiveAt: stats.lastActiveAt,
        structures: stats.structures,
        // Back to the wire shape: day -> counters, which is what the
        // incremental writes produce and what the read path parses. attempts
        // counts everything (a learn-card day is still a day worked), graded
        // and correct are the accuracy pair.
        days: Object.fromEntries(
          stats.activeDays.map((day) => {
            const tally = stats.dayTallies.get(day);
            return [day, { attempts: tally?.total ?? 0, graded: tally?.total ?? 0, correct: tally?.correct ?? 0 }];
          }),
        ),
      });
      queued += 1;
      if (queued >= BATCH_LIMIT) await flush();
    }

    for (const pair of buildConfusionStats(students.flatMap((s) => s.attempts))) {
      batch.set(
        db.doc(`cohorts/${cohortId}/confusionStats/${confusionKeyFor(pair.correctAnswer, pair.selectedAnswer)}`),
        pair,
      );
      queued += 1;
      if (queued >= BATCH_LIMIT) await flush();
    }

    await flush();
  }
}

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const plans = await plan(db);

  if (plans.length === 0) console.log('No cohorts found.');

  for (const { cohortId, cohortName, students } of plans) {
    const active = students.filter((s) => s.attempts.length > 0);
    const attempts = students.reduce((sum, s) => sum + s.attempts.length, 0);
    const pairs = buildConfusionStats(students.flatMap((s) => s.attempts)).length;
    console.log(
      `${cohortName} (${cohortId})\n` +
        `  ${students.length} member${students.length === 1 ? '' : 's'}, ` +
        `${active.length} with attempts, ${attempts} attempts, ${pairs} confusion pair${pairs === 1 ? '' : 's'}`,
    );
  }

  if (!WRITE) {
    console.log('\nDry run — nothing written. Re-run with --write to apply.');
    return;
  }

  await apply(db, plans);
  console.log('\nWritten.');
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
