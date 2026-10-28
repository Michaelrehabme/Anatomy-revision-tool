/**
 * The access code the home page advertises, and the code a visitor is in the
 * middle of claiming.
 *
 * PUBLIC ON PURPOSE. The owner's decision, 28 October 2026: LocusMSK27 is
 * printed on the home page, so a visitor never has to be handed it. What the
 * code GIVES is still decided on the server (billing/lib/accessCode.ts, which
 * the app must never import); this only says what to show, and
 * codeOffer.test.ts fails if the two disagree on the code or its end date.
 *
 * THE PENDING CODE. A student who signs up by email has to leave for their
 * inbox before the server will take the code (it refuses unconfirmed
 * accounts). It is kept on this device across that trip, so they come back
 * to a code that applies by itself rather than a box to find and type into
 * again. Cleared once the server has given its last word on it.
 */

export const CODE_OFFER = {
  /** As it is printed. The server ignores case and spaces. */
  code: 'LocusMSK27',
  /** Must match accessUntil in billing/lib/accessCode.ts. */
  until: '2027-01-01T00:00:00.000Z',
  untilLabel: '1 January 2027',
} as const;

/** Where every "Claim" button goes: the pricing page, with the code typed. */
export const CLAIM_HREF = `/pricing?code=${CODE_OFFER.code}`;

/** Whether the home page should still advertise the code. It comes down by itself when the code ends. */
export function codeOfferOpen(now: number = Date.now()): boolean {
  return now < Date.parse(CODE_OFFER.until);
}

const PENDING_KEY = 'anatomy-revision:v1:pendingCode';

/** The code this device is part way through claiming, if any. */
export function readPendingCode(): string | null {
  try {
    const code = localStorage.getItem(PENDING_KEY);
    return code && code.trim() ? code : null;
  } catch {
    return null;
  }
}

export function savePendingCode(code: string): void {
  if (!code.trim()) return;
  try {
    localStorage.setItem(PENDING_KEY, code.trim());
  } catch {
    // Storage blocked: the code is still in the address bar for this visit.
  }
}

export function clearPendingCode(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}
