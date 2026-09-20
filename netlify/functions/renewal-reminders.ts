import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { reminderDue, reminderEmail, type ReminderDue } from '../../src/features/billing/lib/renewalReminders';
import type { Entitlement } from '../../src/features/anatomy-revision/lib/entitlement';

/**
 * Scheduled daily. Sends the renewal reminders UK law does not make Paddle
 * send for us — see docs/DMCC-SUBSCRIPTIONS.md, and renewalReminders.ts for
 * which subscriptions those are and why.
 *
 * WHY A SCHEDULE AND NOT A WEBHOOK. Paddle has no event that fires ahead of a
 * renewal. `transaction.created` appears when the renewal transaction is
 * generated, but the lead time is not documented and not promised, and a legal
 * notice cannot be hung on an undocumented interval. A schedule is a thing we
 * control and can prove ran.
 *
 * WHAT MAKES IT AUDITABLE. Every send writes `billingReminders.<key>` on the
 * user, where the key names the subscription and the payment number. That
 * record is checked before sending, so a second run on the same day is a
 * no-op, and it is the evidence that a notice went out — which is what an
 * enforcement query actually asks for.
 *
 * It writes to `billingReminders`, NOT into the entitlement map: firestore
 * rules keep that map byte-identical to what the webhook wrote, and the
 * reminders are our record rather than part of what somebody is entitled to.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   RESEND_API_KEY            the email sender. WITHOUT IT THE RUN IS A DRY
 *                             RUN: it works out who is due and logs them, and
 *                             sends nothing. That is the safe half to deploy
 *                             first, and the way to watch the rule behave
 *                             against real subscriptions before it can email
 *                             anybody.
 *   REMINDER_FROM             the From address, e.g. "LocusMSK <hello@locusmsk.co.uk>"
 */

const MANAGE_URL = 'https://locusmsk.co.uk/account';
const MONTHLY_PRICE = '£4.99';

/** One run handles at most this many accounts. Netlify stops a scheduled function at 30 seconds. */
const BATCH = 200;

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

async function send(to: string, reminder: ReminderDue): Promise<'sent' | 'dry-run'> {
  const key = process.env.RESEND_API_KEY;
  const { subject, text } = reminderEmail(reminder, { price: MONTHLY_PRICE, manageUrl: MANAGE_URL });
  if (!key) return 'dry-run';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.REMINDER_FROM ?? 'LocusMSK <hello@locusmsk.co.uk>', to, subject, text }),
  });
  if (!response.ok) {
    // Thrown so the caller leaves no record, and tomorrow's run tries again.
    // Recording a send that did not happen is worse than sending late.
    throw new Error(`send failed ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return 'sent';
}

export default async function handler(): Promise<Response> {
  const db = getFirestore(adminApp());
  const now = new Date();

  // Only Paddle subscribers can be due one of ours. Licensed and
  // complimentary accounts are not billed and renew nothing.
  const snapshot = await db.collection('users').where('entitlement.source', '==', 'paddle').limit(BATCH).get();

  let due = 0;
  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const decision = reminderDue(data.entitlement as Entitlement | undefined, now);
    if (!decision.due) continue;
    due += 1;

    const { reminder } = decision;
    if (data.billingReminders?.[reminder.key]) {
      skipped += 1;
      continue;
    }

    const email = typeof data.email === 'string' ? data.email : null;
    if (!email) {
      // A paying subscriber with no address on file. Worth a person looking:
      // the notice cannot be sent and the obligation does not go away.
      failures.push(`${doc.id}: no email address`);
      continue;
    }

    try {
      const outcome = await send(email, reminder);
      await doc.ref.set(
        { billingReminders: { [reminder.key]: { at: FieldValue.serverTimestamp(), outcome } } },
        { merge: true },
      );
      if (outcome === 'sent') sent += 1;
      console.info(`renewal-reminders: ${outcome} ${reminder.key} to ${doc.id}`);
    } catch (error) {
      failures.push(`${doc.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const summary = `scanned ${snapshot.size}, due ${due}, sent ${sent}, already sent ${skipped}, failed ${failures.length}`;
  if (failures.length > 0) console.error(`renewal-reminders: ${summary} — ${failures.join('; ')}`);
  else console.info(`renewal-reminders: ${summary}`);

  return new Response(summary, { status: 200 });
}
