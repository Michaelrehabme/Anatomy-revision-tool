import type { AnatomyStructure } from '../../anatomy-revision/types/structure';
import type { RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import type { DayTally } from '../../anatomy-revision/lib/accuracyTrend';
import type {
  ActiveUsersPoint,
  ConfusionPair,
  RegionAccuracyBar,
  RetentionStats,
  StructureWeaknessRow,
} from '../../admin/types/analytics';
import type { ConfusionStatsDoc, StudentStatsDoc } from '../data/cohortRollups';

/**
 * Turns cohort rollup documents into the same shapes the educator screens
 * already render (CR-031).
 *
 * The counterpart of admin/lib/analyticsAggregation.ts, and deliberately a
 * separate module rather than more functions in it: those take UserAttempt[]
 * and remain correct for the admin screens, which keep their attemptEvents
 * read. These take counters, and the two must not be confused at a call site
 * — reaching for the attempt-based version in educator code is precisely the
 * mistake this change exists to prevent.
 *
 * Pure: no Firestore, no clock, no I/O. Every import is `import type`, so
 * nothing here pulls the Firebase SDK into a test.
 *
 * WHAT IS LOST, STATED HONESTLY. A counter cannot be filtered after the fact,
 * so anything the old code got by slicing the attempt log a different way is
 * either accumulated at write time or gone:
 *
 * - Median answer time is gone. The table asked for a mean and now gets a
 *   true one, summed at write time; no screen showed a median.
 * - Region accuracy maps structureId through the structure list rather than
 *   reading a region off each attempt, so an attempt against a structure no
 *   longer in the seed is dropped rather than counted under its historic
 *   region. That is a handful of rows at most, and they would be unnameable
 *   in the table anyway.
 * - Anything per-attempt — a timeline, an answer log — is not expressible
 *   here at all. That is the point of the change, not a gap in it.
 */

function accuracyPct(correct: number, total: number): number | null {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

/**
 * Cohort-wide per-structure weakness, worst accuracy first.
 *
 * Summed across student documents rather than read from a per-structure
 * collection: a class is ~40 documents against ~309 structures, so this is
 * the cheaper read, and it is the only one that can answer `distinctUsers` —
 * a bare counter cannot say how many different people are behind it.
 */
export function structureWeaknessFromStats(
  stats: StudentStatsDoc[],
  structures: AnatomyStructure[],
  minAttempts: number,
): StructureWeaknessRow[] {
  const structuresById = new Map(structures.map((s) => [s.id, s] as const));

  interface Bucket {
    attempts: number;
    correct: number;
    first: number;
    firstCorrect: number;
    durMs: number;
    durCount: number;
    distinctUsers: number;
  }
  const byStructure = new Map<string, Bucket>();

  for (const student of stats) {
    for (const [structureId, counters] of Object.entries(student.structures)) {
      if (counters.attempts <= 0) continue;
      const bucket = byStructure.get(structureId) ?? {
        attempts: 0,
        correct: 0,
        first: 0,
        firstCorrect: 0,
        durMs: 0,
        durCount: 0,
        distinctUsers: 0,
      };
      bucket.attempts += counters.attempts;
      bucket.correct += counters.correct;
      bucket.first += counters.first ?? 0;
      bucket.firstCorrect += counters.firstCorrect ?? 0;
      bucket.durMs += counters.durMs ?? 0;
      bucket.durCount += counters.durCount ?? 0;
      // One student counts once, however many attempts they made.
      bucket.distinctUsers += 1;
      byStructure.set(structureId, bucket);
    }
  }

  const rows: StructureWeaknessRow[] = [];

  for (const [structureId, b] of byStructure) {
    if (b.attempts < minAttempts) continue;
    const structure = structuresById.get(structureId);
    // A structure missing from the seed has no name, region or category to
    // show. The attempt-based version could fall back to fields carried on the
    // attempt row; there is nowhere to read them from here, so the row is
    // dropped rather than rendered as a blank line in a table an educator is
    // meant to act on.
    if (!structure) continue;

    rows.push({
      structureId,
      name: structure.name,
      region: structure.region,
      category: structure.category,
      totalAttempts: b.attempts,
      accuracyPct: Math.round((b.correct / b.attempts) * 100),
      firstAttemptAccuracyPct: accuracyPct(b.firstCorrect, b.first),
      firstAttemptCount: b.first,
      distinctUsers: b.distinctUsers,
      meanAnswerTimeMs: b.durCount > 0 ? Math.round(b.durMs / b.durCount) : null,
    });
  }

  return rows.sort((a, b) => a.accuracyPct - b.accuracyPct || b.totalAttempts - a.totalAttempts);
}

/** One student's weakest structures — the same function scoped to them, with no cohort threshold to clear. */
export function structureWeaknessForStudentStats(
  student: StudentStatsDoc,
  structures: AnatomyStructure[],
): StructureWeaknessRow[] {
  return structureWeaknessFromStats([student], structures, 1);
}

/** Accuracy per body region, derived by mapping each structure to its region. */
export function accuracyByRegionFromStats(
  stats: StudentStatsDoc[],
  structures: AnatomyStructure[],
): RegionAccuracyBar[] {
  const regionById = new Map(structures.map((s) => [s.id, s.region] as const));
  const byRegion = new Map<string, { total: number; correct: number }>();

  for (const student of stats) {
    for (const [structureId, counters] of Object.entries(student.structures)) {
      const region = regionById.get(structureId);
      if (!region || counters.attempts <= 0) continue;
      const bucket = byRegion.get(region) ?? { total: 0, correct: 0 };
      bucket.total += counters.attempts;
      bucket.correct += counters.correct;
      byRegion.set(region, bucket);
    }
  }

  return [...byRegion.entries()].map(([region, { total, correct }]) => ({
    region: region as RegionAccuracyBar['region'],
    total,
    correct,
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
  }));
}

/** Every student's day tallies summed into one series — the cohort baseline the trend chart draws against. */
export function mergeDayTallies(stats: StudentStatsDoc[]): Map<string, DayTally> {
  const merged = new Map<string, DayTally>();
  for (const student of stats) {
    for (const [day, tally] of student.dayTallies) {
      const bucket = merged.get(day) ?? { total: 0, correct: 0 };
      bucket.total += tally.total;
      bucket.correct += tally.correct;
      merged.set(day, bucket);
    }
  }
  return merged;
}

/**
 * The headline above the trend chart: this student's earliest answers against
 * their most recent ones, in percentage points.
 *
 * AN APPROXIMATION, AND WHY IT IS STILL WORTH DRAWING. The attempt-based
 * original sliced a student's answers into quartiles by COUNT, deliberately —
 * a rolling daily window carries one session across a quiet week and reports
 * a swing nobody made, whereas 40 attempts is 40 attempts however long they
 * took. Counters only reach day granularity, so a quartile boundary usually
 * falls inside a day. That day's correct count is split in proportion to how
 * much of it is needed, which assumes a student's accuracy does not lurch
 * within a single day.
 *
 * The alternative was rounding to whole days, which moves the boundary by up
 * to a full session and is a worse error than the one being avoided; or
 * dropping the figure, which costs the screen the one number that answers
 * "is this person getting better" at a glance. Where a boundary does fall on
 * a day edge — a student who revises in discrete sittings, which is most of
 * them — the result is exact.
 */
export function accuracyDeltaFromDayTallies(
  dayTallies: Map<string, DayTally>,
  minSlice: number,
): { deltaPts: number; firstPct: number; lastPct: number; sliceSize: number } | null {
  const days = [...dayTallies.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = days.reduce((sum, [, t]) => sum + t.total, 0);
  const sliceSize = Math.floor(total / 4);
  if (sliceSize < minSlice) return null;

  /** Correct answers within the first `wanted` attempts of `ordered`, splitting the boundary day pro rata. */
  const correctInFirst = (ordered: [string, DayTally][], wanted: number): number => {
    let remaining = wanted;
    let correct = 0;
    for (const [, tally] of ordered) {
      if (remaining <= 0) break;
      if (tally.total <= remaining) {
        correct += tally.correct;
        remaining -= tally.total;
      } else {
        correct += (tally.correct * remaining) / tally.total;
        remaining = 0;
      }
    }
    return correct;
  };

  const firstPct = Math.round((correctInFirst(days, sliceSize) / sliceSize) * 100);
  const lastPct = Math.round((correctInFirst([...days].reverse(), sliceSize) / sliceSize) * 100);

  return { deltaPts: lastPct - firstPct, firstPct, lastPct, sliceSize };
}

/** Distinct active students per calendar day, oldest first. */
export function activeUsersByDayFromStats(stats: StudentStatsDoc[]): ActiveUsersPoint[] {
  const countByDay = new Map<string, number>();
  for (const student of stats) {
    // activeDays is already a deduplicated set of day keys per student, so a
    // student can only ever add one to a day.
    for (const day of student.activeDays) {
      countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    }
  }
  return [...countByDay.entries()]
    .map(([date, activeUsers]) => ({ date, activeUsers }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * N-day retention, the same definition as computeRetention in
 * analyticsAggregation.ts — "active again at least N days after first seen",
 * with students who have not yet had N days to return excluded from the
 * denominator rather than counted as churned.
 */
export function retentionFromStats(stats: StudentStatsDoc[]): RetentionStats {
  let latestDay = '';
  for (const student of stats) {
    const last = student.activeDays[student.activeDays.length - 1];
    if (last && last > latestDay) latestDay = last;
  }

  if (!latestDay) return { day1Pct: null, day7Pct: null, day30Pct: null };
  const latestMs = Date.parse(`${latestDay}T00:00:00Z`);

  function retentionForWindow(windowDays: number): number | null {
    let eligible = 0;
    let retained = 0;

    for (const student of stats) {
      const days = student.activeDays;
      if (days.length === 0) continue;
      const firstMs = Date.parse(`${days[0]}T00:00:00Z`);
      if (Math.round((latestMs - firstMs) / MS_PER_DAY) < windowDays) continue;

      eligible += 1;
      if (days.some((day) => Math.round((Date.parse(`${day}T00:00:00Z`) - firstMs) / MS_PER_DAY) >= windowDays)) {
        retained += 1;
      }
    }

    return eligible > 0 ? Math.round((retained / eligible) * 100) : null;
  }

  return {
    day1Pct: retentionForWindow(1),
    day7Pct: retentionForWindow(7),
    day30Pct: retentionForWindow(30),
  };
}

/**
 * Session length and completion, from the session summaries alone.
 *
 * The attempt-based version derived "sessions started" from the distinct
 * sessionIds present in the attempt sample, so a session someone opened and
 * abandoned without answering anything never counted as started — which
 * flattered the completion rate. Counting the summaries directly is both the
 * only option here and the more honest figure.
 */
export function sessionMetricsFromSummaries(summaries: RevisionSessionSummary[]): {
  meanSessionLengthMinutes: number | null;
  completionRatePct: number | null;
  totalSessions: number;
} {
  const totalSessions = summaries.length;
  const finished = summaries.filter((s) => s.finishedAt);
  const durations = finished.map((s) => (Date.parse(s.finishedAt!) - Date.parse(s.startedAt)) / 60000);

  return {
    meanSessionLengthMinutes:
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    completionRatePct: totalSessions > 0 ? Math.round((finished.length / totalSessions) * 100) : null,
    totalSessions,
  };
}

/**
 * Confusion pairs, commonest first.
 *
 * structureIds is resolved by matching the correct answer against structure
 * names, because the attempt's own structureId is no longer available. The
 * field's documented meaning — "the structures the correct answer belongs to,
 * when known" — already allows for unknown, and an empty array says so
 * honestly rather than guessing.
 */
export function confusionPairsFromStats(
  docs: ConfusionStatsDoc[],
  structures: AnatomyStructure[],
): ConfusionPair[] {
  const idsByName = new Map<string, string[]>();
  for (const s of structures) {
    const key = s.name.toLowerCase();
    const existing = idsByName.get(key);
    if (existing) existing.push(s.id);
    else idsByName.set(key, [s.id]);
  }

  return docs
    .map((d) => ({
      correctAnswer: d.correctAnswer,
      selectedAnswer: d.selectedAnswer,
      count: d.count,
      structureIds: idsByName.get(d.correctAnswer.toLowerCase()) ?? [],
    }))
    .sort((a, b) => b.count - a.count);
}
