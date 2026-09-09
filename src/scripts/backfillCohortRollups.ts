import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { UserAttempt } from '../features/anatomy-revision/types/attempt';
import { buildConfusionStats, buildStudentStats, confusionKeyFor } from '../features/educator/lib/rollupFromAttempts';

/**
 * One-off migration for CR-031: rebuilds every cohort's rollup counters from
 * the attempt log.
 *
 * WHY IT HAS TO EXIST. The counters are written incrementally as students
 * answer questions, so without this a class that has been running all term
 * shows its educator an empty dashboard from the moment the new read path
 * ships — the worst possible morning for it to happen, since that is the
 * morning they were told to go and look at it.
 *
 * WHY IT RUNS AS AN ADMIN. It reads attemptEvents across every user, which is
 * exactly the access CR-031 takes away from educators and leaves with admins.
 * The rollup collections grant admin write for this script and nothing else;
 * see the comments on those rules.
 *
 * WHAT IT CANNOT RECOVER. Nothing, from the attempt log — the confusion pairs
 * included, since attemptEvents still carries the answer text. This is the
 * last moment that is true for any data being migrated: the counters are the
 * only record from here on.
 *
 * Usage — dry run first, always:
 *
 *   npx tsx src/scripts/backfillCohortRollups.ts
 *   npx tsx src/scripts/backfillCohortRollups.ts --write
 *
 * Needs the VITE_FIREBASE_* values from .env plus an admin's credentials:
 *
 *   BACKFILL_EMAIL=you@example.com BACKFILL_PASSWORD=... npx tsx ... --write
 *
 * Idempotent: every document is written with set() rather than incremented,
 * so running it twice produces the same result as running it once. It is a
 * REPLACEMENT, though — run it while students are actively answering and any
 * counter that moved between the read and the write is lost. Run it before
 * the rules are deployed, or at a quiet hour.
 */

const WRITE = process.argv.includes('--write');
const BATCH_LIMIT = 400; // Firestore's limit is 500; leave headroom.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Source it from .env, or pass it on the command line.`);
  return value;
}

async function connect(): Promise<Firestore> {
  const app = initializeApp({
    apiKey: env('VITE_FIREBASE_API_KEY'),
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });

  // Signed in as a real admin rather than through the Admin SDK: this needs no
  // service-account key on anyone's laptop, and it exercises the same rules
  // the app does, so a run that succeeds is evidence the rules permit it.
  await signInWithEmailAndPassword(getAuth(app), env('BACKFILL_EMAIL'), env('BACKFILL_PASSWORD'));
  return getFirestore(app);
}

interface CohortPlan {
  cohortId: string;
  cohortName: string;
  students: { uid: string; displayName: string | null; attempts: UserAttempt[] }[];
}

async function plan(db: Firestore): Promise<CohortPlan[]> {
  const cohorts = await getDocs(collection(db, 'cohorts'));
  const plans: CohortPlan[] = [];

  for (const cohortDoc of cohorts.docs) {
    const cohortId = cohortDoc.id;
    const cohortName = (cohortDoc.data().name as string) ?? cohortId;

    // Membership lives on the student's own profile, not on a roster array in
    // the cohort — see cohortsRepository.
    const members = await getDocs(query(collection(db, 'users'), where('cohort', '==', cohortId)));

    const students = [];
    for (const member of members.docs) {
      const uid = member.id;
      const snapshot = await getDocs(query(collection(db, 'attemptEvents'), where('userId', '==', uid)));
      students.push({
        uid,
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
    let batch = writeBatch(db);
    let queued = 0;

    const flush = async () => {
      if (queued === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      queued = 0;
    };

    for (const student of students) {
      if (student.attempts.length === 0) continue;
      const stats = buildStudentStats(student.uid, student.displayName, student.attempts);

      batch.set(doc(db, 'cohorts', cohortId, 'studentStats', student.uid), {
        uid: stats.uid,
        displayName: stats.displayName,
        attemptsTotal: stats.attemptsTotal,
        gradedTotal: stats.gradedTotal,
        gradedCorrect: stats.gradedCorrect,
        lastActiveAt: stats.lastActiveAt,
        structures: stats.structures,
        // Back to the wire shape: a map of day -> counters, which is what the
        // incremental writes produce and what the read path parses.
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
      batch.set(doc(db, 'cohorts', cohortId, 'confusionStats', confusionKeyFor(pair.correctAnswer, pair.selectedAnswer)), pair);
      queued += 1;
      if (queued >= BATCH_LIMIT) await flush();
    }

    await flush();
  }
}

async function main(): Promise<void> {
  const db = await connect();
  const plans = await plan(db);

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
