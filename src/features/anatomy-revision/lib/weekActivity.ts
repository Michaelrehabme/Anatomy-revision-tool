import type { RevisionSessionSummary } from '../types/attempt';

/**
 * The student's week, in the student's own days.
 *
 * "This week" used to bucket sessions by `toISOString().slice(0, 10)`, which
 * is the UTC date, after walking `setDate` in local time — so across a clock
 * change the seven keys could repeat or skip a day, and a session at half
 * past midnight in summer landed on yesterday's bar. The labels were a fixed
 * M T W T F S S while the last bar was always today, so the axis was only
 * right on a Sunday. A day here is the wall-clock day the student studied on,
 * and the label is that day's own name.
 *
 * The streak (lib/streak.ts) keys on the same local day, so the bars and the
 * streak always agree about which day a session belongs to.
 */
export interface WeekDay {
  /** Local calendar date, YYYY-MM-DD. */
  key: string;
  /** One-letter weekday name in the viewer's locale. */
  label: string;
  count: number;
}

export function localDayKey(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The last `days` calendar days ending today, oldest first. */
export function lastDays(now: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
}

export function sessionsPerDay(summaries: readonly RevisionSessionSummary[], now: Date, days = 7): WeekDay[] {
  const counts = new Map<string, number>();
  for (const s of summaries) {
    const key = localDayKey(s.startedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return lastDays(now, days).map((d) => ({
    key: localDayKey(d),
    label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
    count: counts.get(localDayKey(d)) ?? 0,
  }));
}
