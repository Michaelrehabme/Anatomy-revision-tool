import type { UserAttempt } from '../types/attempt';

/**
 * Accuracy over time for one student, against their cohort's average on the
 * same days — the "is this person actually improving?" question, which a
 * single lifetime accuracy figure cannot answer.
 *
 * Two decisions worth stating, because both change what the line means:
 *
 * 1. It is a TRAILING WINDOW, not per-day accuracy. A student answering 6
 *    questions on a Tuesday can score 50% or 83% on one lucky guess, so a raw
 *    daily line is mostly noise and slopes in it mean nothing. Each point is
 *    every attempt in the preceding `windowDays`, which is what makes a rising
 *    line evidence of improvement rather than of a quiet week.
 * 2. Thin points are dropped, not drawn. Below `minAttempts` in the window the
 *    point is null and the line breaks. Interpolating across a gap would draw
 *    a confident line through days the student never revised.
 *
 * The cohort series is computed over the same windows and the same days, so
 * the comparison is like-for-like: it moves when the class moves, not when
 * this student's activity changes.
 */

const DAY_MS = 86_400_000;

export const ACCURACY_WINDOW_DAYS_DEFAULT = 7;
/** Fewer attempts than this in the window and the percentage is noise, so no point is drawn. */
export const ACCURACY_MIN_ATTEMPTS_DEFAULT = 5;

export interface AccuracyTrendPoint {
  /** YYYY-MM-DD, same date-key convention as analyticsAggregation. */
  date: string;
  /** Trailing-window accuracy for this student, or null when the window is too thin to mean anything. */
  studentPct: number | null;
  /** Same window across every student in the cohort, including this one — the class is the baseline they sit in, not a peer group they are excluded from. */
  cohortPct: number | null;
  studentAttempts: number;
  cohortAttempts: number;
}

const toDateKey = (iso: string): string => iso.slice(0, 10);

interface DayTally {
  total: number;
  correct: number;
}

function tallyByDay(attempts: UserAttempt[]): Map<string, DayTally> {
  const byDay = new Map<string, DayTally>();
  for (const attempt of attempts) {
    const day = toDateKey(attempt.timestamp);
    const tally = byDay.get(day) ?? { total: 0, correct: 0 };
    tally.total += 1;
    if (attempt.correct) tally.correct += 1;
    byDay.set(day, tally);
  }
  return byDay;
}

function windowPct(byDay: Map<string, DayTally>, days: string[], minAttempts: number): [number | null, number] {
  let total = 0;
  let correct = 0;
  for (const day of days) {
    const tally = byDay.get(day);
    if (!tally) continue;
    total += tally.total;
    correct += tally.correct;
  }
  return [total >= minAttempts ? Math.round((correct / total) * 100) : null, total];
}

/**
 * One point per day from the student's first attempt to their last — their
 * own span, not the cohort's, so a chart of someone who stopped three weeks
 * ago ends where they stopped instead of trailing a flat line to today.
 */
export function accuracyTrend(
  studentAttempts: UserAttempt[],
  cohortAttempts: UserAttempt[],
  windowDays: number = ACCURACY_WINDOW_DAYS_DEFAULT,
  minAttempts: number = ACCURACY_MIN_ATTEMPTS_DEFAULT,
): AccuracyTrendPoint[] {
  if (studentAttempts.length === 0) return [];

  const studentByDay = tallyByDay(studentAttempts);
  const cohortByDay = tallyByDay(cohortAttempts);

  const dayKeys = [...studentByDay.keys()].sort();
  const firstDay = Date.parse(`${dayKeys[0]}T00:00:00.000Z`);
  const lastDay = Date.parse(`${dayKeys[dayKeys.length - 1]}T00:00:00.000Z`);
  const dayCount = Math.round((lastDay - firstDay) / DAY_MS) + 1;

  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(firstDay + i * DAY_MS).toISOString().slice(0, 10);
    const window = Array.from({ length: windowDays }, (_, w) =>
      new Date(firstDay + (i - w) * DAY_MS).toISOString().slice(0, 10),
    );
    const [studentPct, studentAttemptsInWindow] = windowPct(studentByDay, window, minAttempts);
    // The cohort line needs a higher bar than one student: a class average drawn
    // off 5 attempts would swing wildly and invite comparisons that aren't real.
    const [cohortPct, cohortAttemptsInWindow] = windowPct(cohortByDay, window, minAttempts * 3);

    return { date, studentPct, cohortPct, studentAttempts: studentAttemptsInWindow, cohortAttempts: cohortAttemptsInWindow };
  });
}

/** Fewest attempts each side of the comparison — below this a "trend" is one bad afternoon. */
export const DELTA_MIN_SLICE = 10;

export interface AccuracyDelta {
  /** Percentage points, last slice minus first. */
  deltaPts: number;
  firstPct: number;
  lastPct: number;
  /** How many attempts each side of the comparison, so the UI can say what it measured. */
  sliceSize: number;
}

/**
 * The headline the chart supports: this student's first attempts against
 * their most recent ones.
 *
 * Measured in ATTEMPTS, not days, unlike the chart above it. The line is a
 * rolling window over dates, which is the right shape to look at but the
 * wrong thing to take a number from: a student who revised once and then
 * stopped for a week has that single session carried across seven days of
 * window, and reading the ends of that reports a swing they never made.
 * Quartiles of their own attempt history have no such artifact — 40 attempts
 * is 40 attempts whether they took an evening or a month.
 */
export function accuracyDeltaByAttempts(attempts: UserAttempt[]): AccuracyDelta | null {
  const sliceSize = Math.floor(attempts.length / 4);
  if (sliceSize < DELTA_MIN_SLICE) return null;

  const chronological = [...attempts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const pct = (slice: UserAttempt[]) => Math.round((slice.filter((a) => a.correct).length / slice.length) * 100);

  const firstPct = pct(chronological.slice(0, sliceSize));
  const lastPct = pct(chronological.slice(-sliceSize));

  return { deltaPts: lastPct - firstPct, firstPct, lastPct, sliceSize };
}
