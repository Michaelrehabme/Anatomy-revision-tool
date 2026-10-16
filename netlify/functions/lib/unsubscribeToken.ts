import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The token in a study reminder's unsubscribe link: proof that the link was
 * made by this server for this account, so that stopping someone's emails
 * needs their email, not just their account id.
 *
 * Signed with STUDY_REMINDER_SECRET if it is set, else with RESEND_API_KEY,
 * which is already a server-only secret that exists wherever an email can be
 * sent at all. Changing the secret invalidates links in emails already sent,
 * which only means those students unsubscribe from the Account screen.
 */

function secret(): string | null {
  return process.env.STUDY_REMINDER_SECRET || process.env.RESEND_API_KEY || null;
}

export function unsubscribeToken(uid: string, key = secret()): string | null {
  if (!key) return null;
  return createHmac('sha256', key).update(`study-reminders:${uid}`).digest('base64url');
}

export function unsubscribeTokenIsValid(uid: string, token: string, key = secret()): boolean {
  const expected = unsubscribeToken(uid, key);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
