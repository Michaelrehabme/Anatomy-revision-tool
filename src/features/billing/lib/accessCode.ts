import { resolveEntitlement, hasStarted, type Entitlement } from '../../anatomy-revision/lib/entitlement';
import { parseEntitlement } from '../../anatomy-revision/lib/entitlementRecord';

/**
 * Access codes: a word handed out in a group chat that gives whoever types it
 * full access, free, until a fixed date.
 *
 * WHY NOT A PADDLE DISCOUNT. A discount there runs for a number of billing
 * periods from the day somebody subscribes, so it cannot end on a date; and it
 * is a checkout, so the student leaves with a real subscription that starts
 * charging when the discount runs out. What was asked for is neither: no
 * card, and over on 1 January for everybody. That is a `complimentary`
 * entitlement with an `expiresAt`, which the model has had since CR-027.
 *
 * A CODE IS NOT A SECRET. It is posted where anyone can forward it, so what
 * limits it is not who knows it but what it can do: a fixed end date, a cap
 * on how many accounts may redeem it, one redemption per account, and a
 * confirmed email address behind each one.
 *
 * EVERYTHING HERE DECIDES AND NOTHING WRITES, like billing/lib/paddleWebhook.
 * The function around it (netlify/functions/redeem-code.ts) is the plumbing.
 *
 * NEVER IMPORT THIS FILE FROM THE APP. It holds the codes, and although they
 * are not secret, a bundle that lists them is a list of every offer ever
 * made. The browser sends what was typed and is told what happened.
 */

export interface AccessCode {
  /** As redeemed: upper case, no spaces. What was typed is normalised to this. */
  code: string;
  /** ISO. Access ends here for everyone, whenever they redeemed. */
  accessUntil: string;
  /** How many accounts may redeem it. */
  maxRedemptions: number;
  /**
   * Whether an account holding it may teach: create a class, set work, invite
   * (educator/lib/teachingAccess.ts). False writes `teaching: false` into the
   * entitlement, which the app and firestore.rules both read.
   */
  teaching: boolean;
}

/**
 * The codes that exist.
 *
 * LOCUSMSK27 — the owner's decision, 12 October 2026: posted in student group
 * chats to be passed on, up to 100 accounts, every student feature until
 * 1 January 2027, and no teaching "unless discussed with me". The end is
 * midnight UTC, which in January is midnight in the UK.
 */
export const ACCESS_CODES: readonly AccessCode[] = [
  { code: 'LOCUSMSK27', accessUntil: '2027-01-01T00:00:00.000Z', maxRedemptions: 100, teaching: false },
];

/** Longest thing worth reading as a code; anything longer is not one. */
const MAX_CODE_LENGTH = 40;

/** What was typed, as a code would be stored: "locus msk27 " is LOCUSMSK27. */
export function normaliseCode(typed: unknown): string {
  if (typeof typed !== 'string' || typed.length > MAX_CODE_LENGTH) return '';
  return typed.replace(/\s+/g, '').toUpperCase();
}

export function findAccessCode(typed: unknown, codes: readonly AccessCode[] = ACCESS_CODES): AccessCode | null {
  const wanted = normaliseCode(typed);
  return (wanted && codes.find((c) => c.code === wanted)) || null;
}

/** Why a code was not redeemed. The app has a sentence for each (billing/RedeemCode.tsx). */
export type RedeemRefusal =
  /** Not signed in to an account: the anonymous sign-in every visitor gets. */
  | 'guest'
  /** An account whose email address has not been confirmed. */
  | 'unconfirmed'
  | 'unknown-code'
  /** Its end date has passed: there is nothing left to give. */
  | 'ended'
  /** Every redemption has been used. */
  | 'all-used'
  /** The account already has full access of its own, or has paid for some that has not started. */
  | 'has-access';

export type RedeemDecision =
  | { kind: 'grant'; entitlement: Record<string, unknown> }
  /** This account redeemed it before. Nothing is written or counted again. */
  | { kind: 'already'; accessUntil: string }
  | { kind: 'refuse'; reason: RedeemRefusal };

export interface RedeemInput {
  code: AccessCode;
  account: { anonymous: boolean; emailVerified: boolean };
  /** users/{uid}.entitlement as stored, if there is one. */
  current: Record<string, unknown> | undefined;
  /** How many accounts have redeemed it so far. */
  redeemed: number;
  /** Whether this account is one of them. */
  alreadyRedeemed: boolean;
  now: Date;
}

/**
 * What typing a code does.
 *
 * AN ACCOUNT, WITH A CONFIRMED ADDRESS. A guest has nothing to hold the
 * access once the browser is cleared, and an unconfirmed address is free to
 * invent: a hundred redemptions would be one person and a hundred made-up
 * addresses. The same line the free area draws (lib/emailVerification.ts).
 *
 * ONCE PER ACCOUNT, AND SAYING SO IS NOT A REFUSAL. A student who types it a
 * second time is told what they have. It is asked BEFORE "has access", or
 * everybody who redeemed would be told they already had full access from
 * somewhere else.
 *
 * NEVER OVER ACCESS THAT IS LIVE OR PAID FOR. The entitlement is one map, so
 * granting replaces it: a subscriber would lose the record their renewals and
 * refunds hang on, and the owner's permanent grant would gain an end date. A
 * subscription that has been bought and not yet started (the 14 days kept) is
 * refused for the same reason.
 *
 * OVER ONE THAT HAS RUN OUT, carrying what the webhook carries
 * (paddleWebhook.ts nextEntitlement): the consent given at checkout, the
 * customer id a former subscriber still needs for their invoices, and
 * `eventAt`, so a Paddle event older than the last one applied is still
 * turned away as stale instead of landing on top of this.
 */
export function decideRedemption(input: RedeemInput): RedeemDecision {
  const { code, account, current, redeemed, alreadyRedeemed, now } = input;
  if (account.anonymous) return { kind: 'refuse', reason: 'guest' };
  if (!account.emailVerified) return { kind: 'refuse', reason: 'unconfirmed' };
  if (alreadyRedeemed) return { kind: 'already', accessUntil: code.accessUntil };
  if (Date.parse(code.accessUntil) <= now.getTime()) return { kind: 'refuse', reason: 'ended' };

  const stored: Entitlement | null = parseEntitlement(current);
  if (stored) {
    const live = resolveEntitlement([stored], now).tier !== 'free';
    const pending = stored.tier !== 'free' && !hasStarted(stored, now);
    if (live || pending) return { kind: 'refuse', reason: 'has-access' };
  }

  if (redeemed >= code.maxRedemptions) return { kind: 'refuse', reason: 'all-used' };

  return {
    kind: 'grant',
    entitlement: Object.fromEntries(
      Object.entries({
        tier: 'individual',
        source: 'complimentary',
        expiresAt: code.accessUntil,
        accessCode: code.code,
        teaching: code.teaching ? undefined : false,
        consent: current?.consent,
        customerId: current?.customerId,
        eventAt: current?.eventAt,
      }).filter(([, v]) => v !== undefined),
    ),
  };
}
