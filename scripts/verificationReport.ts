/**
 * Who will be asked to confirm their email address, counted before the rule
 * is switched on. READ-ONLY: it lists accounts and reads profiles, and writes
 * nothing anywhere.
 *
 * WHY THIS EXISTS. From 7 Oct 2026 the free area needs a confirmed email
 * address (src/features/anatomy-revision/lib/emailVerification.ts). Nobody on
 * the live site was ever sent a confirmation email, so every email-and-
 * password account there is unconfirmed through no doing of its own. The rule
 * lets such an account keep the one free area it has — IF its profile says
 * it was first written before the rule started (`createdAt` on users/{uid}).
 * An existing account whose profile has no such date is treated as new, and
 * meets "Check your inbox" on its first load. Nothing is lost when that
 * happens, but it is a step nobody warned them about, and this is how to
 * know how many people that is BEFORE deploying rather than after.
 *
 *   npx tsx scripts/verificationReport.ts            # the counts
 *   npx tsx scripts/verificationReport.ts --list     # …and the addresses that will be asked
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS — see the README's "Admin scripts".
 * (With FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST both pointing
 * at this machine it reads the emulators instead, and needs no key.)
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';
import { VERIFICATION_STARTS, predatesVerification } from '../src/features/anatomy-revision/lib/emailVerification';
import { accessRecord } from '../src/features/anatomy-revision/lib/entitlementRecord';
import { resolveEntitlement } from '../src/features/anatomy-revision/lib/entitlement';

const LIST = process.argv.includes('--list');

const loopback = (host: string | undefined) => !!host && /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/.test(host);
const emulated = loopback(process.env.FIRESTORE_EMULATOR_HOST) && loopback(process.env.FIREBASE_AUTH_EMULATOR_HOST);
const app = emulated
  ? (getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-locusmsk' }))
  : getAdminApp();
const db = getFirestore(app);
const auth = getAuth(app);

async function everyAccount(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    out.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

const accounts = await everyAccount();
const now = new Date();

const counts = {
  guests: 0,
  google: 0,
  passwordConfirmed: 0,
  unconfirmedFullAccess: 0,
  unconfirmedKeeps: 0,
  unconfirmedKeepsNoArea: 0,
  unconfirmedAsked: 0,
  unconfirmedNoProfile: 0,
  other: 0,
};
const asked: string[] = [];

for (const account of accounts) {
  const providers = account.providerData.map((p) => p.providerId);
  if (providers.length === 0) { counts.guests += 1; continue; }
  if (account.emailVerified) {
    if (providers.includes('google.com')) counts.google += 1;
    else counts.passwordConfirmed += 1;
    continue;
  }
  if (!providers.includes('password')) { counts.other += 1; continue; }

  // An email-and-password account that has not confirmed its address.
  const snapshot = await db.doc(`users/${account.uid}`).get();
  if (!snapshot.exists) {
    counts.unconfirmedNoProfile += 1;
    asked.push(`${account.email ?? account.uid}  (no profile document)`);
    continue;
  }
  const user = snapshot.data() as Record<string, unknown>;
  const cohortId = typeof user.cohort === 'string' && user.cohort ? user.cohort : null;
  const cohort = cohortId ? (await db.doc(`cohorts/${cohortId}`).get()).data() : undefined;
  const record = accessRecord(user, cohort, now);
  if (resolveEntitlement(record.candidates, now).tier !== 'free') { counts.unconfirmedFullAccess += 1; continue; }
  if (predatesVerification(user.createdAt)) {
    if (record.freeArea) counts.unconfirmedKeeps += 1;
    else counts.unconfirmedKeepsNoArea += 1;
    continue;
  }
  counts.unconfirmedAsked += 1;
  asked.push(`${account.email ?? account.uid}  (${user.createdAt === undefined ? 'profile has no createdAt' : 'profile written since the rule started'})`);
}

const line = (n: number, what: string) => process.stdout.write(`${String(n).padStart(6)}  ${what}\n`);
process.stdout.write(`\nThe rule starts ${VERIFICATION_STARTS}${emulated ? '   [reading the EMULATORS]' : ''}\n\n`);
line(accounts.length, 'accounts in all');
line(counts.guests, 'guests (no sign-in method): asked for an account, as now, and then to confirm its address');
line(counts.google, 'Google accounts: confirmed already, notice nothing');
line(counts.passwordConfirmed, 'email-and-password accounts already confirmed: notice nothing');
line(counts.other, 'unconfirmed accounts with some other sign-in: look at these by hand');
process.stdout.write('\nEmail-and-password accounts that have NOT confirmed (nobody was ever asked to):\n');
line(counts.unconfirmedFullAccess, 'with full access now: never asked, never held back');
line(counts.unconfirmedKeeps, 'free, here before the rule, a free area on the account: keep it; confirm only to change it');
line(counts.unconfirmedKeepsNoArea, 'free, here before the rule, no free area on the account yet: the new app moves their device\'s choice up; confirm only to change it');
line(counts.unconfirmedAsked + counts.unconfirmedNoProfile, 'free, and NOT recognisable as here before the rule: will meet "Check your inbox" on their first load');
if (counts.unconfirmedAsked + counts.unconfirmedNoProfile > 0) {
  process.stdout.write(
    '\nThose last accounts lose nothing, but it is a step they were not warned about. If they are real students\n' +
      'who signed up before the rule, either move the start date later (VERIFICATION_STARTS and firestore.rules\n' +
      'verificationStarts(), together) so that it falls after their profiles were written, or tell them to expect the email.\n',
  );
  if (LIST) process.stdout.write(`\n${asked.map((a) => `        ${a}`).join('\n')}\n`);
  else process.stdout.write('Run again with --list to see which.\n');
}
process.stdout.write('\n');
