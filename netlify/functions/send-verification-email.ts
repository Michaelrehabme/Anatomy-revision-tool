import { adminDb } from './lib/firebaseAdmin';
import { accountByUid, emailVerificationLink } from './lib/accounts';
import { accountForToken, bearerToken } from './lib/idToken';
import { decideVerificationSend, type VerificationSendRecord } from '../../src/features/auth-email/verificationThrottle';
import { oobCodeFromLink, verifyEmailActionUrl, verifyEmailMessage } from '../../src/features/auth-email/verifyEmailMessage';

/**
 * POST /.netlify/functions/send-verification-email   (Authorization: Bearer <ID token>)
 *
 * Emails the signed-in account the link that confirms its address, from
 * hello@locusmsk.co.uk through Resend, instead of Firebase's own email
 * (src/features/auth-email/verifyEmailMessage.ts says why).
 *
 * ONLY THE CALLER'S OWN ADDRESS. The address is read from the account the
 * token belongs to, never from the request, so nobody can use this to email
 * anyone else.
 *
 * ITS OWN LIMIT. Firebase limits how often its own email can be asked for;
 * a link made here is not counted there, so this keeps a limit of its own
 * (verificationThrottle.ts) under verificationEmails/{uid}, which no client
 * can read or write (firestore.rules has no rule for it).
 *
 * ANSWERS
 *   200 { ok: true }            sent
 *   200 { ok: true, already }   the address is already confirmed; nothing sent
 *   401                         no valid token
 *   403                         a guest, or an account with no address
 *   429 { reason }              this account's limit; the last link still works
 *   503                         not configured here (no RESEND_API_KEY): the
 *                               app falls back to Firebase's own email
 *   502                         Firebase or Resend refused; the app falls back too
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 *   RESEND_API_KEY            the email sender
 * OPTIONAL:
 *   REMINDER_FROM, REMINDER_REPLY_TO   as for the other emails
 *   APP_ORIGIN                where the link leads; https://locusmsk.co.uk
 */

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const key = process.env.RESEND_API_KEY;
  if (!key) return json(503, { ok: false, reason: 'not-configured' });

  const idToken = bearerToken(req);
  if (!idToken) return new Response('Unauthorized', { status: 401 });
  const caller = await accountForToken(idToken, 'send-verification-email');
  if (!caller) return new Response('Unauthorized', { status: 401 });
  if (caller.anonymous) return json(403, { ok: false, reason: 'guest' });
  if (caller.emailVerified) return json(200, { ok: true, already: true });

  try {
    const account = await accountByUid(caller.uid);
    const email = account?.email;
    if (!email) return json(403, { ok: false, reason: 'no-email' });

    const db = adminDb();
    const ref = db.doc(`verificationEmails/${caller.uid}`);
    const now = new Date();
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const decided = decideVerificationSend(snap.data() as VerificationSendRecord | undefined, now);
      if (decided.send) tx.set(ref, decided.record);
      return decided;
    });
    if (!decision.send) return json(429, { ok: false, reason: decision.reason });

    const oobCode = oobCodeFromLink(await emailVerificationLink(email));
    if (!oobCode) throw new Error('the link Firebase made has no code in it');

    const appOrigin = process.env.APP_ORIGIN || 'https://locusmsk.co.uk';
    const message = verifyEmailMessage({
      to: email,
      link: verifyEmailActionUrl(appOrigin, oobCode),
      appOrigin,
      from: process.env.REMINDER_FROM ?? 'LocusMSK <hello@locusmsk.co.uk>',
      replyTo: process.env.REMINDER_REPLY_TO ?? 'michael@rehabme.uk',
    });
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return json(200, { ok: true });
  } catch (error) {
    console.error(`send-verification-email: ${caller.uid}: ${error instanceof Error ? error.message : String(error)}`);
    return json(502, { ok: false, reason: 'send-failed' });
  }
}
