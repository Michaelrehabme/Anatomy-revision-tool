import { createHmac, timingSafeEqual } from 'node:crypto';
import { PAYMENT_GRACE_DAYS, type Entitlement } from '../../anatomy-revision/lib/entitlement';

/**
 * Paddle webhooks: prove the call came from Paddle, then turn it into an
 * entitlement. The two halves of the only code in this product that grants
 * paid access, so both are pure functions with tests of their own, and the
 * Netlify Function around them is as thin as it can be made.
 *
 * WHY SIGNATURE VERIFICATION IS NOT OPTIONAL. The webhook URL is public by
 * necessity. Without verification, anybody who found it could POST a
 * well-formed `subscription.activated` for their own account and have a year
 * of access for the price of a curl command. The signature is the entire
 * difference between a payment integration and an open door.
 *
 * Header format re-checked against Paddle's documentation on 5 October 2026
 * (https://developer.paddle.com/webhooks/signature-verification):
 * `Paddle-Signature: ts=<unix seconds>;h1=<hex HMAC-SHA256>`, signed over
 * `${ts}:${rawBody}` with the notification destination's secret key. The
 * same page warns that "during secret rotation, more than one `h1` is
 * returned"; this reads the last one, so a rotation needs testing first. If
 * the format changes, every real webhook fails verification, which is the
 * safe way for this to be wrong.
 */

/** Reject signatures older than this. Stops a captured request being replayed later. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export interface VerifyResult {
  ok: boolean;
  /** Why it failed, for the log — never returned to the caller over HTTP. */
  reason?: string;
}

/**
 * Whether `rawBody` was signed by Paddle with `secret`.
 *
 * MUST be given the raw request body, byte for byte. A body that has been
 * parsed and re-serialised will almost never reproduce Paddle's exact bytes,
 * and the signature will fail on every genuine event.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!secret) return { ok: false, reason: 'no webhook secret configured' };
  if (!header) return { ok: false, reason: 'missing Paddle-Signature header' };

  const parts = new Map<string, string>();
  for (const pair of header.split(';')) {
    const i = pair.indexOf('=');
    if (i > 0) parts.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }

  const ts = parts.get('ts');
  const h1 = parts.get('h1');
  if (!ts || !h1) return { ok: false, reason: 'malformed signature header' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'non-numeric timestamp' };
  if (Math.abs(nowSeconds - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'signature outside the replay window' };
  }

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');

  // Constant-time comparison. A plain === leaks, through timing, how many
  // leading characters of a forged signature were right.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(h1, 'hex');
  if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

// ---------------------------------------------------------------------------
// Events → entitlement
// ---------------------------------------------------------------------------

/** The slice of a Paddle subscription this integration reads. */
export interface PaddleSubscription {
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';
  /**
   * Paddle's id for the buyer, kept so the account screen can open their
   * portal — where they cancel or change a card. /refunds promises they can
   * cancel whenever they like, and a promise that requires emailing us is a
   * promise we keep by hand until we forget to.
   */
  customer_id?: string | null;
  /** When the subscription first began. Stable across renewals, unlike the billing period. */
  started_at?: string | null;
  /** How often it bills. Paddle sends this as e.g. { interval: 'month', frequency: 1 }. */
  billing_cycle?: { interval?: string; frequency?: number } | null;
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  canceled_at?: string | null;
  /**
   * A change Paddle will make later. A cancellation from the customer portal
   * arrives as `{ action: 'cancel', effective_at: <end of the period> }` on a
   * `subscription.updated` while the status is still `active`; removing it
   * sends another update with this null again.
   * https://developer.paddle.com/build/subscriptions/cancel-subscriptions
   */
  scheduled_change?: { action?: string; effective_at?: string | null; resume_at?: string | null } | null;
  custom_data?: Record<string, unknown> | null;
}

export interface PaddleEvent {
  event_type: string;
  event_id?: string;
  occurred_at?: string;
  data: PaddleSubscription;
}

/** What the webhook should do, decided without touching any database. */
export type WebhookAction =
  | { kind: 'grant'; uid: string; entitlement: Entitlement; consent: ConsentRecord | null; customerId: string | null }
  | { kind: 'ignore'; reason: string };

/**
 * Whether an event already stored is NEWER than the one in hand.
 *
 * Paddle does not promise ordering — "We can't guarantee the order of
 * delivery for webhooks" — and tells integrators to "store and check the
 * `occurred_at` date against a webhook before making changes"
 * (https://developer.paddle.com/webhooks/respond-to-webhooks). Retries make
 * it worse: 60 over three days on a live destination. An old
 * `subscription.updated` can land after the `subscription.canceled` that
 * superseded it, and would silently hand a cancelled student another year.
 *
 * Only strictly newer counts. The same event delivered twice has the same
 * time, is applied again, and writes the same thing.
 */
export function isStale(current: Record<string, unknown> | undefined, eventAt: string): boolean {
  const storedAt = typeof current?.eventAt === 'string' ? current.eventAt : null;
  return storedAt !== null && storedAt > eventAt;
}

/**
 * The entitlement map a subscription event leaves on the account, or 'stale'
 * when a newer event has already been applied.
 *
 * The map is REPLACED, not merged into. A merge kept whatever the new event
 * did not mention — a refunded delayed-start plan's future `startsAt` would
 * then lock the next, immediate one (finding 13). Fields are carried over on
 * purpose when this event lacks them:
 *  - consent rides INSIDE the entitlement map because firestore.rules makes
 *    the whole map immutable to clients, so the evidence a disputed refund
 *    turns on cannot be edited by the person disputing it; a renewal event
 *    without it must not erase it;
 *  - customerId, kept even on a cancellation, because a former subscriber
 *    still needs the portal to see their invoices;
 *  - paymentIssueSince, when the SAME subscription was already past due: the
 *    message says since when, and a second event during Paddle's retries must
 *    not move that date forward;
 *  - expiresAt, on a past-due event only, for the SAME subscription, so
 *    that the grace is given once and from the right place:
 *      already flagged past due -> the stored date stands if it is earlier.
 *        The grace was set by the first failure; an event a month into
 *        Paddle's retries, by when the unpaid period has itself run out,
 *        would otherwise work out a later "paid-for end" and grant three
 *        fresh days.
 *      not yet flagged, stored expiry earlier than this event's date -> no
 *        later than the stored expiry plus the grace. The stored expiry is
 *        what earlier, paid events said was paid for; a first past-due event
 *        that arrives late gets the same bound as one that arrives on time.
 *    A past-due event may always pull a date BACK — as when an `active`
 *    event carrying the unpaid period got in first.
 * Nothing else survives — in particular `refundedAt`, `cancelAt` and an
 * earlier `paymentIssueSince` all go the moment an event without them
 * arrives, which is how "active again" clears them.
 */
export function nextEntitlement(
  current: Record<string, unknown> | undefined,
  action: Extract<WebhookAction, { kind: 'grant' }>,
  eventAt: string,
): 'stale' | Record<string, unknown> {
  if (isStale(current, eventAt)) return 'stale';
  const consent = action.consent ?? current?.consent;
  const customerId = action.customerId ?? current?.customerId;
  const since = action.entitlement.paymentIssueSince;
  const earlier =
    since && current?.externalId === action.entitlement.externalId && typeof current?.paymentIssueSince === 'string'
      ? current.paymentIssueSince
      : undefined;
  const paymentIssueSince = since && earlier && earlier < since ? earlier : since;
  const sameSubscription = current?.source === 'paddle' && current?.externalId === action.entitlement.externalId;
  const storedExpiry = typeof current?.expiresAt === 'string' ? Date.parse(current.expiresAt) : NaN;
  const nextExpiry = action.entitlement.expiresAt ? Date.parse(action.entitlement.expiresAt) : NaN;
  let expiresAt = action.entitlement.expiresAt;
  if (since && sameSubscription && !Number.isNaN(storedExpiry) && !Number.isNaN(nextExpiry) && storedExpiry < nextExpiry) {
    const alreadyFlagged = typeof current?.paymentIssueSince === 'string';
    const bound = alreadyFlagged ? storedExpiry : Date.parse(graceEnd(storedExpiry));
    if (bound < nextExpiry) expiresAt = alreadyFlagged ? (current?.expiresAt as string) : graceEnd(storedExpiry);
  }
  return Object.fromEntries(
    Object.entries({ ...action.entitlement, expiresAt, paymentIssueSince, eventAt, consent, customerId }).filter(
      ([, v]) => v !== undefined,
    ),
  );
}

/**
 * The cooling-off consent taken at checkout. Stored beside the entitlement,
 * because if a refund is ever disputed the question is whether this consent
 * was given, and "the page had a checkbox" is not evidence.
 */
export interface ConsentRecord {
  coolingOffWaived: boolean;
  /** When the student ticked it, as reported by their browser. */
  agreedAt: string | null;
  /** The wording version, so a later rewording does not rewrite history. */
  wordingVersion: string | null;
}

/** The statutory cancellation window a student keeps by declining the waiver. */
export const COOLING_OFF_DAYS = 14;

/**
 * When access begins for a student who kept their 14-day right.
 *
 * /refunds promises that leaving the waiver unticked delays the start by 14
 * days rather than refusing the sale. Counted from when the subscription
 * STARTED, not from the current billing period: the period moves on every
 * renewal, and counting from it would hand a monthly subscriber a fresh
 * two-week lockout every month.
 */
function delayedStart(sub: PaddleSubscription, consent: ConsentRecord | null): string | undefined {
  if (!consent || consent.coolingOffWaived) return undefined;
  const from = sub.started_at ?? consent.agreedAt ?? sub.current_billing_period?.starts_at ?? null;
  const at = from ? Date.parse(from) : NaN;
  if (Number.isNaN(at)) return undefined;
  return new Date(at + COOLING_OFF_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** When the grace after a failed renewal runs out, given when the paid time did. */
export function graceEnd(paidToMs: number): string {
  return new Date(paidToMs + PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

const HANDLED = new Set([
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.trialing',
  'subscription.past_due',
  'subscription.canceled',
  'subscription.resumed',
]);

function readConsent(custom: Record<string, unknown> | null | undefined): ConsentRecord | null {
  if (!custom || typeof custom.coolingOffWaived !== 'boolean') return null;
  return {
    coolingOffWaived: custom.coolingOffWaived,
    agreedAt: typeof custom.consentAt === 'string' ? custom.consentAt : null,
    wordingVersion: typeof custom.consentVersion === 'string' ? custom.consentVersion : null,
  };
}

/**
 * How often the subscription bills, and when it started — the two things the
 * renewal reminders need and `expiresAt` cannot tell them.
 *
 * Paddle states the cycle outright, but a period that is present and a cycle
 * that is missing still answers the question, so fall back to measuring the
 * period. Anything under 180 days is the monthly plan for our purposes, which
 * is also the line UK law draws for who has to send the reminder.
 */
function billingShape(sub: PaddleSubscription): { interval?: 'month' | 'year'; startedAt?: string } {
  const out: { interval?: 'month' | 'year'; startedAt?: string } = {};
  if (sub.started_at) out.startedAt = sub.started_at;

  const stated = sub.billing_cycle?.interval;
  if (stated === 'month' || stated === 'year') {
    out.interval = stated;
    return out;
  }

  const period = sub.current_billing_period;
  if (period?.starts_at && period.ends_at) {
    const days = (Date.parse(period.ends_at) - Date.parse(period.starts_at)) / 86_400_000;
    if (Number.isFinite(days) && days > 0) out.interval = days >= 180 ? 'year' : 'month';
  }
  return out;
}

/**
 * Decide what a verified Paddle event means for access.
 *
 * THE RULE THE OWNER SET: cancel whenever you like, for nothing, and keep
 * access until the period you paid for runs out. So `expiresAt` is always the
 * end of the CURRENT billing period, whatever the status. A renewal arrives as
 * a new event carrying a later period and extends it. A cancellation simply
 * stops the next renewal from arriving, and access runs out on the date that
 * was always going to end it. Nothing here ever cuts somebody off early for
 * cancelling.
 *
 * The only things that end access early are Paddle itself saying the
 * subscription is cancelled with an effective time now, and an approved full
 * refund of the latest payment (adjustmentActionForEvent, below).
 *
 * A FAILED RENEWAL DOES NOT BUY A PERIOD. While `past_due`, Paddle's
 * `current_billing_period` is already the period that has NOT been paid for:
 * its documented `subscription.past_due` example is a subscription started
 * 12 April, past due on 12 May, with a period of 12 May to 12 June
 * (https://developer.paddle.com/webhooks/subscriptions/subscription-past-due).
 * Granting to the end of that handed out a month — or a year — nobody had
 * paid for, for as long as Paddle kept retrying the card (30 days by default,
 * https://developer.paddle.com/build/retain/configure-payment-recovery-dunning).
 *
 * THE RULE (owner, 5 October 2026): a failed renewal keeps full access for
 * PAYMENT_GRACE_DAYS after the end of the time that was paid for, and not a
 * day longer. `expiresAt` = paid-for end + grace.
 *
 * WHICH FIELD IS "THE END OF THE TIME PAID FOR". Paddle does not state it
 * while past due, so it is read from `current_billing_period` against the
 * time of the event:
 *   - the period contains the event (the documented shape: Paddle has already
 *     moved on to the unpaid period) -> its `starts_at`, which is where the
 *     paid period ended;
 *   - the period ended at or before the event (Paddle had not moved it on)
 *     -> its `ends_at`.
 * Never the event's own time, so a second or tenth past-due event works out
 * the same date and cannot start the three days again; and never the unpaid
 * period's end. (A period wholly in the future fits neither shape; the event
 * time is then the only anchor there is.) nextEntitlement adds the bound
 * that needs the stored map: once an account is flagged, no later past-due
 * event moves its date forward at all.
 *
 * Access beyond the grace returns with the next `active` event, which
 * carries the paid period and replaces all of this. `paymentIssueSince` is
 * what lets the app say why (PaymentIssueNotice.tsx).
 *
 * `custom_data.uid` is used to FIND the account and for nothing else. It was
 * set by the browser at checkout, so it is not trusted to say what anybody is
 * entitled to — that comes from the signed event alone. The worst a forged uid
 * can do is pay for somebody else's account.
 */
export function actionForEvent(event: PaddleEvent, now: Date = new Date()): WebhookAction {
  if (!HANDLED.has(event.event_type)) {
    return { kind: 'ignore', reason: `unhandled event ${event.event_type}` };
  }

  const sub = event.data;
  const uid = sub.custom_data?.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    // Nobody to grant it to. Loud in the log, because a real payment with no
    // uid is a customer who paid and got nothing, and that needs a person.
    return { kind: 'ignore', reason: `subscription ${sub.id} carries no uid in custom_data` };
  }

  const consent = readConsent(sub.custom_data);
  const startsAt = delayedStart(sub, consent);
  const billing = billingShape(sub);
  const period = sub.current_billing_period ?? null;
  const periodEnd = period?.ends_at ?? null;

  if (sub.status === 'canceled') {
    // Canceled means Paddle has stopped it. For an end-of-period cancellation
    // that moment IS the period end; for a refund it is now. Either way the
    // effective time is when access should stop, and never later than now.
    const stopAt = sub.canceled_at ?? now.toISOString();
    const effective = Date.parse(stopAt) < now.getTime() ? stopAt : now.toISOString();
    return {
      kind: 'grant',
      uid,
      consent,
      customerId: sub.customer_id ?? null,
      // cancelAt is what lets the account screen say "ended" and "will not
      // renew" instead of guessing from a date (finding 8).
      entitlement: { tier: 'individual', source: 'paddle', expiresAt: effective, externalId: sub.id, cancelAt: effective },
    };
  }

  if (!periodEnd) {
    return { kind: 'ignore', reason: `subscription ${sub.id} has no billing period to grant against` };
  }

  // By STATUS, not event type: `subscription.updated` also arrives while a
  // subscription is past due, and must not undo what `subscription.past_due`
  // wrote.
  if (sub.status === 'past_due') {
    const failedAt = event.occurred_at ?? now.toISOString();
    const failedMs = Date.parse(failedAt);
    const endedBeforeFailure = Date.parse(periodEnd) <= failedMs;
    const boundary = endedBeforeFailure ? periodEnd : period?.starts_at;
    if (!boundary) {
      return { kind: 'ignore', reason: `past-due subscription ${sub.id} has no period start to hold access at` };
    }
    // A boundary still ahead of the event, or unreadable, is not a date
    // anything was paid up to; the failure itself is then the anchor.
    const boundaryMs = Date.parse(boundary);
    const paidToMs = Number.isNaN(boundaryMs) || boundaryMs > failedMs ? failedMs : boundaryMs;
    const paidThrough = graceEnd(paidToMs);
    // Cancelled from the portal while the payment is outstanding: still
    // recorded, so the account screen and the deletion rule know it will not
    // charge again.
    const scheduledCancel = sub.scheduled_change?.action === 'cancel' && typeof sub.scheduled_change.effective_at === 'string'
      ? sub.scheduled_change.effective_at
      : undefined;
    return {
      kind: 'grant',
      uid,
      consent,
      customerId: sub.customer_id ?? null,
      entitlement: {
        tier: 'individual',
        source: 'paddle',
        expiresAt: paidThrough,
        externalId: sub.id,
        // The cycle Paddle states, never one measured from the unpaid period.
        ...billing,
        ...(startsAt ? { startsAt } : {}),
        paymentIssueSince: failedAt,
        ...(scheduledCancel ? { cancelAt: scheduledCancel } : {}),
      },
    };
  }

  // A cancellation from the portal is SCHEDULED: status stays `active`, the
  // period is unchanged, and `scheduled_change` says when it stops. Access is
  // untouched — cancel whenever you like, keep what you paid for — and the
  // date is kept so the app can say it ends rather than renews.
  const scheduled = sub.scheduled_change;
  const cancelAt = scheduled?.action === 'cancel' && typeof scheduled.effective_at === 'string'
    ? scheduled.effective_at
    : undefined;

  // active, trialing and paused keep access to the end of the period covered.
  return {
    kind: 'grant',
    uid,
    consent,
    customerId: sub.customer_id ?? null,
    entitlement: {
      tier: 'individual',
      source: 'paddle',
      expiresAt: periodEnd,
      externalId: sub.id,
      ...billing,
      ...(startsAt ? { startsAt } : {}),
      ...(cancelAt ? { cancelAt } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * The slice of a Paddle adjustment this integration reads. Field names and
 * values from https://developer.paddle.com/webhooks/adjustments/adjustment-created
 * and .../adjustment-updated, read on 5 October 2026.
 *
 * AN ADJUSTMENT CARRIES NO custom_data. A subscription event names the
 * account in `custom_data.uid`; an adjustment names only Paddle's own ids —
 * the transaction, the subscription (null for a one-off sale) and the
 * customer. The account is therefore found by the subscription id the
 * webhook stored as `entitlement.externalId`, and by nothing looser.
 */
export interface PaddleAdjustment {
  id: string;
  /** credit | refund | chargeback | chargeback_reverse | chargeback_warning | chargeback_warning_reverse | credit_reverse */
  action: string;
  /** `full`: "Grand total for the related transaction is adjusted". `partial`: some of it. */
  type?: 'full' | 'partial' | string | null;
  /** pending_approval | approved | rejected | reversed */
  status: string;
  transaction_id: string;
  subscription_id?: string | null;
  customer_id?: string | null;
  reason?: string | null;
}

export interface PaddleAdjustmentEvent {
  event_type: string;
  event_id?: string;
  occurred_at?: string;
  data: PaddleAdjustment;
}

/**
 * `adjustment.created` fires when a refund is asked for; "most refunds for
 * live accounts require Paddle approval and are created as pending_approval",
 * and `adjustment.updated` fires when one moves to `approved` or `rejected`.
 * Small refunds on a verified account can be approved at creation, so both
 * events are read the same way and only the status decides.
 */
export const ADJUSTMENT_EVENTS: ReadonlySet<string> = new Set(['adjustment.created', 'adjustment.updated']);

export interface AdjustmentIds {
  adjustmentId: string;
  transactionId: string;
  subscriptionId: string | null;
  customerId: string | null;
}

export type AdjustmentAction =
  /** Nothing to do, and nothing anybody needs to look at. */
  | { kind: 'ignore'; reason: string }
  /** A full, approved refund of a subscription payment: end access IF it was the latest payment. */
  | ({ kind: 'refund'; subscriptionId: string } & Omit<AdjustmentIds, 'subscriptionId'>)
  /** Money has moved and this code will not decide what it means: put it in front of the owner. */
  | ({ kind: 'review'; reason: string } & AdjustmentIds);

/**
 * Decide what a verified adjustment event means, without a database.
 *
 * THE RULE: access ends when a FULL refund is APPROVED. /refunds promises an
 * annual plan refunded in full within 14 days, and somebody who has their
 * money back should not also keep the year (paywall trace finding 9: a refund
 * alone used to leave access in place until the period ran out).
 *
 * Everything short of that changes nothing:
 *  - `pending_approval` — Paddle has not agreed to it yet;
 *  - `rejected` or `reversed` — it did not happen, or was undone;
 *  - `partial` — a goodwill part-refund is not the student giving the
 *    subscription back;
 *  - `credit` — a credit against a later bill, not money returned.
 *
 * A CHARGEBACK IS NOT DECIDED HERE. It is a dispute, it can be reversed, and
 * cutting off a student whose bank made a mistake is not this code's call. It
 * is recorded for the owner instead.
 */
export function adjustmentActionForEvent(event: PaddleAdjustmentEvent): AdjustmentAction {
  if (!ADJUSTMENT_EVENTS.has(event.event_type)) {
    return { kind: 'ignore', reason: `unhandled event ${event.event_type}` };
  }
  const adj = event.data;
  if (!adj || typeof adj.id !== 'string' || typeof adj.transaction_id !== 'string') {
    return { kind: 'ignore', reason: 'adjustment without an id or a transaction' };
  }
  const ids: AdjustmentIds = {
    adjustmentId: adj.id,
    transactionId: adj.transaction_id,
    subscriptionId: typeof adj.subscription_id === 'string' && adj.subscription_id ? adj.subscription_id : null,
    customerId: typeof adj.customer_id === 'string' ? adj.customer_id : null,
  };

  if (adj.action === 'chargeback' || adj.action === 'chargeback_warning') {
    return { kind: 'review', reason: `${adj.action} (${adj.status}): a payment is disputed. Nothing was changed; decide by hand.`, ...ids };
  }
  if (adj.action !== 'refund') return { kind: 'ignore', reason: `adjustment ${adj.id} is a ${adj.action}, not a refund` };
  if (adj.status !== 'approved') return { kind: 'ignore', reason: `refund ${adj.id} is ${adj.status}, not approved` };
  if (adj.type !== 'full') return { kind: 'ignore', reason: `refund ${adj.id} is ${adj.type ?? 'of unstated type'}, not full` };

  if (!ids.subscriptionId) {
    return { kind: 'review', reason: 'full refund approved for a transaction with no subscription: no account can be matched to it.', ...ids };
  }
  return { kind: 'refund', ...ids, subscriptionId: ids.subscriptionId };
}

/** The slice of a Paddle transaction read to tell which payment is the latest. */
export interface PaddleTransactionSummary {
  id: string;
  /** draft | ready | billed | paid | completed | canceled | past_due */
  status?: string | null;
  /** api | subscription_charge | subscription_payment_method_change | subscription_recurring | subscription_update | web */
  origin?: string | null;
  subscription_id?: string | null;
  billed_at?: string | null;
}

/**
 * Whether `transactionId` is the most recent PAYMENT on the subscription.
 *
 * A full refund of last March's payment, issued in October as goodwill, must
 * not end the month the student paid for last week. The adjustment says which
 * transaction was refunded and nothing about where it sits in the
 * subscription's history, so the webhook asks Paddle for the subscription's
 * transactions (https://developer.paddle.com/api-reference/transactions/list-transactions)
 * and this decides.
 *
 * A payment is a transaction that took money: `completed`, or `paid` ("fully
 * paid, but has not yet been processed internally"). A card change creates a
 * transaction too (`subscription_payment_method_change`) and is not one.
 *
 * 'unknown' whenever it cannot be shown either way — the refunded transaction
 * is not in the list, or a date is missing. The caller treats that as "do
 * nothing and tell the owner".
 */
export function isLatestPayment(
  transactions: readonly PaddleTransactionSummary[],
  transactionId: string,
  subscriptionId: string,
): 'latest' | 'older' | 'unknown' {
  const payments = transactions.filter(
    (t) =>
      t.subscription_id === subscriptionId &&
      (t.status === 'completed' || t.status === 'paid') &&
      t.origin !== 'subscription_payment_method_change',
  );
  const refunded = payments.find((t) => t.id === transactionId);
  if (!refunded) return 'unknown';
  if (payments.some((t) => typeof t.billed_at !== 'string' || Number.isNaN(Date.parse(t.billed_at)))) return 'unknown';
  const refundedAt = Date.parse(refunded.billed_at as string);
  return payments.some((t) => t.id !== transactionId && Date.parse(t.billed_at as string) >= refundedAt)
    ? 'older'
    : 'latest';
}

export type RefundOutcome =
  | { kind: 'skip'; reason: string }
  | { kind: 'end'; entitlement: Record<string, unknown> };

/**
 * What an approved full refund of the latest payment does to the stored
 * entitlement: ends it at the time of the event, or nothing.
 *
 * Nothing, when the entitlement on the account is not the subscription that
 * was refunded. That is what protects a hand-granted complimentary account:
 * `scripts/accountData.ts grant` leaves the old subscription's id in the map
 * beside `source: 'complimentary'`, and a late refund for that subscription
 * must not take away what the owner gave. Both the source and the id have to
 * match.
 *
 * Nothing, when a newer event is already stored (isStale) — a renewal or a
 * re-subscription after the refund wins, as it would over any older event.
 *
 * Nothing, when access had already ended by then.
 *
 * `startsAt` is dropped: a delayed-start plan refunded inside its 14 days
 * would otherwise still read as "access starts on…". So is
 * `paymentIssueSince`: there is no payment left to chase.
 */
export function entitlementAfterRefund(
  current: Record<string, unknown> | undefined,
  subscriptionId: string,
  eventAt: string,
): RefundOutcome {
  if (!current) return { kind: 'skip', reason: 'the account holds no entitlement' };
  if (current.source !== 'paddle') {
    return { kind: 'skip', reason: `the account's access is ${String(current.source)}, not this subscription` };
  }
  if (current.externalId !== subscriptionId) {
    return { kind: 'skip', reason: 'the account is on a different subscription' };
  }
  if (isStale(current, eventAt)) return { kind: 'skip', reason: 'a newer event is already stored' };
  const expires = typeof current.expiresAt === 'string' ? Date.parse(current.expiresAt) : NaN;
  if (!Number.isNaN(expires) && expires <= Date.parse(eventAt)) {
    return { kind: 'skip', reason: 'access had already ended' };
  }
  const kept = { ...current };
  delete kept.startsAt;
  delete kept.paymentIssueSince;
  return { kind: 'end', entitlement: { ...kept, expiresAt: eventAt, eventAt, refundedAt: eventAt } };
}
