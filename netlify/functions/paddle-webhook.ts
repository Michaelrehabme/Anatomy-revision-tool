import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  verifyPaddleSignature,
  actionForEvent,
  nextEntitlement,
  adjustmentActionForEvent,
  entitlementAfterRefund,
  isLatestPayment,
  ADJUSTMENT_EVENTS,
  type PaddleEvent,
  type PaddleAdjustmentEvent,
  type PaddleTransactionSummary,
} from '../../src/features/billing/lib/paddleWebhook';

/**
 * POST /.netlify/functions/paddle-webhook
 *
 * The first server-side code in this project, and deliberately thin: every
 * decision lives in src/features/billing/lib/paddleWebhook.ts, where it is
 * tested without a network or a database. What is here is plumbing, plus the
 * things that genuinely need a database to get right.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   PADDLE_WEBHOOK_SECRET     from the Paddle notification destination
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *
 * Either missing, and every request is refused. Failing closed is the point:
 * a webhook that cannot verify must not grant.
 *
 * FOR REFUNDS ONLY: PADDLE_API_KEY, the key paddle-portal already uses, with
 * permission to read transactions. Without it a refund never ends access —
 * it is recorded for the owner instead. See handleAdjustment.
 *
 * OPTIONAL: PADDLE_WEBHOOK_DRY_RUN=1 verifies the signature, works out what
 * the event means, logs it and stops short of the write — no service account
 * needed, no database read, no call to Paddle. It exists for the sandbox
 * destination on the demo site.
 *
 * A SANDBOX EVENT LOOKS EXACTLY LIKE A REAL ONE, and the sandbox takes test
 * cards from anyone. So a sandbox destination pointed at a webhook that writes
 * would hand out real subscriptions for the price of card 4242. The dry run
 * is what makes the sandbox safe to leave connected; it must never be set on
 * the production site, where it would silently stop paying customers getting
 * what they bought.
 */

/** Read per request, so a test — or a changed setting — takes effect without a new module. */
function dryRun(): boolean {
  return process.env.PADDLE_WEBHOOK_DRY_RUN === '1';
}

const PADDLE_API = {
  production: 'https://api.paddle.com',
  sandbox: 'https://sandbox-api.paddle.com',
};

/** Paddle wants an answer "within five seconds"; this leaves room for the write after it. */
const PADDLE_API_TIMEOUT_MS = 3000;

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

/**
 * A durable record of an event that verified and did not do what it should,
 * read by `npx tsx scripts/accountData.ts failures`. The log is not somewhere
 * anybody looks. Best effort: if Firestore is the thing that is broken, the
 * caller's 500 is still what gets the event retried.
 */
async function recordFailure(db: Firestore, id: string, row: Record<string, unknown>): Promise<void> {
  try {
    await db.doc(`billingFailures/${id}`).set({ ...row, recordedAt: FieldValue.serverTimestamp() });
  } catch {
    console.error('paddle-webhook: could not record the failure either');
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    // Logged because a silent 405 is indistinguishable from nothing arriving
    // at all, and telling those two apart is most of diagnosing a webhook.
    console.warn(`paddle-webhook: ${req.method} refused, from ${req.headers.get('user-agent') ?? 'no user-agent'}`);
    return new Response('Method not allowed', { status: 405 });
  }

  // The RAW body, before any parsing. Re-serialised JSON almost never matches
  // Paddle's bytes, and every genuine event would then fail verification.
  const raw = await req.text();

  const verified = verifyPaddleSignature(
    raw,
    req.headers.get('paddle-signature'),
    process.env.PADDLE_WEBHOOK_SECRET ?? '',
  );
  if (!verified.ok) {
    console.warn(`paddle-webhook: rejected (${verified.reason})`);
    // Deliberately vague to the caller. The reason is for our log, not for
    // somebody probing the endpoint to learn which check they failed.
    return new Response('Unauthorized', { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(raw) as PaddleEvent;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Refunds and chargebacks arrive as adjustments: a different payload, found
  // by a different key, and never a grant. Kept apart from the path below so
  // nothing about how a subscription event is applied changed to add them.
  if (ADJUSTMENT_EVENTS.has(event.event_type)) {
    return handleAdjustment(event as unknown as PaddleAdjustmentEvent);
  }

  const action = actionForEvent(event);
  if (action.kind === 'ignore') {
    console.info(`paddle-webhook: ignored ${event.event_type} (${action.reason})`);
    // 200 for anything we chose not to act on. A non-2xx makes Paddle retry,
    // and retrying an event we will never handle just fills the log.
    return new Response('ok', { status: 200 });
  }

  if (dryRun()) {
    console.info(
      `paddle-webhook: DRY RUN, nothing written — ${event.event_type} -> ${action.uid}, ` +
      `tier ${action.entitlement.tier} until ${action.entitlement.expiresAt}` +
      (action.entitlement.startsAt ? `, starting ${action.entitlement.startsAt}` : '') +
      `, cooling-off waived: ${action.consent?.coolingOffWaived ?? 'not recorded'}`,
    );
    return new Response('ok (dry run)', { status: 200 });
  }

  const db = getFirestore(adminApp());
  const ref = db.doc(`users/${action.uid}`);
  const eventAt = event.occurred_at ?? new Date().toISOString();

  // Set when the account's document is gone — see below.
  let noAccount = false;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // NEVER CREATE THE ACCOUNT. A student signs in, and so has a document,
      // before they can check out; a missing one means the account was
      // deleted. Writing here used to recreate users/{uid} with the customer
      // id and consent — personal data back after an erasure (paywall trace
      // finding 5, docs/PAYWALL-TRACE-2026-09-29.md).
      if (!snap.exists) {
        noAccount = true;
        return;
      }
      const current = snap.data()?.entitlement as Record<string, unknown> | undefined;

      // OUT-OF-ORDER DELIVERY, and what is carried over from the stored map:
      // both decided in nextEntitlement, where they are tested.
      const entitlement = nextEntitlement(current, action, eventAt);
      if (entitlement === 'stale') {
        console.info(`paddle-webhook: skipped stale ${event.event_type} for ${action.uid}`);
        return;
      }
      tx.update(ref, { entitlement, updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (error) {
    console.error(`paddle-webhook: write failed for ${action.uid}`, error);
    // This is a customer who has paid and has nothing, and it must be
    // findable tomorrow.
    await recordFailure(db, event.event_id ?? `${action.uid}-${eventAt}`, {
      uid: action.uid,
      eventType: event.event_type,
      eventAt,
      entitlement: action.entitlement,
      error: String(error).slice(0, 500),
    });
    // 500 so Paddle retries. This is a customer who has paid, and the retry is
    // the only thing standing between them and access they bought.
    return new Response('Retry', { status: 500 });
  }

  if (noAccount && action.entitlement.cancelAt) {
    // A student who cancels may now delete their account without waiting out
    // the paid period (accountLifecycle.ts). The cancellation then takes
    // effect, weeks later, on an account that is rightly gone — and this
    // event IS the subscription stopping. Nothing to cancel, nobody to tell.
    console.info(`paddle-webhook: ${event.event_type} for ${action.uid}: cancelled, and the account is already deleted`);
    return new Response('ok (no account)', { status: 200 });
  }

  if (noAccount) {
    console.error(`paddle-webhook: ${event.event_type} for ${action.uid}, whose account no longer exists`);
    // Findable tomorrow, like a failed write — most likely a deleted account
    // whose subscription is still charging, which someone must cancel by
    // hand. 200 rather than 500: a retry cannot bring the account back.
    await recordFailure(db, event.event_id ?? `${action.uid}-${eventAt}`, {
      uid: action.uid,
      eventType: event.event_type,
      eventAt,
      entitlement: action.entitlement,
      error: 'no users/{uid} document: account deleted? Cancel the subscription in Paddle.',
    });
    return new Response('ok (no account)', { status: 200 });
  }

  console.info(`paddle-webhook: ${event.event_type} -> ${action.uid} until ${action.entitlement.expiresAt}`);
  return new Response('ok', { status: 200 });
}

/**
 * Whether the refunded transaction is the subscription's latest payment,
 * asked of Paddle because the adjustment does not say.
 *
 * GET /transactions?subscription_id=…, newest first, at most 30 — the
 * documented maximum per page
 * (https://developer.paddle.com/api-reference/transactions/list-transactions).
 * Read only; it needs the `transaction.read` permission on the API key.
 *
 *   'unavailable'  Paddle could not be reached or is rate limiting: worth a retry.
 *   'unknown'      No key, the key may not read transactions, or the answer
 *                  does not settle it: a retry would not help.
 */
async function latestPayment(
  subscriptionId: string,
  transactionId: string,
): Promise<'latest' | 'older' | 'unknown' | 'unavailable'> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.error('paddle-webhook: PADDLE_API_KEY is not set, so a refund cannot be checked');
    return 'unknown';
  }
  // The same rule paddle-portal uses: a live key starts with pdl_live_, and
  // anything else is treated as sandbox.
  const base = apiKey.startsWith('pdl_live_') ? PADDLE_API.production : PADDLE_API.sandbox;
  const query = new URLSearchParams({
    subscription_id: subscriptionId,
    status: 'completed,paid',
    order_by: 'billed_at[DESC]',
    per_page: '30',
  });

  let response: Response;
  try {
    response = await fetch(`${base}/transactions?${query.toString()}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PADDLE_API_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('paddle-webhook: could not reach Paddle to check a refund', error);
    return 'unavailable';
  }
  if (response.status === 429 || response.status >= 500) return 'unavailable';
  if (!response.ok) {
    console.error(`paddle-webhook: Paddle answered ${response.status} when asked for transactions of ${subscriptionId}`);
    return 'unknown';
  }
  try {
    const body = (await response.json()) as { data?: PaddleTransactionSummary[] };
    if (!Array.isArray(body.data)) return 'unknown';
    return isLatestPayment(body.data, transactionId, subscriptionId);
  } catch {
    return 'unknown';
  }
}

/**
 * Refunds and chargebacks. Paywall trace finding 9: a refund used to leave
 * access in place until the period ran out.
 *
 * WHAT ENDS ACCESS, AND ONLY THIS: a refund that is `approved`, `full`, on a
 * subscription whose id is the one stored on exactly one account as a Paddle
 * entitlement, for the payment Paddle confirms is that subscription's latest.
 * Then `expiresAt` becomes the time of the event. A later subscription event
 * replaces the map as it always did — a refund does not cancel a
 * subscription in Paddle, so if it is left running, its next renewal grants
 * again, and that is correct: it was paid for.
 *
 * EVERYTHING UNCERTAIN CHANGES NOTHING AND IS WRITTEN DOWN. An adjustment
 * carries no `custom_data`, so there is no uid in it; the account is found by
 * subscription id. No match, two matches, a payment that cannot be shown to
 * be the latest, a chargeback: each leaves access exactly as it was and puts
 * a row in billingFailures for the owner. Being wrong in that direction
 * costs a refunded student some days of access. Being wrong in the other
 * locks out somebody who paid.
 *
 * NO ACCOUNT IS CREATED. The lookup only finds documents that exist, and the
 * write is an update inside a transaction that re-reads the document first.
 */
async function handleAdjustment(event: PaddleAdjustmentEvent): Promise<Response> {
  const action = adjustmentActionForEvent(event);
  if (action.kind === 'ignore') {
    console.info(`paddle-webhook: ignored ${event.event_type} (${action.reason})`);
    return new Response('ok', { status: 200 });
  }

  const eventAt = event.occurred_at ?? new Date().toISOString();

  if (dryRun()) {
    console.info(
      `paddle-webhook: DRY RUN, nothing read or written — ${event.event_type} ${action.adjustmentId}: ` +
      (action.kind === 'refund'
        ? `full approved refund of ${action.transactionId} on ${action.subscriptionId}`
        : action.reason),
    );
    return new Response('ok (dry run)', { status: 200 });
  }

  const db = getFirestore(adminApp());
  const failureId = event.event_id ?? `${action.adjustmentId}-${eventAt}`;
  const fail = (uid: string, error: string) =>
    recordFailure(db, failureId, {
      uid,
      eventType: event.event_type,
      eventAt,
      adjustmentId: action.adjustmentId,
      transactionId: action.transactionId,
      subscriptionId: action.subscriptionId,
      customerId: action.customerId,
      error,
    });

  // Which account holds this subscription. limit(2): one is the answer, two
  // is a reason to stop, and nobody needs the third.
  let matches: { id: string; entitlement: Record<string, unknown> | undefined }[] = [];
  if (action.subscriptionId) {
    try {
      const snapshot = await db.collection('users').where('entitlement.externalId', '==', action.subscriptionId).limit(2).get();
      matches = snapshot.docs.map((d) => ({ id: d.id, entitlement: d.data()?.entitlement as Record<string, unknown> | undefined }));
    } catch (error) {
      console.error(`paddle-webhook: could not look up ${action.subscriptionId}`, error);
      await fail('unknown', `lookup failed: ${String(error).slice(0, 400)}`);
      return new Response('Retry', { status: 500 });
    }
  }
  const uid = matches.length === 1 ? matches[0].id : 'unknown';

  if (action.kind === 'review') {
    console.error(`paddle-webhook: ${event.event_type} ${action.adjustmentId} needs a person — ${action.reason}`);
    await fail(uid, action.reason);
    return new Response('ok (recorded for review)', { status: 200 });
  }

  if (matches.length === 0) {
    console.error(`paddle-webhook: refund ${action.adjustmentId} for ${action.subscriptionId} matches no account`);
    await fail(
      'unknown',
      'full refund approved, but no account holds this subscription: account deleted, or its access was replaced. Nothing was changed.',
    );
    return new Response('ok (no account)', { status: 200 });
  }
  if (matches.length > 1) {
    console.error(`paddle-webhook: refund ${action.adjustmentId} for ${action.subscriptionId} matches more than one account`);
    await fail('unknown', `full refund approved, but more than one account holds this subscription (${matches.map((m) => m.id).join(', ')}). Nothing was changed.`);
    return new Response('ok (ambiguous)', { status: 200 });
  }

  // Before asking Paddle anything: is there access here for this refund to
  // end? A complimentary account, a newer event, access already over — all
  // stop here, quietly, because there is nothing for anybody to do.
  const first = entitlementAfterRefund(matches[0].entitlement, action.subscriptionId, eventAt);
  if (first.kind === 'skip') {
    console.info(`paddle-webhook: refund ${action.adjustmentId} changed nothing for ${uid} (${first.reason})`);
    return new Response('ok', { status: 200 });
  }

  const latest = await latestPayment(action.subscriptionId, action.transactionId);
  if (latest === 'unavailable') {
    await fail(uid, 'full refund approved, but Paddle could not be asked whether it was the latest payment. Access left in place; the event will be retried.');
    return new Response('Retry', { status: 500 });
  }
  if (latest !== 'latest') {
    console.error(`paddle-webhook: refund ${action.adjustmentId} for ${uid} not applied (${latest})`);
    await fail(
      uid,
      latest === 'older'
        ? 'full refund approved for an EARLIER payment, not the latest. Access left in place.'
        : 'full refund approved, but it could not be confirmed as the latest payment (check PADDLE_API_KEY can read transactions). Access left in place: to end it, cancel the subscription in Paddle with immediate effect.',
    );
    return new Response('ok (not applied)', { status: 200 });
  }

  const ref = db.doc(`users/${uid}`);
  let outcome = 'ended';
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // Deleted between the lookup and here. Never recreated.
      if (!snap.exists) {
        outcome = 'no account';
        return;
      }
      // Decided again on what is stored NOW: a renewal may have landed while
      // Paddle was being asked.
      const again = entitlementAfterRefund(snap.data()?.entitlement as Record<string, unknown> | undefined, action.subscriptionId, eventAt);
      if (again.kind === 'skip') {
        outcome = again.reason;
        return;
      }
      tx.update(ref, { entitlement: again.entitlement, updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (error) {
    console.error(`paddle-webhook: refund write failed for ${uid}`, error);
    await fail(uid, `full refund approved for the latest payment, but ending access failed: ${String(error).slice(0, 400)}`);
    return new Response('Retry', { status: 500 });
  }

  console.info(`paddle-webhook: refund ${action.adjustmentId} -> ${uid}: ${outcome === 'ended' ? `access ended at ${eventAt}` : `nothing changed (${outcome})`}`);
  return new Response('ok', { status: 200 });
}
