/**
 * Reviews fall due by the student's own calendar day, from local midnight
 * (owner, 28 Oct 2026). Until then a row was due to the minute: answered at
 * 9pm, it came back at 9pm a day later, so a morning's review never held what
 * the evening before had answered, the count crept up through the day, and the
 * forecast (local days) said "today" before Today counted it.
 *
 * Local means the device's clock, read where the answer is given and where the
 * queue is read. A student who changes time zone sees dates move by the
 * difference, which is the same thing their own calendar does.
 */

/** Local midnight `days` calendar days after `now` — setDate, so a clock change does not shift it an hour. */
export function dueDateAfter(now: Date, days: number): string {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return due.toISOString();
}

/**
 * The last instant of the student's today, for "is it due?": everything dated
 * up to here is due now. Rows written before 28 Oct hold an exact time, and
 * this reads them by their day too, so nothing stored needs rewriting.
 */
export function endOfLocalToday(now: Date = new Date()): string {
  return new Date(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - 1).toISOString();
}

/** Whole calendar days from today to `iso`'s day, local; negative when it is past. */
export function calendarDaysUntil(iso: string, now: Date = new Date()): number {
  const at = new Date(iso);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(at) - day(now)) / 86_400_000);
}
