/**
 * The one rule about deleting an account that has nothing to do with deleting:
 * will this subscription charge again?
 *
 * Kept apart from data/accountLifecycle.ts, which performs the deletion, so
 * that it imports nothing. accountLifecycle pulls in the Firebase SDK, and a
 * test that only wanted this function had to load all of it first — several
 * seconds on a cold cache with the rest of the suite running, which is how a
 * test of a ten-line pure function came to time out.
 */

/**
 * Whether the stored entitlement is a Paddle subscription that WILL CHARGE
 * AGAIN — the one thing that makes deleting an account unsafe.
 *
 * Deleting then was the paywall trace's finding 5: nothing cancels in Paddle,
 * so the renewal still charges, and the account that could have cancelled it
 * is gone.
 *
 * THE QUESTION IS "WILL IT CHARGE", NOT "IS THERE PAID TIME LEFT". It used to
 * be the second, and that kept a student who had already cancelled waiting
 * out the rest of the period before they could delete their data — while the
 * privacy policy told them deletion was theirs at any time. A cancelled
 * subscription charges nothing more, so there is nothing to protect them
 * from; they lose the paid time they chose to walk away from, which the
 * confirmation says.
 *
 *  - `cancelAt` present: cancelled, by them or by Paddle. Never live.
 *  - otherwise, time still to run or yet to start: it renews. Live. That
 *    includes the days of grace after a failed renewal (PAYMENT_GRACE_DAYS):
 *    Paddle is still trying the card.
 *  - otherwise, `paymentIssueSince` or `refundedAt`: access has stopped but
 *    the subscription has not — Paddle is still retrying the card, or a
 *    refund left it running to its next renewal. Live.
 *  - otherwise it ran out and nothing says it is coming back. Not live.
 *
 * These fields are written by the payment webhook
 * (billing/lib/paddleWebhook.ts) and cannot be written by the student
 * (firestore.rules), so marking oneself "cancelled" to get past this is not
 * available. A subscription cancelled before `cancelAt` existed has none
 * until Paddle's next event for it, and is treated as it always was.
 */
export function hasLiveSubscription(rawEntitlement: unknown, now: Date = new Date()): boolean {
  const entries = Array.isArray(rawEntitlement) ? rawEntitlement : [rawEntitlement];
  return entries.some((e) => {
    if (!e || typeof e !== 'object') return false;
    const { source, tier, expiresAt, cancelAt, paymentIssueSince, refundedAt } = e as Record<string, unknown>;
    if (source !== 'paddle' || tier === 'free') return false;
    if (typeof cancelAt === 'string') return false;
    if (expiresAt == null || (typeof expiresAt === 'string' && Date.parse(expiresAt) > now.getTime())) return true;
    return typeof paymentIssueSince === 'string' || typeof refundedAt === 'string';
  });
}

/** Said when deletion is refused. Names the control as the account screen labels it. */
export const SUBSCRIPTION_STILL_RENEWS =
  'Your subscription is still set to renew, and would keep charging after your account is gone. ' +
  'Cancel it first, under "Manage or cancel your subscription". You can then delete your account ' +
  'straight away, without waiting for the time you have paid for to run out.';
