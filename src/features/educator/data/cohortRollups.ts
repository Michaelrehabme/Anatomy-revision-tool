import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { UserAttempt } from '../../anatomy-revision/types/attempt';
import type { DayTally } from '../../anatomy-revision/lib/accuracyTrend';

/**
 * Cohort rollups (CR-031) — what an educator reads INSTEAD of student rows.
 *
 * THE PROBLEM. firestore.rules granted a cohort owner read on every
 * attemptEvent of every student in their class, selectedAnswer included, and
 * cohortAnalytics pulled those rows into the educator's browser to aggregate
 * them client-side. Nothing displayed them, but the access was real, and the
 * join notice had to be weakened to stop promising otherwise.
 *
 * THE SHAPE. Aggregate on write. Two subcollections under the cohort:
 *
 *   cohorts/{id}/confusionStats/{pairKey}  { correctAnswer, selectedAnswer, count }
 *   cohorts/{id}/studentStats/{uid}        { displayName, totals, structures, activeDays }
 *
 * confusionStats is a pure COUNTER set, deliberately. No uid, no timestamp,
 * no row per answer — so there is nothing to correlate back to a person even
 * for someone reading the raw database. "Anonymised" event rows would not
 * achieve that: in a class of forty, timing alone re-identifies. It is also
 * the only thing here that cannot be derived from something else, which is
 * why it survives as its own collection.
 *
 * studentStats is per-student and that is the point — name, accuracy and
 * last-active are exactly what a module leader is meant to see, and what the
 * join notice has always said they see. Its `structures` map carries the
 * per-structure counters too, which is what lets the cohort-wide weakness
 * table be a SUM over ~40 student documents rather than a read of ~309
 * per-structure ones. That is both cheaper and strictly more informative: a
 * bare per-structure counter cannot tell you how many DIFFERENT students hit
 * a structure, and `distinctUsers` is a column the table has always had.
 *
 * (An earlier pass wrote a separate cohorts/{id}/structureStats collection.
 * It was removed rather than kept in parallel: every number in it is a sum of
 * this map, so keeping both would have meant two sources for one figure and a
 * silent divergence the first time a write partially failed.)
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

  /*
   * Learn cards are ungraded since CR-018, and every accuracy figure in the
   * product excludes them — counting a card someone read as a question they
   * got right puts anyone who worked through a deck at or near 100%. The old
   * client-side aggregation applied that filter after the fact; a counter
   * cannot be filtered after the fact, so the split has to happen here.
   *
   * attemptsTotal still counts everything, because the students list shows
   * attempts and exposure as engagement, and a student who worked the cards
   * did engage. Only the accuracy denominators are graded-only.
   */
  const graded = attempt.graded !== false;

  const batch = writeBatch(db);

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
      gradedTotal: increment(graded ? 1 : 0),
      gradedCorrect: increment(graded && attempt.correct ? 1 : 0),
      lastActiveAt: attempt.timestamp,
      updatedAt: serverTimestamp(),
      // Per-structure counts for THIS student. Summed across the class these
      // are the cohort weakness table; read for one student they are the
      // detail screen's weakest-structures list. Either way, no attempt row.
      // Graded-only, to match what the weakness table has always counted.
      [`structures.${attempt.structureId}.attempts`]: increment(graded ? 1 : 0),
      [`structures.${attempt.structureId}.correct`]: increment(graded && attempt.correct ? 1 : 0),
      // First-attempt accuracy is a separate column from overall accuracy in
      // the weakness table, and the difference between them is the whole
      // point of it — a structure at 45% first-time and 90% overall is being
      // learned, one at 45% both ways is being forgotten. Counters cannot be
      // recovered after the fact, so they are accumulated here rather than
      // dropped and missed later.
      ...(graded && attempt.attemptNumber === 1
        ? {
            [`structures.${attempt.structureId}.first`]: increment(1),
            [`structures.${attempt.structureId}.firstCorrect`]: increment(attempt.correct ? 1 : 0),
          }
        : {}),
      // Sum and count rather than a running mean: means do not compose, and
      // the table wants one figure across the whole class.
      ...(graded && typeof attempt.durationMs === 'number'
        ? {
            [`structures.${attempt.structureId}.durMs`]: increment(attempt.durationMs),
            [`structures.${attempt.structureId}.durCount`]: increment(1),
          }
        : {}),
      // Per-day tallies rather than a boolean "was active".
      //
      // A boolean answers the activity chart and retention, and nothing else.
      // The accuracy-over-time chart on the student detail screen needs day
      // totals, and it is the one thing on that screen that actually answers
      // "is this person improving" — the question the whole cohort dashboard
      // exists for. Three counters per active day, capped at a term's worth
      // of days, is a cheap way to keep it.
      //
      // `attempts` counts everything so a day spent on learn cards still
      // shows as a day the student worked; `graded`/`correct` are the
      // accuracy pair, on the same graded-only footing as everything else.
      [`days.${dayKey(attempt.timestamp)}.attempts`]: increment(1),
      [`days.${dayKey(attempt.timestamp)}.graded`]: increment(graded ? 1 : 0),
      [`days.${dayKey(attempt.timestamp)}.correct`]: increment(graded && attempt.correct ? 1 : 0),
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

// ---------------------------------------------------------------------------
// Read side. What the educator dashboard actually loads.
// ---------------------------------------------------------------------------

/** Per-structure counters for one student, as stored in studentStats.structures. */
export interface StructureCounters {
  attempts: number;
  correct: number;
  /** Attempts where attemptNumber === 1. Absent on rows written before this was tracked. */
  first?: number;
  firstCorrect?: number;
  /** Summed answer time and the count it is over, so a mean can be taken across students. */
  durMs?: number;
  durCount?: number;
}

/**
 * One cohorts/{id}/studentStats/{uid} document.
 *
 * Everything is optional-with-a-default on read. These documents are written
 * incrementally from students' devices over a whole term, so a field added
 * later simply will not exist on rows written before it — and a dashboard
 * that throws on the first such row is a dashboard that breaks for the
 * longest-standing class rather than the newest one.
 */
export interface StudentStatsDoc {
  uid: string;
  displayName: string | null;
  /** Every attempt, learn cards included — the "attempts" column is engagement. */
  attemptsTotal: number;
  /** Graded attempts only. Every accuracy figure divides by this, never by attemptsTotal. */
  gradedTotal: number;
  gradedCorrect: number;
  lastActiveAt: string | null;
  structures: Record<string, StructureCounters>;
  /** YYYY-MM-DD keys the student was active on, oldest first. */
  activeDays: string[];
  /** Graded totals per day, for the accuracy-over-time chart. Days with no graded answers are absent. */
  dayTallies: Map<string, DayTally>;
  /** Set when the student left the cohort; such rows are filtered out on read. */
  removed?: boolean;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toStructureCounters(raw: unknown): StructureCounters {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    attempts: num(r.attempts),
    correct: num(r.correct),
    first: typeof r.first === 'number' ? r.first : undefined,
    firstCorrect: typeof r.firstCorrect === 'number' ? r.firstCorrect : undefined,
    durMs: typeof r.durMs === 'number' ? r.durMs : undefined,
    durCount: typeof r.durCount === 'number' ? r.durCount : undefined,
  };
}

/**
 * Every student summary for a cohort — one query, class-sized.
 *
 * Rows marked `removed` are dropped rather than deleted on the way out: a
 * student who leaves stops appearing immediately (that is what clearStudentStats
 * is for), but their counters stay in place so that rejoining does not reset
 * a term's history, and so a delete is never issued from a student's device
 * against a document an educator is reading.
 */
export async function readStudentStats(db: Firestore, cohortId: string): Promise<StudentStatsDoc[]> {
  const snapshot = await getDocs(collection(db, 'cohorts', cohortId, 'studentStats'));

  return snapshot.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const structuresRaw = (data.structures ?? {}) as Record<string, unknown>;
      const daysRaw = (data.days ?? {}) as Record<string, unknown>;

      return {
        uid: typeof data.uid === 'string' ? data.uid : d.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : null,
        attemptsTotal: num(data.attemptsTotal),
        gradedTotal: num(data.gradedTotal),
        gradedCorrect: num(data.gradedCorrect),
        lastActiveAt: typeof data.lastActiveAt === 'string' ? data.lastActiveAt : null,
        structures: Object.fromEntries(
          Object.entries(structuresRaw).map(([id, counters]) => [id, toStructureCounters(counters)]),
        ),
        // Stored as a map keyed by day so each day is an independent
        // increment; an array would have to be read before it could be
        // appended to, which is a round trip on every answered question.
        activeDays: Object.entries(daysRaw)
          .filter(([, tally]) => num((tally as Record<string, unknown>)?.attempts) > 0)
          .map(([day]) => day)
          .sort(),
        dayTallies: new Map(
          Object.entries(daysRaw)
            .map(([day, tally]) => {
              const t = (tally ?? {}) as Record<string, unknown>;
              return [day, { total: num(t.graded), correct: num(t.correct) }] as const;
            })
            .filter(([, tally]) => tally.total > 0),
        ),
        removed: data.removed === true,
      } satisfies StudentStatsDoc;
    })
    .filter((row) => !row.removed);
}

/** One cohorts/{id}/confusionStats/{pairKey} document. */
export interface ConfusionStatsDoc {
  correctAnswer: string;
  selectedAnswer: string;
  count: number;
}

/**
 * Confusion pairs for a cohort, commonest first.
 *
 * This is the one figure on the dashboard with no other source: it needs the
 * text of the answer a student actually chose, and nothing else in the system
 * keeps that in aggregate. It therefore also cannot be backfilled — see
 * scripts/backfillCohortRollups.ts — so a cohort's table is empty until its
 * students answer something after this ships.
 */
export async function readConfusionStats(db: Firestore, cohortId: string): Promise<ConfusionStatsDoc[]> {
  const snapshot = await getDocs(collection(db, 'cohorts', cohortId, 'confusionStats'));

  return snapshot.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        correctAnswer: typeof data.correctAnswer === 'string' ? data.correctAnswer : '',
        selectedAnswer: typeof data.selectedAnswer === 'string' ? data.selectedAnswer : '',
        count: num(data.count),
      };
    })
    .filter((row) => row.correctAnswer !== '' && row.selectedAnswer !== '' && row.count > 0)
    .sort((a, b) => b.count - a.count);
}
