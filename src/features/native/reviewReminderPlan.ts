import type { FactMastery, StructureMastery } from '../anatomy-revision/types/attempt';
import { buildReviewQueue } from '../anatomy-revision/lib/reviewQueue';

/**
 * WHEN to remind, and what to say. Pure, so it is tested without a phone.
 *
 * "Due" is not redefined here. The count comes from buildReviewQueue — the
 * same function the Today screen's "N due" reads — asked about a moment in the
 * future instead of now. A reminder that counted differently from the screen
 * it opens would say "12 reviews are due" above a Today that says 9.
 *
 * ONE A DAY, AT A FIXED HOUR, AND ONLY WHEN SOMETHING IS DUE. Scheduling at
 * each item's own due time would fire at 03:12 because that is 24 hours after
 * somebody revised at 03:12. A fixed early-evening slot is when the notice is
 * useful, and one a day is the difference between a reminder and a nag.
 */
export const REMINDER_HOUR = 18;

/** How far ahead to look for a day with something due. Past this, no reminder is set. */
export const REMINDER_HORIZON_DAYS = 14;

export interface ReminderPlan {
  at: Date;
  /** Question types due by then. */
  count: number;
  title: string;
  body: string;
}

export function reminderBody(count: number): string {
  return count === 1 ? '1 review is due.' : `${count} reviews are due.`;
}

/**
 * The next reminder, or null when nothing falls due inside the horizon.
 *
 * Walks the daily slots from the next one, and stops at the first by which at
 * least one review is due. The slot is in the device's local time: the Date
 * constructor below builds it from local calendar fields, so 18:00 is 18:00
 * on either side of a clock change.
 */
export function planReviewReminder(
  mastery: readonly StructureMastery[],
  facts: readonly FactMastery[],
  eligible: ReadonlySet<string>,
  now: Date = new Date(),
): ReminderPlan | null {
  for (let day = 0; day <= REMINDER_HORIZON_DAYS; day += 1) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, REMINDER_HOUR, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const count = buildReviewQueue(mastery, facts, eligible, at).due.length;
    if (count > 0) return { at, count, title: 'LocusMSK', body: reminderBody(count) };
  }
  return null;
}
