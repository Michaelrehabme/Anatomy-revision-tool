import type { Entitlement } from '../../anatomy-revision/lib/entitlement';

/**
 * Who is due a renewal reminder, decided without a database, a clock or an
 * email server. CR-033 item 11; the obligations are mapped in
 * docs/DMCC-SUBSCRIPTIONS.md.
 *
 * WHY THIS EXISTS AT ALL, GIVEN PADDLE SENDS SOME OF THEM. UK law requires an
 * auto-renewal reminder for subscription periods of SIX MONTHS OR LONGER, and
 * Paddle sends those automatically — so the annual plan is covered and nothing
 * here should duplicate it. A second email about the same renewal is not twice
 * as compliant, it is a support question.
 *
 * The monthly plan sits below that line, so Paddle sends nothing, and the
 * incoming DMCC cadence — a reminder before the sixth payment and before every
 * sixth payment after that — is ours to meet. That is what this file decides.
 *
 * THE SIXTH PAYMENT, NOT THE SIXTH MONTH. Somebody who cancels and resubscribes
 * starts again, because their subscription did. The count runs from the start
 * date Paddle gives the subscription, which is stable across renewals.
 */

/** Send the notice this many days before the payment lands. */
export const REMINDER_LEAD_DAYS = 7;

/** Remind before this payment number, and every multiple of it after. */
export const REMINDER_EVERY = 6;

/** Periods of this length or longer are reminded by Paddle, not by us. */
export const PADDLE_HANDLES_FROM_DAYS = 180;

export interface ReminderDue {
  /**
   * Stable id for this notice, e.g. `sub_123:6`. Written to the user when the
   * notice is sent, and checked before sending: it is what stops a second run
   * on the same day emailing somebody twice, and it is the audit record.
   */
  key: string;
  /** Which payment is coming — the 6th, 12th, 18th. */
  paymentNumber: number;
  /** ISO, when that payment is taken. */
  chargeAt: string;
}

export type ReminderDecision =
  | { due: true; reminder: ReminderDue }
  | { due: false; reason: string };

/**
 * Whether this entitlement needs a reminder from us today.
 *
 * Deliberately conservative: anything it cannot work out with certainty is
 * `due: false` with a reason. A missing reminder is a compliance gap that the
 * log makes visible; a wrong one is an email telling a student about a payment
 * that is not coming, which costs their trust and our support time.
 */
export function reminderDue(entitlement: Entitlement | null | undefined, now: Date): ReminderDecision {
  if (!entitlement || entitlement.tier === 'free') return { due: false, reason: 'no paid entitlement' };
  if (entitlement.source !== 'paddle') return { due: false, reason: `${entitlement.source} does not bill through us` };
  if (entitlement.interval === 'year') return { due: false, reason: 'Paddle reminds for periods of six months or more' };
  if (entitlement.interval !== 'month') return { due: false, reason: 'billing interval unknown' };

  const { expiresAt, startedAt, externalId } = entitlement;
  if (!expiresAt || !startedAt) return { due: false, reason: 'missing period or start date' };

  const chargeMs = Date.parse(expiresAt);
  const startMs = Date.parse(startedAt);
  if (Number.isNaN(chargeMs) || Number.isNaN(startMs)) return { due: false, reason: 'unreadable dates' };

  // A lapsed subscription is not renewing, so there is nothing to warn about.
  if (chargeMs <= now.getTime()) return { due: false, reason: 'period has already ended' };

  const daysUntilCharge = (chargeMs - now.getTime()) / 86_400_000;
  if (daysUntilCharge > REMINDER_LEAD_DAYS) return { due: false, reason: 'too early' };

  // The payment about to be taken closes the current period, so it is one more
  // than the number of whole periods already paid.
  const paymentNumber = monthsBetween(startMs, chargeMs);
  if (paymentNumber < REMINDER_EVERY) return { due: false, reason: `payment ${paymentNumber} is before the ${REMINDER_EVERY}th` };
  if (paymentNumber % REMINDER_EVERY !== 0) return { due: false, reason: `payment ${paymentNumber} is not a multiple of ${REMINDER_EVERY}` };

  return {
    due: true,
    reminder: { key: `${externalId ?? 'sub'}:${paymentNumber}`, paymentNumber, chargeAt: expiresAt },
  };
}

/**
 * Whole months from one instant to another, rounded to the nearest month.
 *
 * Rounding rather than flooring on purpose: monthly periods are 28 to 31 days,
 * so by the twelfth payment a floor would have drifted a payment behind and
 * the sixth reminder would go out before the seventh charge.
 */
function monthsBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / (86_400_000 * 30.436_875));
}

/** The notice itself. Plain text, because a reminder nobody can read in a preview pane is not a reminder. */
export function reminderEmail(reminder: ReminderDue, opts: { price: string; manageUrl: string }): {
  subject: string;
  text: string;
} {
  const when = new Date(reminder.chargeAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return {
    subject: `Your LocusMSK subscription renews on ${when}`,
    text: [
      'This is a reminder, not a bill.',
      '',
      `Your LocusMSK subscription renews on ${when}, when ${opts.price} will be taken as usual.`,
      'You do not need to do anything if you want it to continue.',
      '',
      'If you would rather stop, you can cancel here:',
      opts.manageUrl,
      '',
      'Cancelling costs nothing, and you keep access until the end of the period you have already',
      'paid for. We send this every six months so a subscription you have forgotten about never',
      'renews without you knowing.',
      '',
      'LocusMSK · locusmsk.co.uk',
    ].join('\n'),
  };
}
