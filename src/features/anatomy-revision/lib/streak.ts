import type { RevisionSessionSummary } from '../types/attempt';
import { localDayKey } from './weekActivity';

/**
 * The student's own calendar day (YYYY-MM-DD, local time) for a timestamp.
 * Exported for lib/streakFreeze.ts.
 *
 * This was the UTC date, so in British summer time a session at half past
 * midnight counted for the day before, and "This week" (lib/weekActivity.ts,
 * local) and the streak could disagree about which day a student studied.
 * Keys stored before the change are UTC dates; they differ only for sessions
 * started within an hour of midnight, so they are left as they are.
 */
export function toDayKey(iso: string): string {
  return localDayKey(iso);
}

/**
 * A day-key moved by whole days: calendar arithmetic on the key itself, done
 * in UTC so a clock change can never make a day 23 or 25 hours long.
 */
export function shiftDayKey(dayKey: string, delta: number): string {
  const d = new Date(Date.parse(`${dayKey}T00:00:00.000Z`));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(a) - Date.parse(b)) / msPerDay);
}

/**
 * Consecutive-day streak ending today or yesterday (a day not yet studied
 * doesn't break a streak until it's actually over), from a raw set of
 * studied day-keys. Factored out of computeStreak so lib/streakFreeze.ts can
 * run the same walk over a (studied ∪ frozen) day-set without duplicating
 * it — this function's behavior is exercised indirectly by every
 * computeStreak test below, so treat it with the same care.
 */
export function computeStreakFromDayKeys(days: Set<string>, now: Date = new Date()): number {
  if (days.size === 0) return 0;

  const todayKey = toDayKey(now.toISOString());
  const mostRecent = [...days].sort().at(-1)!;
  if (daysBetween(todayKey, mostRecent) > 1) return 0; // streak lapsed

  let streak = 0;
  let cursor = mostRecent;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/**
 * Consecutive-day streak ending today or yesterday. Built from
 * listSessionSummaries — no dedicated per-day log needed, since every
 * finished session already carries a startedAt.
 */
export function computeStreak(summaries: RevisionSessionSummary[], now: Date = new Date()): number {
  const days = new Set(summaries.map((s) => toDayKey(s.startedAt)));
  return computeStreakFromDayKeys(days, now);
}

/**
 * How many session summaries a screen reads to show the streak: the same 400
 * the end of a session reads, and the number the Firestore repository fetches
 * once per visit anyway, so asking for all of them costs nothing more.
 *
 * TODAY READ 30 AND PROGRESS 60, and the streak is counted in DAYS from a
 * list capped in SESSIONS. A student doing three sessions a day could not see
 * a streak past ten on Today, while the end of a session showed the true
 * figure (owner's report, 16 October 2026).
 */
export const STREAK_SESSION_LIMIT = 400;

/**
 * The streak every screen shows: studied days plus the days a streak freeze
 * covered. The end of a session counted freezes and every other screen did
 * not, so a spent freeze showed "11-day streak" on Results and 1 on Today.
 */
export function streakWithFreezes(
  summaries: RevisionSessionSummary[],
  frozenDayKeys: readonly string[] = [],
  now: Date = new Date(),
): number {
  const days = new Set(summaries.map((s) => toDayKey(s.startedAt)));
  for (const key of frozenDayKeys) days.add(key);
  return computeStreakFromDayKeys(days, now);
}
