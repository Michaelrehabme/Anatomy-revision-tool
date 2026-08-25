import type { RevisionSessionSummary } from '../types/attempt';

function toDayKey(iso: string): string {
  return iso.slice(0, 10); // ISO date is lexically sortable, so string slicing is enough
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(a) - Date.parse(b)) / msPerDay);
}

/**
 * Consecutive-day streak ending today or yesterday (a day not yet studied
 * doesn't break a streak until it's actually over). Built from
 * listSessionSummaries — no dedicated per-day log needed, since every
 * finished session already carries a startedAt.
 */
export function computeStreak(summaries: RevisionSessionSummary[], now: Date = new Date()): number {
  const days = new Set(summaries.map((s) => toDayKey(s.startedAt)));
  if (days.size === 0) return 0;

  const todayKey = toDayKey(now.toISOString());
  const mostRecent = [...days].sort().at(-1)!;
  if (daysBetween(todayKey, mostRecent) > 1) return 0; // streak lapsed

  let streak = 0;
  const cursor = new Date(Date.parse(`${mostRecent}T00:00:00.000Z`));
  while (days.has(toDayKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
