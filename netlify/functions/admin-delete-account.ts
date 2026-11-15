import { adminDb } from './lib/firebaseAdmin';
import { accountByUid, deleteAccountRecord, hasAdminClaim } from './lib/accounts';
import { bearerToken, uidForToken } from './lib/idToken';
import { purgeAccountData } from './lib/purgeAccount';
import { deleteRefusal } from '../../src/features/admin/lib/deleteAccountPolicy';
import { parseEntitlement } from '../../src/features/anatomy-revision/lib/entitlementRecord';
import { BOOTSTRAP_ADMIN_EMAIL } from '../../src/features/roles/bootstrap';

/**
 * POST /.netlify/functions/admin-delete-account   { "uid": "…" }
 *
 * Lets an admin delete an account from /admin/users/:uid — built for clearing
 * out test and internal accounts. Deletes the same data as the student's own
 * "Delete my account" (lib/purgeAccount.ts), then the sign-in record.
 *
 * WHY SERVER-SIDE. firestore.rules gives an admin read-only access to other
 * people's data, on purpose, and a sign-in record can only be removed with
 * the service account. So the browser asks, and this checks.
 *
 * WHO MAY ASK: the same three kinds of admin firestore.rules' isAdmin()
 * accepts — roles/{uid}.admin, the legacy `admin` claim, or the bootstrap
 * owner with a confirmed address. WHO MAY BE DELETED: lib/deleteAccountPolicy.ts.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 */

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Lookup = Awaited<ReturnType<typeof accountByUid>>;

async function isAdminAccount(uid: string, account: Lookup): Promise<boolean> {
  const role = await adminDb().doc(`roles/${uid}`).get();
  if (role.data()?.admin === true) return true;
  if (account && hasAdminClaim(account)) return true;
  return Boolean(account?.emailVerified && account.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const idToken = bearerToken(req);
  if (!idToken) return new Response('Unauthorized', { status: 401 });
  const actorUid = await uidForToken(idToken, 'admin-delete-account');
  if (!actorUid) return new Response('Unauthorized', { status: 401 });

  let targetUid: unknown;
  try {
    targetUid = ((await req.json()) as { uid?: unknown } | null)?.uid;
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (typeof targetUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) return new Response('Bad request', { status: 400 });

  try {
    const [actor, target] = await Promise.all([accountByUid(actorUid), accountByUid(targetUid)]);
    if (!(await isAdminAccount(actorUid, actor))) {
      console.warn(`admin-delete-account: ${actorUid} is not an admin`);
      return new Response('Forbidden', { status: 403 });
    }

    const db = adminDb();
    const profile = (await db.doc(`users/${targetUid}`).get()).data();
    const refusal = deleteRefusal({
      actorUid,
      targetUid,
      targetIsAdmin: await isAdminAccount(targetUid, target),
      entitlement: parseEntitlement(profile?.entitlement),
    });
    if (refusal) return json(409, { ok: false, reason: refusal });

    const counts = await purgeAccountData(db, targetUid, profile);
    await deleteAccountRecord(targetUid);
    console.log(`admin-delete-account: ${actorUid} deleted ${targetUid} ${JSON.stringify(counts)}`);
    return json(200, { ok: true, counts });
  } catch (err) {
    console.error('admin-delete-account: failed', err);
    return json(500, { ok: false, reason: 'failed' });
  }
}
