import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Entitlement } from '../../anatomy-revision/lib/entitlement';

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
 * Header format checked against Paddle Billing's documentation at the time of
 * writing: `Paddle-Signature: ts=<unix seconds>;h1=<hex HMAC-SHA256>`, signed
 * over `${ts}:${rawBody}` with the notification destination's secret key.
 * Re-check it against their current docs when wiring the sandbox — if the
 * format has changed, every real webhook will fail verification, which is
 * the safe way for this to be wrong.
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
  /** When the subscription first began. Stable across renewals, unlike the billing period. */
  started_at?: string | null;
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  canceled_at?: string | null;
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
  | { kind: 'grant'; uid: string; entitlement: Entitlement; consent: ConsentRecord | null }
  | { kind: 'ignore'; reason: string };

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
 * The only thing that ends access immediately is Paddle itself saying the
 * subscription is cancelled with an effective time now — a refund, or a
 * cancellation somebody asked to take effect at once.
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
  const periodEnd = sub.current_billing_period?.ends_at ?? null;

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
      entitlement: { tier: 'individual', source: 'paddle', expiresAt: effective, externalId: sub.id },
    };
  }

  if (!periodEnd) {
    return { kind: 'ignore', reason: `subscription ${sub.id} has no billing period to grant against` };
  }

  // active, trialing, past_due and paused all keep access to the end of the
  // period already covered. past_due in particular: Paddle retries the card,
  // and cutting a student off mid-revision because their bank declined once
  // would be punishing them for the retry schedule.
  return {
    kind: 'grant',
    uid,
    consent,
    entitlement: {
      tier: 'individual',
      source: 'paddle',
      expiresAt: periodEnd,
      externalId: sub.id,
      ...(startsAt ? { startsAt } : {}),
    },
  };
}
