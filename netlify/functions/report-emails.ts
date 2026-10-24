import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './lib/firebaseAdmin';
import { QUESTION_REPORTS, type QuestionReport } from '../../src/features/feedback/data/rows';
import { reportEmail } from '../../src/features/feedback/data/reportEmail';

/**
 * Scheduled every ten minutes. Emails the owner one message per question a
 * student reports, so the reports arrive in the inbox rather than waiting to
 * be found on /admin/feedback (owner, 24 Oct 2026).
 *
 * WHY A SCHEDULE AND NOT A CALL FROM THE APP. A report is written straight to
 * Firestore, and offline it waits in the device's queue: a request the app
 * sent beside it could arrive before the report exists, or never. Reading
 * what has actually landed misses nothing. It also means no endpoint a
 * client can call to make us send mail, and no change to firestore.rules.
 *
 * WHAT IT KEEPS. reportEmails/{reportId}, written once the email is sent,
 * which no client can read or write (no rule matches it). A report already
 * there is never sent again; a send that fails leaves nothing, and the next
 * run tries again.
 *
 * Only reports from the last LOOKBACK_DAYS are considered, so the first run
 * after deploying sends the recent ones and not the whole history.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   RESEND_API_KEY            the email sender. Without it the run is a dry
 *                             run: it logs what it would send and sends nothing.
 *   REPORT_EMAIL_TO           who gets them. Optional; defaults to the owner's
 *                             mailbox.
 *   REMINDER_FROM             the From address, shared with the reminders.
 */

const REPORT_EMAILS = 'reportEmails';
const LOOKBACK_DAYS = 2;
/** Netlify stops a scheduled function at 30 seconds; a run sends at most this many. */
const BATCH = 25;

export default async function handler(): Promise<Response> {
  const db = adminDb();
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO || 'michael@rehabme.uk';
  const from = process.env.REMINDER_FROM ?? 'LocusMSK <hello@locusmsk.co.uk>';
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const snapshot = await db.collection(QUESTION_REPORTS).where('createdAt', '>=', since).orderBy('createdAt').get();
  const unresolved = snapshot.docs.filter((d) => !d.get('resolvedAt'));
  const marks = unresolved.length ? await db.getAll(...unresolved.map((d) => db.doc(`${REPORT_EMAILS}/${d.id}`))) : [];
  const due = unresolved.filter((_, i) => !marks[i].exists).slice(0, BATCH);

  let sent = 0;
  for (const doc of due) {
    const { subject, text } = reportEmail(doc.data() as QuestionReport);
    if (!key) {
      console.log(`report-emails: dry run, would send ${doc.id}: ${subject}`);
      continue;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      console.error(`report-emails: send failed for ${doc.id}, ${response.status}: ${(await response.text()).slice(0, 200)}`);
      continue;
    }
    await db.doc(`${REPORT_EMAILS}/${doc.id}`).set({ sentAt: FieldValue.serverTimestamp(), to });
    sent++;
  }

  console.log(`report-emails: ${due.length} due, ${sent} sent${key ? '' : ' (dry run)'}`);
  return new Response(JSON.stringify({ due: due.length, sent }), { headers: { 'content-type': 'application/json' } });
}
