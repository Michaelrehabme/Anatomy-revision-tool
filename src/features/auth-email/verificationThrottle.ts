/**
 * How often one account may have its confirmation email sent by the app
 * (netlify/functions/send-verification-email.ts). Firebase's own limit does
 * not cover a link the server makes, so this stands in for it.
 *
 * Generous enough that nobody who is genuinely waiting for an email meets it
 * (the screen already asks for a minute between resends,
 * lib/emailVerification.ts), tight enough that a stolen token cannot turn
 * the sender into a way to flood one inbox.
 */

/** Never two within this long. Below the screen's own minute, so the screen's wait is what people meet. */
export const MIN_GAP_MS = 30_000;
/** At most this many in any 24 hours. */
export const MAX_PER_DAY = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What is kept under verificationEmails/{uid}: when each recent email went, ISO strings, oldest first. */
export interface VerificationSendRecord {
  sentAt: string[];
}

export type VerificationSendDecision =
  | { send: true; record: VerificationSendRecord }
  | { send: false; reason: 'too-soon' | 'daily-limit' };

export function decideVerificationSend(record: VerificationSendRecord | undefined, now: Date): VerificationSendDecision {
  const t = now.getTime();
  const recent = (Array.isArray(record?.sentAt) ? record.sentAt : [])
    .map((s) => Date.parse(s))
    .filter((ms) => Number.isFinite(ms) && ms > t - DAY_MS && ms <= t)
    .sort((a, b) => a - b);
  const last = recent[recent.length - 1];
  if (last !== undefined && t - last < MIN_GAP_MS) return { send: false, reason: 'too-soon' };
  if (recent.length >= MAX_PER_DAY) return { send: false, reason: 'daily-limit' };
  return { send: true, record: { sentAt: [...recent, t].map((ms) => new Date(ms).toISOString()) } };
}
