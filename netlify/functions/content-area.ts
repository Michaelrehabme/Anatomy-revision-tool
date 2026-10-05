import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from './lib/firebaseAdmin';
import { bearerToken, uidForToken } from './lib/idToken';
import { countRequest, rememberWindow } from './lib/recentRequests';
import { accessRecord, areaAccess, cohortIdOf } from '../../src/features/anatomy-revision/lib/entitlementRecord';
import { leaseUntil } from '../../src/features/anatomy-revision/data/content/lease';
import { AREAS, type Area } from '../../src/features/anatomy-revision/types/region';
import {
  CONTENT_FETCHES_PER_HOUR,
  CONTENT_FETCH_WINDOW_MS,
  countFetch,
  parseFetchWindow,
  type FetchWindow,
} from '../../src/features/anatomy-revision/data/content/fetchLimit';
// The facts, cut from the seed by `npm run generate:content` and written
// OUTSIDE every directory that is published (src/scripts/buildContent.ts).
// Imported statically so the bundler packs them into this function: they
// version with the deploy, and there is no file for anyone to request.
import version from '../../.content/version.json';
import shoulder from '../../.content/areas/shoulder.json';
import elbow from '../../.content/areas/elbow.json';
import wristHand from '../../.content/areas/wrist-hand.json';
import hip from '../../.content/areas/hip.json';
import knee from '../../.content/areas/knee.json';
import ankleFoot from '../../.content/areas/ankle-foot.json';
import cervicalSpine from '../../.content/areas/cervical-spine.json';
import thoracicSpine from '../../.content/areas/thoracic-spine.json';
import lumbarSpine from '../../.content/areas/lumbar-spine.json';

/**
 * GET /.netlify/functions/content-area?area=<area>&v=<contentVersion>
 *
 * Hands one area's facts — origins, insertions, nerves, attachments, blood
 * supply, the clinical layer — to an account that may have that area, and to
 * nobody else (docs/DESIGN-CONTENT-BEHIND-SERVER.md).
 *
 * WHY THIS EXISTS. The paywall was drawn by the browser over content the
 * browser already held: every structure's facts shipped in the bundle, so the
 * whole sourced dataset was one devtools tab away from anyone, paid or not.
 * With the facts here instead, what a free account's device holds is its one
 * free area, because that is all it was ever sent.
 *
 * WHO MAY HAVE WHAT is not decided in this file. It is lib/entitlementRecord's
 * areaAccess, which is built from the same resolveEntitlement and
 * canAccessArea every gate in the app calls. The three days of grace after a
 * failed payment, a cancellation date, a refund, a delayed start, a class
 * licence, a complimentary grant: each is honoured here because it is
 * honoured there, and cannot drift, because there is one of it.
 *
 * AN ADMIN GETS NO SPECIAL ANSWER, exactly as in the app, where the admin
 * role opens screens and not areas. The admin and educator screens work from
 * the bundled index and need no facts.
 *
 * A GUEST IS AN ACCOUNT. Firebase gives a visitor who has not signed up an
 * anonymous account with a real ID token, and that account has a free area
 * like any other.
 *
 * WHAT A GRANT CARRIES. `{ version, area, leaseUntil, structures }`. The
 * version is this deploy's, whatever `v` the client sent — a client on an
 * older bundle is given current facts and told so. The lease is how long the
 * device may keep them without asking again (data/content/lease.ts).
 *
 * WHAT THIS DOES NOT STOP, said plainly. A paying account can save its own
 * areas. Any account, guests included, may have one area free, so nine
 * accounts can have nine. The limit below slows a script and puts a number
 * in the log; it is not a wall. The bar moves from "anyone with devtools" to
 * "someone prepared to script sign-ups", and the log line is how that would
 * be noticed.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 * Either missing and every request is refused: 401 without the key, 503
 * without the account.
 *
 * OPTIONAL:
 *   CONTENT_ALLOWED_ORIGINS   comma-separated origins, beyond this site's
 *                             own, whose pages may call this — the native
 *                             app's webview, if it ever calls it. Empty by
 *                             default: same origin only.
 */

interface AreaFile {
  area: string;
  version: string;
  structures: unknown[];
}

const PAYLOADS: Record<Area, AreaFile> = {
  shoulder,
  elbow,
  'wrist-hand': wristHand,
  hip,
  knee,
  'ankle-foot': ankleFoot,
  'cervical-spine': cervicalSpine,
  'thoracic-spine': thoracicSpine,
  'lumbar-spine': lumbarSpine,
};

const CONTENT_VERSION: string = version.version;

/**
 * Never cached by anything between here and the student: not the CDN, which
 * would serve one account's grant to the next caller, and not the browser's
 * HTTP cache, where it would outlive the lease. The app keeps its own copy,
 * keyed to the account, and that is the only copy there should be.
 */
const NO_STORE = {
  'cache-control': 'private, no-store',
  vary: 'Authorization, Origin',
  'x-content-type-options': 'nosniff',
};

const text = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE, ...extra } });

/**
 * Same origin only. A browser sends `Origin` on any cross-site fetch, and on
 * this one always (the Authorization header makes it a "non-simple" request),
 * so a page on another site asking with a student's token is refused here —
 * and, since no Access-Control-Allow-Origin is ever sent, could not have read
 * the answer in any case. A request with no Origin is not a browser's
 * cross-site request and is judged on its token alone.
 */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let own: string;
  try {
    own = new URL(req.url).origin;
  } catch {
    return false;
  }
  if (origin === own) return true;
  // Netlify's own names for this site and this deploy, which are what the
  // page's origin is when the function is reached through an internal URL.
  const named = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL];
  const extra = (process.env.CONTENT_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim());
  return [...named, ...extra].some((allowed) => !!allowed && allowed.replace(/\/$/, '') === origin);
}

function isArea(value: string | null): value is Area {
  return !!value && (AREAS as string[]).includes(value);
}

export default async function handler(req: Request): Promise<Response> {
  // No OPTIONS either: the app calls from its own origin, which needs no
  // preflight, and answering one would be the first step of allowing others.
  if (req.method !== 'GET') return text(405, 'Method not allowed', { allow: 'GET' });

  if (!originAllowed(req)) {
    console.warn(`content-area: refused a request from origin ${req.headers.get('origin')}`);
    return text(403, 'Forbidden');
  }

  const idToken = bearerToken(req);
  if (!idToken) return text(401, 'Unauthorized');

  const params = new URL(req.url).searchParams;
  const area = params.get('area');
  if (!isArea(area)) return text(400, 'Unknown area');
  const asked = (params.get('v') ?? '').slice(0, 40);

  const uid = await uidForToken(idToken, 'content-area');
  if (!uid) {
    console.warn('content-area: rejected an unverifiable ID token');
    return text(401, 'Unauthorized');
  }

  const now = new Date();
  // From this instance's memory first: a refusal that costs no database read.
  const seenHere = countRequest(uid, now);
  if (seenHere.limited) {
    console.warn(`content-area: ${uid} is over ${CONTENT_FETCHES_PER_HOUR} requests an hour (refused from memory)`);
    return tooMany(seenHere.window, now);
  }

  let user: Record<string, unknown> | undefined;
  let cohort: Record<string, unknown> | undefined;
  let userRef: DocumentReference;
  try {
    const db = adminDb();
    userRef = db.doc(`users/${uid}`);
    user = (await userRef.get()).data();
    // A licence is derived from the class the account has joined, not stored
    // on the account — see licenceEntitlement. One more read, members only.
    const cohortId = cohortIdOf(user);
    if (cohortId) cohort = (await db.doc(`cohorts/${cohortId}`).get()).data();
  } catch (error) {
    // Could not find out. That is not "no": it is no answer, and the app
    // keeps whatever lease it already holds. Nothing is served on a guess.
    console.error(`content-area: could not read the account of ${uid}: ${error instanceof Error ? error.message : String(error)}`);
    return text(503, 'Not available');
  }

  // The count every instance shares. Checked before deciding, so an account
  // over the limit learns nothing new by asking about other areas.
  const stored = parseFetchWindow(user?.contentFetch);
  const counted = countFetch(stored, now);
  if (counted.limited) {
    // Remembered, so this instance refuses the next one without the read.
    rememberWindow(uid, counted.window);
    console.warn(`content-area: ${uid} is over ${CONTENT_FETCHES_PER_HOUR} fetches an hour`);
    return tooMany(counted.window, now);
  }

  const record = accessRecord(user, cohort, now);
  const access = areaAccess(area, record, now);
  if (!access.allowed) {
    console.info(
      `content-area: refused ${area} to ${uid} (tier ${access.entitlement.tier}, free area ${record.freeArea?.area ?? 'not chosen'})`,
    );
    return text(403, 'Not entitled to this area');
  }

  // Counted on the account, and only for a grant: a refusal handed nothing
  // out. `update`, never `set` — an account whose profile has been deleted is
  // not to be given one back by asking for an area (the webhook keeps the
  // same rule for the same reason). If the write fails the area is still
  // served: a counter that cannot be written must not lock out a student
  // who has paid.
  if (user) {
    try {
      await userRef.update({ contentFetch: counted.window });
    } catch (error) {
      console.error(`content-area: could not count a fetch for ${uid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const lease = leaseUntil(access.entitlement, now);
  const payload = PAYLOADS[area];
  console.info(
    `content-area: served ${area} (${payload.structures.length} structures, v ${CONTENT_VERSION}` +
      `${asked && asked !== CONTENT_VERSION ? `, asked for ${asked}` : ''}) to ${uid}, ` +
      `tier ${access.entitlement.tier}/${access.entitlement.source ?? 'none'}, lease to ${lease}, ` +
      `${counted.window.count} of ${CONTENT_FETCHES_PER_HOUR} this hour`,
  );

  return new Response(
    JSON.stringify({ version: CONTENT_VERSION, area, leaseUntil: lease, structures: payload.structures }),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE } },
  );
}

function tooMany(window: FetchWindow, now: Date): Response {
  const wait = Math.max(1, Math.ceil((window.windowStart + CONTENT_FETCH_WINDOW_MS - now.getTime()) / 1000));
  return text(429, 'Too many requests', { 'retry-after': String(wait) });
}
