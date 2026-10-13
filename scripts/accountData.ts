/**
 * Finds the account holding somebody's study history, and moves it.
 *
 * WHY THIS EXISTS. Signing in with a provider the account did not have before
 * puts the person on a NEW uid, and their history stays on the old one. To
 * them it looks exactly like deletion. Nothing is lost, but finding it by hand
 * means opening hundreds of Authentication rows and guessing, which is not a
 * thing to be doing while somebody watches their progress apparently gone.
 *
 *   npx tsx scripts/accountData.ts list                    # busiest accounts first
 *   npx tsx scripts/accountData.ts show <uid>              # one account in detail
 *   npx tsx scripts/accountData.ts move <from-uid> <to-uid>          # dry run
 *   npx tsx scripts/accountData.ts move <from-uid> <to-uid> --apply  # do it
 *   npx tsx scripts/accountData.ts grant <uid> [tier] --apply        # permanent free access
 *   npx tsx scripts/accountData.ts failures                          # payments that did not land, refunds not applied
 *   npx tsx scripts/accountData.ts licence <cohortId> <YYYY-MM-DD|none> --apply
 *   npx tsx scripts/accountData.ts code <CODE>                       # who has redeemed an access code
 *   npx tsx scripts/accountData.ts teach <uid> --apply               # let an access-code account teach
 *   npx tsx scripts/accountData.ts release <CODE> <uid> --apply      # give an access code's place back
 *
 * DRY RUN BY DEFAULT, like deleteDormantAccounts.ts, and for the same reason:
 * this one writes over a live account's data.
 *
 * NOTHING IS DELETED, EVER. `move` copies; the source account keeps everything
 * it had. A recovery that destroys the only good copy if it goes wrong is not
 * a recovery. Clean up the old account by hand, later, once the person has
 * confirmed their history is back.
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS — see the README's "Admin scripts".
 */
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './firebaseAdmin';
import { findAccessCode } from '../src/features/billing/lib/accessCode';

/** Kept in step with accountLifecycle.ts and deleteDormantAccounts.ts by hand. */
const USER_SUBCOLLECTIONS = [
  'mastery',
  'factMastery',
  'sessions',
  'achievements',
  'gamification',
  'questionExposure',
  'diagnostics',
];

const APPLY = process.argv.includes('--apply');
const BATCH_LIMIT = 400;

interface Counts {
  total: number;
  perCollection: Record<string, number>;
  attempts: number;
}

async function countFor(db: Firestore, uid: string): Promise<Counts> {
  const perCollection: Record<string, number> = {};
  let total = 0;
  for (const name of USER_SUBCOLLECTIONS) {
    // count() rather than fetching: a busy account has thousands of attempts
    // and this runs over every account in the project.
    const snap = await db.collection(`users/${uid}/${name}`).count().get();
    const n = snap.data().count;
    perCollection[name] = n;
    total += n;
  }
  const attempts = (await db.collection('attemptEvents').where('userId', '==', uid).count().get()).data().count;
  return { total: total + attempts, perCollection, attempts };
}

async function describe(uid: string): Promise<string> {
  try {
    const user = await getAuth(getAdminApp()).getUser(uid);
    const who = user.email ?? (user.providerData.length === 0 ? 'anonymous' : user.providerData[0].providerId);
    return `${who}  created ${user.metadata.creationTime?.slice(0, 16) ?? '?'}  last seen ${user.metadata.lastSignInTime?.slice(0, 16) ?? '?'}`;
  } catch {
    return 'no auth record (deleted account, data left behind)';
  }
}

async function list(db: Firestore): Promise<void> {
  const users = await db.collection('users').listDocuments();
  process.stdout.write(`${users.length} user documents. Counting…\n\n`);

  const rows: { uid: string; counts: Counts }[] = [];
  for (const ref of users) {
    const counts = await countFor(db, ref.id);
    if (counts.total > 0) rows.push({ uid: ref.id, counts });
  }
  rows.sort((a, b) => b.counts.total - a.counts.total);

  for (const { uid, counts } of rows.slice(0, 25)) {
    process.stdout.write(`${uid}  ${String(counts.total).padStart(6)} records  ${await describe(uid)}\n`);
  }
  process.stdout.write(`\n${rows.length} accounts hold data; the rest are empty.\n`);
}

async function show(db: Firestore, uid: string): Promise<void> {
  const counts = await countFor(db, uid);
  process.stdout.write(`${uid}\n${await describe(uid)}\n\n`);
  for (const [name, n] of Object.entries(counts.perCollection)) process.stdout.write(`  ${name.padEnd(18)} ${n}\n`);
  process.stdout.write(`  ${'attemptEvents'.padEnd(18)} ${counts.attempts}\n`);
  const doc = await db.doc(`users/${uid}`).get();
  const entitlement = doc.data()?.entitlement;
  process.stdout.write(`\n  entitlement: ${entitlement ? JSON.stringify(entitlement) : 'none'}\n`);
}

async function move(db: Firestore, from: string, to: string): Promise<void> {
  if (from === to) throw new Error('Source and destination are the same account.');
  const before = await countFor(db, from);
  const target = await countFor(db, to);
  process.stdout.write(`from ${from}  (${await describe(from)})\n  ${before.total} records\n`);
  process.stdout.write(`to   ${to}  (${await describe(to)})\n  ${target.total} records\n\n`);

  if (target.total > 0) {
    // Copying onto an account that has been used would interleave two people's
    // schedules: same structure ids, different due dates, last write wins.
    process.stdout.write('REFUSED: the destination already holds data. Merging two histories is not safe to do blind.\n');
    return;
  }

  for (const name of USER_SUBCOLLECTIONS) {
    const docs = await db.collection(`users/${from}/${name}`).get();
    if (docs.empty) continue;
    process.stdout.write(`${name}: ${docs.size} documents${APPLY ? '' : ' (dry run)'}\n`);
    if (!APPLY) continue;
    for (let i = 0; i < docs.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const d of docs.docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(db.doc(`users/${to}/${name}/${d.id}`), d.data());
      }
      await batch.commit();
    }
  }

  // attemptEvents live in a top-level collection keyed by userId, so they are
  // rewritten rather than copied under a new parent.
  const attempts = await db.collection('attemptEvents').where('userId', '==', from).get();
  process.stdout.write(`attemptEvents: ${attempts.size} documents${APPLY ? '' : ' (dry run)'}\n`);
  if (APPLY) {
    for (let i = 0; i < attempts.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const d of attempts.docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(db.collection('attemptEvents').doc(), { ...d.data(), userId: to });
      }
      await batch.commit();
    }
  }

  // The user document itself carries streaks and preferences, but NOT the
  // entitlement: that belongs to whoever paid, and copying it would hand a
  // subscription to a second account.
  const source = await db.doc(`users/${from}`).get();
  if (source.exists) {
    const rest = { ...(source.data() as Record<string, unknown>) };
    delete rest.entitlement;
    process.stdout.write(`user document: ${Object.keys(rest).length} fields (entitlement not copied)${APPLY ? '' : ' (dry run)'}\n`);
    if (APPLY) await db.doc(`users/${to}`).set(rest, { merge: true });
  }

  process.stdout.write(
    APPLY
      ? `\nDone. ${from} still holds its copy — delete it only once the move is confirmed.\n`
      : '\nDry run. Re-run with --apply to copy.\n',
  );
}

/**
 * Permanent, unpaid access: the comped account, a pilot cohort, the owner's
 * own login. `complimentary` rather than a fake subscription, so it never
 * shows up as revenue — see the note on EntitlementSource.
 *
 * A PADDLE EVENT WILL OVERWRITE THIS. The webhook writes the same field, so a
 * later subscription — or the cancellation of one that already exists — wins.
 * Cancel first, grant second.
 */
async function grant(db: Firestore, uid: string, tier: string): Promise<void> {
  if (!['individual', 'institutional'].includes(tier)) {
    throw new Error(`Tier must be individual or institutional, not "${tier}".`);
  }
  const current = (await db.doc(`users/${uid}`).get()).data()?.entitlement;
  process.stdout.write(`${uid}  (${await describe(uid)})\n`);
  process.stdout.write(`  now:  ${current ? JSON.stringify(current) : 'none'}\n`);

  const entitlement = { tier, source: 'complimentary', expiresAt: null };
  process.stdout.write(`  next: ${JSON.stringify(entitlement)}${APPLY ? '' : '  (dry run)'}\n`);

  if (typeof current === 'object' && current !== null && (current as Record<string, unknown>).source === 'paddle') {
    process.stdout.write('\nNOTE: this account holds a Paddle entitlement. Refund and cancel it first, or a\nlater Paddle event will overwrite this grant.\n');
  }

  if (APPLY) {
    await db.doc(`users/${uid}`).set({ entitlement }, { merge: true });
    process.stdout.write('\nGranted. Reload the app to see it.\n');
  } else {
    process.stdout.write('\nDry run. Re-run with --apply to grant.\n');
  }
}

/**
 * Events that verified and did not do what they should. Two kinds:
 *  - a payment that could not be written — somebody who has paid and has
 *    nothing;
 *  - a refund or chargeback the webhook would not act on by itself — no
 *    account matched, it was not the latest payment, or Paddle could not be
 *    asked (netlify/functions/paddle-webhook.ts, handleAdjustment). Access
 *    was left exactly as it was, and somebody has to decide.
 * Run it weekly: this is the only place they surface, since the webhook's own
 * log is not somewhere anybody looks.
 */
async function failures(db: Firestore): Promise<void> {
  const snap = await db.collection('billingFailures').orderBy('eventAt', 'desc').limit(50).get();
  if (snap.empty) {
    process.stdout.write('No failed payment writes. Every verified event landed.\n');
    return;
  }

  process.stdout.write(`${snap.size} billing event(s) that need a person:\n\n`);
  for (const d of snap.docs) {
    const f = d.data();
    process.stdout.write(`${f.eventAt}  ${f.eventType}  ${f.uid}\n`);
    // A refund that matched no account has no uid to look up.
    if (f.uid && f.uid !== 'unknown') process.stdout.write(`  ${await describe(String(f.uid))}\n`);
    if (f.entitlement) process.stdout.write(`  should have had: ${JSON.stringify(f.entitlement)}\n`);
    if (f.adjustmentId) {
      process.stdout.write(`  adjustment ${f.adjustmentId}  transaction ${f.transactionId}  subscription ${f.subscriptionId ?? 'none'}  customer ${f.customerId ?? 'unknown'}\n`);
    }
    process.stdout.write(`  error: ${f.error}\n\n`);
  }
  process.stdout.write(
    'A payment: grant what the entitlement says, or replay the event from Paddle.\n' +
    'A refund or chargeback: access was NOT changed. Look the ids up in Paddle; to end access, cancel the\n' +
    'subscription there with immediate effect, which the webhook does act on.\n',
  );
}

/**
 * Licenses a cohort until a date: every member gets every region, and anybody
 * joining later gets it too, without a per-student grant.
 *
 * A DATE, NOT A SWITCH. A pilot that never ends is a pilot nobody converts,
 * and an academic year does end. Pass the date the licence should run to —
 * the end of the teaching year, or a month after a pilot's review.
 *
 * Only this script can set it: firestore.rules pins licensedUntil against the
 * cohort's own owner, so a course lead cannot license their own class.
 */
async function licence(db: Firestore, cohortId: string, until: string): Promise<void> {
  const when = until === 'none' ? null : until;
  if (when !== null && Number.isNaN(Date.parse(when))) {
    throw new Error(`"${until}" is not a date. Use YYYY-MM-DD, or "none" to withdraw the licence.`);
  }

  const ref = db.doc(`cohorts/${cohortId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No cohort ${cohortId}.`);

  const cohort = snap.data() ?? {};
  const members = await db.collection('users').where('cohort', '==', cohortId).count().get();
  process.stdout.write(`${cohort.name} — ${cohort.institution || 'no institution'}\n`);
  process.stdout.write(`  ${members.data().count} member(s)\n`);
  process.stdout.write(`  now:  ${cohort.licensedUntil ?? 'not licensed'}\n`);
  process.stdout.write(`  next: ${when ?? 'not licensed'}${APPLY ? '' : '  (dry run)'}\n`);

  if (!APPLY) {
    process.stdout.write('\nDry run. Re-run with --apply.\n');
    return;
  }
  await ref.set({ licensedUntil: when }, { merge: true });
  process.stdout.write(
    when
      ? `\nLicensed. Members have every region until ${when}; they see it on their next load.\n`
      : '\nLicence withdrawn. Members drop back to the free tier, keeping all their progress.\n',
  );
}

/**
 * An access code: how many of its places are taken, and by whom
 * (src/features/billing/lib/accessCode.ts, netlify/functions/redeem-code.ts).
 */
async function code(db: Firestore, typed: string): Promise<void> {
  const found = findAccessCode(typed);
  if (!found) throw new Error(`No access code "${typed}". They are listed in src/features/billing/lib/accessCode.ts.`);
  const counter = (await db.doc(`accessCodes/${found.code}`).get()).data()?.redeemed ?? 0;
  const redemptions = await db.collection(`accessCodes/${found.code}/redemptions`).orderBy('redeemedAt').get();
  process.stdout.write(
    `${found.code}: ${counter} of ${found.maxRedemptions} redeemed. Access until ${found.accessUntil}. ${found.teaching ? 'May teach.' : 'No teaching.'}\n\n`,
  );
  for (const row of redemptions.docs) {
    const at = row.data().redeemedAt?.toDate?.().toISOString() ?? 'unknown';
    process.stdout.write(`  ${at}  ${row.id}  (${await describe(row.id)})\n`);
  }
  if (redemptions.size !== counter) {
    process.stdout.write(`\nNOTE: the count says ${counter} and the list has ${redemptions.size}. The count is what the cap reads.\n`);
  }
}

/**
 * Lets an account that redeemed an access code teach: removes the
 * `teaching: false` the code wrote, and nothing else. The access still ends
 * when the code's does. For the accounts the owner has agreed it with — a
 * code gives student features "unless discussed with me".
 */
async function teach(db: Firestore, uid: string): Promise<void> {
  const current = (await db.doc(`users/${uid}`).get()).data()?.entitlement as Record<string, unknown> | undefined;
  process.stdout.write(`${uid}  (${await describe(uid)})\n`);
  process.stdout.write(`  now:  ${current ? JSON.stringify(current) : 'none'}\n`);
  if (current?.teaching !== false) {
    process.stdout.write('\nNothing to do: this entitlement does not hold teaching back.\n');
    return;
  }
  if (APPLY) {
    await db.doc(`users/${uid}`).update({ 'entitlement.teaching': FieldValue.delete() });
    process.stdout.write('\nDone. They can create a class once they reload the app.\n');
  } else {
    process.stdout.write('\nDry run. Re-run with --apply to let this account teach.\n');
  }
}

/**
 * Gives one of an access code's places back: removes the account's
 * redemption and takes one off the count, together. For a place used by a
 * test, or by an account that has since been deleted — deleting an account
 * does not free its place, because the count is the cap and nothing but this
 * lowers it.
 *
 * IF THE ACCOUNT STILL HOLDS THE CODE'S ACCESS, THAT GOES TOO. A place given
 * back while its access carried on would be a hundred and first account. An
 * entitlement from anywhere else — a subscription bought since — is left
 * exactly as it is.
 */
async function release(db: Firestore, typed: string, uid: string): Promise<void> {
  const found = findAccessCode(typed);
  if (!found) throw new Error(`No access code "${typed}". They are listed in src/features/billing/lib/accessCode.ts.`);
  const codeRef = db.doc(`accessCodes/${found.code}`);
  const redemptionRef = db.doc(`accessCodes/${found.code}/redemptions/${uid}`);
  const userRef = db.doc(`users/${uid}`);

  const [redemption, counter, user] = [await redemptionRef.get(), await codeRef.get(), await userRef.get()];
  process.stdout.write(`${uid}  (${await describe(uid)})\n`);
  if (!redemption.exists) {
    process.stdout.write(`\nNothing to do: this account has not redeemed ${found.code}.\n`);
    return;
  }
  const entitlement = user.data()?.entitlement as Record<string, unknown> | undefined;
  const holds = entitlement?.accessCode === found.code;
  const redeemed = counter.data()?.redeemed ?? 0;
  process.stdout.write(`  ${found.code}: ${redeemed} of ${found.maxRedemptions} redeemed -> ${Math.max(0, redeemed - 1)}\n`);
  process.stdout.write(
    holds
      ? `  this account still holds the code's access, which will END: ${JSON.stringify(entitlement)}\n`
      : `  the account's entitlement is not from this code and is left alone: ${entitlement ? JSON.stringify(entitlement) : 'none'}\n`,
  );

  if (!APPLY) {
    process.stdout.write('\nDry run. Re-run with --apply to give the place back.\n');
    return;
  }
  await db.runTransaction(async (tx) => {
    const [again, count, profile] = [await tx.get(redemptionRef), await tx.get(codeRef), await tx.get(userRef)];
    if (!again.exists) return;
    tx.delete(redemptionRef);
    tx.set(codeRef, { redeemed: Math.max(0, (count.data()?.redeemed ?? 0) - 1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (profile.exists && (profile.data()?.entitlement as Record<string, unknown> | undefined)?.accessCode === found.code) {
      tx.update(userRef, { entitlement: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    }
  });
  process.stdout.write('\nDone. The place is free again.\n');
}

async function main(): Promise<void> {
  const db = getFirestore(getAdminApp());
  const [command, a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));

  if (command === 'list') return list(db);
  if (command === 'show' && a) return show(db, a);
  if (command === 'move' && a && b) return move(db, a, b);
  if (command === 'grant' && a) return grant(db, a, b ?? 'institutional');
  if (command === 'failures') return failures(db);
  if (command === 'licence' && a && b) return licence(db, a, b);
  if (command === 'code' && a) return code(db, a);
  if (command === 'teach' && a) return teach(db, a);
  if (command === 'release' && a && b) return release(db, a, b);

  process.stdout.write(
    'Usage:\n' +
      '  npx tsx scripts/accountData.ts list\n' +
      '  npx tsx scripts/accountData.ts show <uid>\n' +
      '  npx tsx scripts/accountData.ts move <from-uid> <to-uid> [--apply]\n' +
      '  npx tsx scripts/accountData.ts grant <uid> [individual|institutional] [--apply]\n' +
      '  npx tsx scripts/accountData.ts failures\n' +
      '  npx tsx scripts/accountData.ts licence <cohortId> <YYYY-MM-DD|none> [--apply]\n' +
      '  npx tsx scripts/accountData.ts code <CODE>\n' +
      '  npx tsx scripts/accountData.ts teach <uid> [--apply]\n' +
      '  npx tsx scripts/accountData.ts release <CODE> <uid> [--apply]\n',
  );
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
