import { FieldValue } from 'firebase-admin/firestore';
import { adminApp, adminDb } from './lib/firebaseAdmin';
import { isSignedUp, signupEmail, type SignupAccount } from '../../src/features/admin/data/signupEmail';

/**
 * Scheduled every ten minutes. Emails the owner one message per new sign-up
 * (owner, 25 Oct 2026).
 *
 * WHY A SCHEDULE, as for report-emails.ts: it reads the accounts that
 * actually exist, so nothing is missed, and there is no endpoint a client can
 * call to make us send mail. It also catches a guest who signs up later: the
 * uid is old, but it gains a sign-in method, and that is what counts here.
 *
 * WHAT IT KEEPS. signupEmails/seen, one doc listing every uid already told
 * about, which no client can read or write (no rule matches it). One read a
 * run, rather than one per account. A send that fails leaves the uid out, and
 * the next run tries again.
 *
 * THE FIRST RUN sends nothing: with no seen doc yet, it records everyone
 * already signed up, so the owner hears about sign-ups from then on and not
 * the whole history.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   RESEND_API_KEY            the email sender. Without it the run is a dry
 *                             run: it logs what it would send and sends nothing.
 *   SIGNUP_EMAIL_TO           who gets them. Optional; falls back to
 *                             REPORT_EMAIL_TO, then the owner's mailbox.
 *   REMINDER_FROM             the From address, shared with the reminders.
 */

const SEEN = 'signupEmails/seen';
/** Netlify stops a scheduled function at 30 seconds; a run sends at most this many. */
const BATCH = 25;

/** One account as Google's identity toolkit returns it; only the fields used here. */
interface ToolkitUser {
  localId: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
  /** Millisecond timestamp, as a string. */
  createdAt?: string;
  providerUserInfo?: { providerId: string }[];
}

function toAccount(user: ToolkitUser): SignupAccount {
  return {
    uid: user.localId,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    providers: (user.providerUserInfo ?? []).map((p) => p.providerId),
    emailVerified: user.emailVerified ?? false,
    createdAt: user.createdAt ? new Date(Number(user.createdAt)).toUTCString() : '?',
  };
}

/**
 * Every account, over HTTP rather than with firebase-admin/auth: that module
 * cannot load in the bundled function runtime (ERR_REQUIRE_ESM, see
 * lib/idToken.ts), and the first deploy of this function failed on exactly
 * that. The service account's own access token authorises the listing.
 */
async function everyAccount(): Promise<SignupAccount[]> {
  const app = adminApp();
  const credential = app.options.credential;
  const projectId = app.options.projectId ?? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}').project_id;
  if (!credential || !projectId) throw new Error('signup-emails: no service account credential to list accounts with');
  const { access_token } = await credential.getAccessToken();
  const out: SignupAccount[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`);
    url.searchParams.set('maxResults', '1000');
    if (pageToken) url.searchParams.set('nextPageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!response.ok) throw new Error(`signup-emails: listing accounts failed, ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const page = (await response.json()) as { users?: ToolkitUser[]; nextPageToken?: string };
    out.push(...(page.users ?? []).map(toAccount));
    pageToken = page.users?.length ? page.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

export default async function handler(): Promise<Response> {
  const db = adminDb();
  const key = process.env.RESEND_API_KEY;
  const to = process.env.SIGNUP_EMAIL_TO || process.env.REPORT_EMAIL_TO || 'michael@rehabme.uk';
  const from = process.env.REMINDER_FROM ?? 'LocusMSK <hello@locusmsk.co.uk>';

  const accounts = await everyAccount();
  const signedUp = accounts.filter(isSignedUp);
  const seenDoc = await db.doc(SEEN).get();

  if (!seenDoc.exists) {
    await db.doc(SEEN).set({ uids: signedUp.map((a) => a.uid), since: FieldValue.serverTimestamp() });
    console.log(`signup-emails: first run, recorded ${signedUp.length} existing sign-ups, sent nothing`);
    return new Response(JSON.stringify({ baseline: signedUp.length, sent: 0 }), { headers: { 'content-type': 'application/json' } });
  }

  const seen = new Set<string>(seenDoc.get('uids') ?? []);

  // A deleted account comes off the list: it cannot sign up again under the
  // same uid, so remembering it does nothing, and keeping it would keep a
  // trace of someone who asked to be erased (GDPR review, 25 Oct 2026).
  const existing = new Set(accounts.map((a) => a.uid));
  const gone = [...seen].filter((uid) => !existing.has(uid));
  if (gone.length > 0) {
    await db.doc(SEEN).update({ uids: FieldValue.arrayRemove(...gone) });
    console.log(`signup-emails: dropped ${gone.length} deleted account(s) from the seen list`);
  }
  const due = signedUp.filter((a) => !seen.has(a.uid)).slice(0, BATCH);

  let sent = 0;
  for (const account of due) {
    const { subject, text } = signupEmail(account, signedUp.length);
    if (!key) {
      console.log(`signup-emails: dry run, would send ${account.uid}: ${subject}`);
      continue;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      console.error(`signup-emails: send failed for ${account.uid}, ${response.status}: ${(await response.text()).slice(0, 200)}`);
      continue;
    }
    await db.doc(SEEN).update({ uids: FieldValue.arrayUnion(account.uid) });
    sent++;
  }

  console.log(`signup-emails: ${due.length} due, ${sent} sent${key ? '' : ' (dry run)'}`);
  return new Response(JSON.stringify({ due: due.length, sent }), { headers: { 'content-type': 'application/json' } });
}
