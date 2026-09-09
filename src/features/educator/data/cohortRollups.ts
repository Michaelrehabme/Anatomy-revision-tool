import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { UserAttempt } from '../../anatomy-revision/types/attempt';

/**
 * Cohort rollups (CR-031) — what an educator reads INSTEAD of student rows.
 *
 * THE PROBLEM. firestore.rules granted a cohort owner read on every
 * attemptEvent of every student in their class, selectedAnswer included, and
 * cohortAnalytics pulled those rows into the educator's browser to aggregate
 * them client-side. Nothing displayed them, but the access was real, and the
 * join notice had to be weakened to stop promising otherwise.
 *
 * THE SHAPE. Aggregate on write. Three subcollections under the cohort:
 *
 *   cohorts/{id}/structureStats/{structureId}  { attempts, correct }
 *   cohorts/{id}/confusionStats/{pairKey}      { correctAnswer, selectedAnswer, count }
 *   cohorts/{id}/studentStats/{uid}            { displayName, totals, lastActiveAt, ... }
 *
 * The first two are COUNTERS, deliberately. No uid, no timestamp, no row per
 * answer — so there is nothing to correlate back to a person even by someone
 * reading the raw database. "Anonymised" event rows would not achieve that:
 * in a class of forty, timing alone re-identifies.
 *
 * The third is per-student and that is fine — name, accuracy and last-active
 * are exactly what a module leader is meant to see, and what the join notice
 * has always said they see.
 *
 * WHY NOT CLOUD FUNCTIONS. A trigger on attemptEvent writes would be tidier
 * and tamper-proof, but Firebase Functions needs the Blaze plan and therefore
 * a billing account, which is not a commitment worth making before the
 * product has a single paying user. The trade-off accepted here is integrity,
 * not privacy: a determined student could inflate their own class's counters.
 * That is a much smaller problem than an educator being able to read
 * everyone's answers, and rules below constrain writes to increments on the
 * writer's own cohort. Move this to a Function when there is revenue.
 */

/** Fire-and-forget: a rollup must never take a session down with it. */
function detach(promise: Promise<unknown>): void {
  void promise.catch(() => {
    /* A dropped counter is a slightly wrong chart. A thrown error is a lost answer. */
  });
}

/**
 * users/{uid}.cohort, cached for the session. Without this every answered
 * question costs an extra document read purely to discover a cohort that
 * changes at most once or twice a year.
 */
const cohortCache = new Map<string, string | null>();

export function forgetCachedCohort(uid: string): void {
  cohortCache.delete(uid);
}

async function cohortOf(db: Firestore, uid: string): Promise<string | null> {
  const cached = cohortCache.get(uid);
  if (cached !== undefined) return cached;

  const snapshot = await getDoc(doc(db, 'users', uid));
  const cohort = (snapshot.exists() ? (snapshot.data().cohort as string | null) : null) || null;
  cohortCache.set(uid, cohort);
  return cohort;
}

/**
 * Pair key for the confusion table. Both names are in the id so the document
 * is self-describing, and the separator is one Firestore forbids in a path
 * segment nowhere else, so it cannot collide with a structure name.
 */
export function confusionKey(correctAnswer: string, selectedAnswer: string): string {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9 ()-]/g, '').slice(0, 60).trim();
  return `${clean(correctAnswer)}~${clean(selectedAnswer)}`;
}

/** YYYY-MM-DD in UTC — the granularity the activity chart draws. */
function dayKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/**
 * Called after an attempt is recorded. Does nothing for a student who is not
 * in a class, which is most of them.
 */
export async function rollUpAttempt(db: Firestore, attempt: UserAttempt, displayName: string | null): Promise<void> {
  const cohortId = await cohortOf(db, attempt.userId);
  if (!cohortId) return;

  const batch = writeBatch(db);

  // Per-structure counters — feeds the weakness table.
  batch.set(
    doc(db, 'cohorts', cohortId, 'structureStats', attempt.structureId),
    {
      structureId: attempt.structureId,
      attempts: increment(1),
      correct: increment(attempt.correct ? 1 : 0),
    },
    { merge: true },
  );

  // Confusion counters, only where an answer string exists and was wrong.
  // Locate and flashcard carry no answer text, and inventing one would put
  // fabricated rows in the table an educator trusts most.
  if (!attempt.correct && attempt.correctAnswer && attempt.selectedAnswer && attempt.correctAnswer !== attempt.selectedAnswer) {
    batch.set(
      doc(db, 'cohorts', cohortId, 'confusionStats', confusionKey(attempt.correctAnswer, attempt.selectedAnswer)),
      {
        correctAnswer: attempt.correctAnswer,
        selectedAnswer: attempt.selectedAnswer,
        count: increment(1),
      },
      { merge: true },
    );
  }

  // Per-student summary — the students list and detail screens.
  batch.set(
    doc(db, 'cohorts', cohortId, 'studentStats', attempt.userId),
    {
      uid: attempt.userId,
      displayName,
      attemptsTotal: increment(1),
      attemptsCorrect: increment(attempt.correct ? 1 : 0),
      lastActiveAt: attempt.timestamp,
      updatedAt: serverTimestamp(),
      // Per-structure counts for THIS student, so the detail screen can show
      // their weakest structures without reading a single attempt row.
      [`structures.${attempt.structureId}.attempts`]: increment(1),
      [`structures.${attempt.structureId}.correct`]: increment(attempt.correct ? 1 : 0),
      [`activeDays.${dayKey(attempt.timestamp)}`]: true,
    },
    { merge: true },
  );

  await batch.commit();
}

/** The call site's entry point — never awaited, never allowed to throw. */
export function rollUpAttemptDetached(db: Firestore, attempt: UserAttempt, displayName: string | null): void {
  detach(rollUpAttempt(db, attempt, displayName));
}

/** Clears a student's summary when they leave a class, so an educator stops seeing them immediately. */
export async function clearStudentStats(db: Firestore, cohortId: string, uid: string): Promise<void> {
  await setDoc(doc(db, 'cohorts', cohortId, 'studentStats', uid), { removed: true }, { merge: true });
}
