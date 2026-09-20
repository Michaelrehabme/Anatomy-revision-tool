import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  verifyPaddleSignature,
  actionForEvent,
  type PaddleEvent,
} from '../../src/features/billing/lib/paddleWebhook';

/**
 * POST /.netlify/functions/paddle-webhook
 *
 * The first server-side code in this project, and deliberately thin: every
 * decision lives in src/features/billing/lib/paddleWebhook.ts, where it is
 * tested without a network or a database. What is here is plumbing, plus the
 * two things that genuinely need a database to get right.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   PADDLE_WEBHOOK_SECRET     from the Paddle notification destination
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *
 * Either missing, and every request is refused. Failing closed is the point:
 * a webhook that cannot verify must not grant.
 *
 * OPTIONAL: PADDLE_WEBHOOK_DRY_RUN=1 verifies the signature, works out what
 * the event means, logs it and stops short of the write — no service account
 * needed. It exists for the sandbox destination on the demo site.
 *
 * A SANDBOX EVENT LOOKS EXACTLY LIKE A REAL ONE, and the sandbox takes test
 * cards from anyone. So a sandbox destination pointed at a webhook that writes
 * would hand out real subscriptions for the price of card 4242. The dry run
 * is what makes the sandbox safe to leave connected; it must never be set on
 * the production site, where it would silently stop paying customers getting
 * what they bought.
 */

const DRY_RUN = process.env.PADDLE_WEBHOOK_DRY_RUN === '1';

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
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

  const action = actionForEvent(event);
  if (action.kind === 'ignore') {
    console.info(`paddle-webhook: ignored ${event.event_type} (${action.reason})`);
    // 200 for anything we chose not to act on. A non-2xx makes Paddle retry,
    // and retrying an event we will never handle just fills the log.
    return new Response('ok', { status: 200 });
  }

  if (DRY_RUN) {
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

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data()?.entitlement as Record<string, unknown> | undefined) : undefined;

      // OUT-OF-ORDER DELIVERY. Paddle does not promise ordering, and retries
      // make it worse: an old `subscription.updated` can land after the
      // `subscription.canceled` that superseded it, and would silently hand a
      // cancelled student another year. Only a newer event may overwrite.
      const storedAt = typeof current?.eventAt === 'string' ? current.eventAt : null;
      if (storedAt && storedAt > eventAt) {
        console.info(`paddle-webhook: skipped stale ${event.event_type} for ${action.uid}`);
        return;
      }

      tx.set(
        ref,
        {
          // The consent record rides INSIDE the entitlement map on purpose:
          // firestore.rules makes that whole map immutable to clients, so the
          // evidence a disputed refund turns on cannot be edited by the person
          // disputing it.
          entitlement: { ...action.entitlement, eventAt, consent: action.consent },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (error) {
    console.error(`paddle-webhook: write failed for ${action.uid}`, error);
    // 500 so Paddle retries. This is a customer who has paid, and the retry is
    // the only thing standing between them and access they bought.
    return new Response('Retry', { status: 500 });
  }

  console.info(`paddle-webhook: ${event.event_type} -> ${action.uid} until ${action.entitlement.expiresAt}`);
  return new Response('ok', { status: 200 });
}
