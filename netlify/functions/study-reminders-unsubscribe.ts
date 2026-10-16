import { adminDb } from './lib/firebaseAdmin';
import { unsubscribeTokenIsValid } from './lib/unsubscribeToken';
import { STUDY_REMINDER_FIELD } from '../../src/features/reminders/studyReminder';

/**
 * The "Stop these emails" link in a study reminder, and the mail client's own
 * one-click unsubscribe button (RFC 8058 sends a POST to the same address).
 *
 * No sign-in: stopping an email has to be one tap. The signed token in the
 * link (lib/unsubscribeToken.ts) is what makes it this student's link and
 * nobody else's. It only ever turns reminders OFF.
 */

const page = (message: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LocusMSK reminders</title></head><body style="margin:0;padding:32px 20px;background:#f7f4ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a44"><p style="font-size:18px;max-width:34em">${message}</p><p><a href="https://locusmsk.co.uk/account" style="color:#2f6f6b">Open your Account screen</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const uid = url.searchParams.get('u') ?? '';
  const token = url.searchParams.get('t') ?? '';
  if (!uid || !unsubscribeTokenIsValid(uid, token)) {
    return page('This link is not valid. You can turn the weekly reminder off on your Account screen.', 400);
  }
  await adminDb()
    .collection('users')
    .doc(uid)
    .set({ [STUDY_REMINDER_FIELD]: { weekly: false, optedOutAt: new Date().toISOString() } }, { merge: true });
  return page('Done. You will not get the weekly reminder any more. You can turn it back on from your Account screen at any time.');
}
