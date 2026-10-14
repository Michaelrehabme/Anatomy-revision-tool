import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './lib/firebaseAdmin';
import { accountForToken, bearerToken } from './lib/idToken';
import { decideRedemption, findAccessCode, type RedeemDecision } from '../../src/features/billing/lib/accessCode';

/**
 * POST /.netlify/functions/redeem-code   { "code": "…" }
 *
 * Turns an access code into full access until the code's end date. What a
 * code is, and every decision about who gets one, is
 * src/features/billing/lib/accessCode.ts; this is the plumbing.
 *
 * WHY IT IS SERVER-SIDE. firestore.rules lets no client write its own
 * entitlement, and that is the paywall. A code checked in the browser would
 * need that rule opened; here the Admin SDK writes, as the payment webhook
 * does, and the rule stays shut.
 *
 * ONE TRANSACTION, because the cap is a count. Two students redeeming the
 * last place at the same moment must not both get it, and a redemption must
 * never be counted without the access being written or the other way round.
 *
 * WHAT IT KEEPS, under accessCodes/{CODE}, which no client can read:
 *   redeemed                 how many accounts hold it
 *   redemptions/{uid}        who, and when — the list the owner reads with
 *                            `npm run admin:account -- code <CODE>`
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 */

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const REFUSAL_STATUS = {
  guest: 403,
  unconfirmed: 403,
  'unknown-code': 404,
  ended: 410,
  'all-used': 410,
  'has-access': 409,
} as const;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const idToken = bearerToken(req);
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  const account = await accountForToken(idToken, 'redeem-code');
  if (!account) {
    console.warn('redeem-code: rejected an unverifiable ID token');
    return new Response('Unauthorized', { status: 401 });
  }

  let typed: unknown;
  try {
    typed = ((await req.json()) as { code?: unknown } | null)?.code;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const code = findAccessCode(typed);
  if (!code) return json(404, { ok: false, reason: 'unknown-code' });

  let decision: RedeemDecision;
  try {
    const db = adminDb();
    const userRef = db.doc(`users/${account.uid}`);
    const codeRef = db.doc(`accessCodes/${code.code}`);
    const redemptionRef = db.doc(`accessCodes/${code.code}/redemptions/${account.uid}`);

    decision = await db.runTransaction(async (tx) => {
      const [user, counter, redemption] = [await tx.get(userRef), await tx.get(codeRef), await tx.get(redemptionRef)];
      const redeemed = counter.data()?.redeemed;
      const decided = decideRedemption({
        code,
        account,
        current: user.data()?.entitlement as Record<string, unknown> | undefined,
        redeemed: typeof redeemed === 'number' ? redeemed : 0,
        alreadyRedeemed: redemption.exists,
        now: new Date(),
      });
      if (decided.kind !== 'grant') return decided;

      // `mergeFields`, so the entitlement map is REPLACED and the rest of the
      // profile is left alone. A plain merge would keep the fields of an old
      // subscription this grant does not mention (its `cancelAt`, a
      // `refundedAt`), and the account screen would describe a mixture.
      // It also creates the profile, for an account so new it has none.
      tx.set(
        userRef,
        { entitlement: decided.entitlement, updatedAt: FieldValue.serverTimestamp() },
        { mergeFields: ['entitlement', 'updatedAt'] },
      );
      tx.set(codeRef, { redeemed: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(redemptionRef, { uid: account.uid, redeemedAt: FieldValue.serverTimestamp() });
      return decided;
    });
  } catch (error) {
    console.error(`redeem-code: could not redeem ${code.code} for ${account.uid}`, error);
    return new Response('Could not redeem', { status: 503 });
  }

  if (decision.kind === 'refuse') return json(REFUSAL_STATUS[decision.reason], { ok: false, reason: decision.reason });
  if (decision.kind === 'grant') console.info(`redeem-code: ${code.code} redeemed by ${account.uid}`);
  return json(200, { ok: true, already: decision.kind === 'already', accessUntil: code.accessUntil });
}
