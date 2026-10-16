import { adminDb } from './lib/firebaseAdmin';
import { unsubscribeToken } from './lib/unsubscribeToken';
import {
  STUDY_REMINDER_FIELD,
  shouldSendStudyReminder,
  studyReminderMessage,
  type StudyReminderChoice,
} from '../../src/features/reminders/studyReminder';

/**
 * The weekly study reminder (src/features/reminders/studyReminder.ts), run
 * by Netlify's scheduler on Monday mornings (netlify.toml).
 *
 * ONLY STUDENTS WHO TICKED THE BOX, and only when something is due. The due
 * count is a Firestore count query over the student's mastery documents, so
 * it costs one read per thousand documents, not one per document.
 *
 * WITHOUT RESEND_API_KEY THE RUN IS A REHEARSAL: it works out who would be
 * emailed, logs it, and records nothing, so the first real run still sends.
 */

const APP_URL = 'https://locusmsk.co.uk/';
const UNSUBSCRIBE_URL = 'https://locusmsk.co.uk/.netlify/functions/study-reminders-unsubscribe';
/** One run handles at most this many students. Netlify stops a scheduled function at 30 seconds. */
const BATCH = 300;

export default async function handler(): Promise<Response> {
  const db = adminDb();
  const now = new Date();
  const key = process.env.RESEND_API_KEY;

  const snapshot = await db.collection('users').where(`${STUDY_REMINDER_FIELD}.weekly`, '==', true).limit(BATCH).get();

  let sent = 0;
  let nothingDue = 0;
  let rehearsed = 0;
  const failures: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const choice = data[STUDY_REMINDER_FIELD] as StudyReminderChoice | undefined;
    const email = typeof data.email === 'string' ? data.email : null;
    if (!email) continue;

    try {
      const due = await doc.ref.collection('mastery').where('dueAt', '<=', now.toISOString()).count().get();
      const dueCount = due.data().count;
      if (!shouldSendStudyReminder(choice, dueCount, now)) {
        nothingDue += 1;
        continue;
      }
      if (!key) {
        rehearsed += 1;
        continue;
      }
      const token = unsubscribeToken(doc.id, key)!;
      const message = studyReminderMessage({
        to: email,
        dueCount,
        appUrl: APP_URL,
        unsubscribeUrl: `${UNSUBSCRIBE_URL}?u=${encodeURIComponent(doc.id)}&t=${encodeURIComponent(token)}`,
        from: process.env.REMINDER_FROM ?? 'LocusMSK <hello@locusmsk.co.uk>',
        replyTo: process.env.REMINDER_REPLY_TO ?? 'michael@rehabme.uk',
      });
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) throw new Error(`send failed ${response.status}: ${(await response.text()).slice(0, 200)}`);
      await doc.ref.set({ [STUDY_REMINDER_FIELD]: { lastSentAt: now.toISOString() } }, { merge: true });
      sent += 1;
    } catch (error) {
      failures.push(`${doc.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const summary = `opted in ${snapshot.size}, sent ${sent}, nothing due or sent this week ${nothingDue}, rehearsed ${rehearsed}, failed ${failures.length}`;
  if (failures.length > 0) console.error(`study-reminders: ${summary} — ${failures.join('; ')}`);
  else console.info(`study-reminders: ${summary}`);
  return new Response(summary, { status: 200 });
}
