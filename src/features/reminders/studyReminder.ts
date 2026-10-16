/**
 * The weekly study reminder: an email that says how much is due for review,
 * sent only to a student who asked for it (owner's decision, 16 October 2026:
 * "they should tick a box, it's their own education, it's their choice").
 *
 * Shared by the Account screen's tick box, which writes the choice, and the
 * scheduled function that reads it (netlify/functions/study-reminders.ts).
 *
 * THE CHOICE LIVES ON THE STUDENT'S OWN PROFILE, users/{uid}.studyReminders,
 * which the rules already let them write and nobody else read but an admin.
 * `optedInAt` records when they said yes, which is what consent has to be
 * able to show. Turning it off keeps the record and sets `weekly` false.
 */

export const STUDY_REMINDER_FIELD = 'studyReminders';

export interface StudyReminderChoice {
  weekly: boolean;
  /** ISO time the student last ticked the box. */
  optedInAt?: string;
  /** ISO time it was last turned off, by the box or by an email's unsubscribe link. */
  optedOutAt?: string;
  /** ISO time the last reminder was sent. Written by the function. */
  lastSentAt?: string;
}

/** A second run in the same week (a retry, a manual run) must not send twice. */
const MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Whether this student gets an email this week. Nothing due, no email: a
 * reminder with nothing to do in it teaches people to ignore the next one.
 */
export function shouldSendStudyReminder(choice: StudyReminderChoice | undefined, dueCount: number, now: Date): boolean {
  if (!choice?.weekly || dueCount < 1) return false;
  if (choice.lastSentAt && now.getTime() - Date.parse(choice.lastSentAt) < MIN_GAP_MS) return false;
  return true;
}

export interface StudyReminderEmail {
  from: string;
  to: string;
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function studyReminderMessage(input: {
  to: string;
  dueCount: number;
  appUrl: string;
  unsubscribeUrl: string;
  from: string;
  replyTo: string;
}): StudyReminderEmail {
  const { dueCount } = input;
  const things = dueCount === 1 ? '1 structure is' : `${dueCount} structures are`;
  const subject = dueCount === 1 ? '1 structure is due for review' : `${dueCount} structures are due for review`;
  const text = [
    `${things} due for review on LocusMSK.`,
    '',
    'A short session now brings them back before you forget them.',
    `Start: ${input.appUrl}`,
    '',
    'You are getting this because you asked for a weekly reminder on your Account screen.',
    `Stop these emails: ${input.unsubscribeUrl}`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f4ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a44">
<p style="font-size:18px;margin:0 0 12px">${escapeHtml(things)} due for review on LocusMSK.</p>
<p style="font-size:15px;margin:0 0 20px;color:#4a5570">A short session now brings them back before you forget them.</p>
<p style="margin:0 0 28px"><a href="${escapeHtml(input.appUrl)}" style="display:inline-block;background:#2f6f6b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:3px;font-size:15px">Start a review</a></p>
<p style="font-size:12px;color:#6b7280;margin:0">You are getting this because you asked for a weekly reminder on your Account screen. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280">Stop these emails</a>.</p>
</body></html>`;
  return {
    from: input.from,
    to: input.to,
    reply_to: input.replyTo,
    subject,
    text,
    html,
    // One-click unsubscribe from the mail client's own button (RFC 8058).
    headers: {
      'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
