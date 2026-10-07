/**
 * A CONFIRMED EMAIL ADDRESS BEFORE THE FREE AREA (owner's decision, 7 Oct 2026).
 *
 * The free tier is one area per account, and an email-and-password account
 * used to need only an address that looked like one: nine made-up addresses
 * were nine free areas. A free account must now have CONFIRMED its address —
 * followed the link Firebase emails it — before it can choose a free area,
 * and so before it can open a fact or start a session. Google's sign-in
 * arrives already confirmed.
 *
 * THE RULE, said once, and applied in three places that must agree — the
 * database (firestore.rules), the content function
 * (netlify/functions/content-area.ts, through lib/entitlementRecord
 * areaAccess) and the app (hooks/useEntitlement.ts):
 *
 *   1. FULL ACCESS IS NEVER HELD BACK BY THIS. A subscriber, a complimentary
 *      or institutional account, a member of a licensed class: what they
 *      hold is served and shown whether their address is confirmed or not.
 *      Confirmation gates the FREE area and nothing else.
 *
 *   2. An account that is NOT confirmed may not CHOOSE a free area, may not
 *      CHANGE one, and is not SERVED one —
 *
 *   3. — EXCEPT AN ACCOUNT THAT WAS HERE BEFORE THE RULE. Nobody was ever
 *      sent a confirmation email before this, so every email-and-password
 *      account on the live site is unconfirmed through no doing of its own.
 *      Such an account keeps the one free area it has, with its progress,
 *      and goes on being served it. (Its area was on the DEVICE, not the
 *      account, in the live build; moving it up to the account is that
 *      account's "first choice" as far as the database is concerned, and is
 *      allowed for the same reason.) What it must confirm for is CHANGING
 *      its area. One free area per existing account is what they had; the
 *      aim — no more than one — is met without locking anybody out.
 *
 * "HERE BEFORE THE RULE" is read off `createdAt` on users/{uid}: the server's
 * time of the profile's first write, which the rules now pin (it can be
 * moved LATER, never earlier, and a profile deleted and made again is new).
 * It is the only thing about an account's age the database can see.
 *
 * WHAT THAT CANNOT TELL APART, said plainly: an account that existed before
 * the rule, and a GUEST who existed before the rule and creates an account
 * after it. Both have an old profile. The database and the function treat
 * them alike; the APP asks the second to confirm like any new sign-up
 * (it knows, because it is the one creating the account: see
 * `markConfirmationRequired`). The set is closed — no profile can be given an
 * old date after the fact — so it cannot be farmed.
 */

/**
 * The moment the rule starts: a profile first written before it is an
 * existing account. ISO, UTC.
 *
 * firestore.rules repeats it as `timestamp.date(2026, 10, 7)` because rules
 * can import nothing; lib/__tests__/emailVerification.test.ts fails if the
 * two drift.
 *
 * It may be moved LATER, to the day the new app is released, so that people
 * who signed up on the old app in between are also treated as existing
 * accounts. It must NEVER be in the future when it is deployed: until that
 * date every new sign-up would count as "here before the rule".
 */
export const VERIFICATION_STARTS = '2026-10-07T00:00:00.000Z';

/** A Firestore timestamp from either SDK, a Date, an ISO string, or milliseconds — as milliseconds, or null. */
function millisOf(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
  }
  return null;
}

/**
 * Whether a profile was first written before the rule started: the value of
 * `createdAt` on users/{uid}. A profile with no readable date is NOT an
 * existing account — the rules say the same — so the answer to "could not
 * tell" on the server is "confirm".
 */
export function predatesVerification(createdAt: unknown): boolean {
  const at = millisOf(createdAt);
  return at !== null && at < Date.parse(VERIFICATION_STARTS);
}

/** What is known about the caller's address. */
export interface EmailStanding {
  /** The address is confirmed (Google, or the emailed link followed). */
  emailVerified: boolean;
  /** The profile was first written before the rule started. */
  predatesVerification: boolean;
}

/** May this account HOLD AND BE SERVED a free area it has chosen? Rule 2 with exception 3. */
export function mayHoldFreeArea(standing: EmailStanding): boolean {
  return standing.emailVerified || standing.predatesVerification;
}

/** May this account CHANGE its free area? Never without a confirmed address. */
export function mayChangeFreeArea(standing: Pick<EmailStanding, 'emailVerified'>): boolean {
  return standing.emailVerified;
}

// ---------------------------------------------------------------------------
// What the app remembers on the device about the confirmation email.
// ---------------------------------------------------------------------------

/**
 * How long the app makes someone wait between two emails it sends them.
 * Firebase has a limit of its own, which it does not publish and which is
 * stricter for one address asked for many times; the screen says so when
 * Firebase refuses (auth/too-many-requests).
 */
export const RESEND_WAIT_MS = 60_000;

/** One record per account, on the device. Nothing in it is trusted by any server. */
export interface ConfirmationRecord {
  /** The address the last email went to. */
  email: string | null;
  /** When the app last sent one, or null if it has not. */
  sentAt: number | null;
  /**
   * This account was CREATED BY THIS APP, after the rule: it is asked to
   * confirm before its free area even if its profile is old (a guest from
   * before the rule who has just made an account).
   */
  required: boolean;
}

const KEY = (uid: string) => `anatomy-revision:v1:email-confirmation:${uid}`;

export function readConfirmationRecord(uid: string): ConfirmationRecord | null {
  try {
    const raw = localStorage.getItem(KEY(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConfirmationRecord>;
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      sentAt: typeof parsed.sentAt === 'number' ? parsed.sentAt : null,
      required: parsed.required === true,
    };
  } catch {
    return null;
  }
}

function write(uid: string, record: ConfirmationRecord): void {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(record));
  } catch {
    // Storage is full or closed: the worst case is one more email than needed.
  }
}

/** This app has just created the account: it confirms before its free area. */
export function markConfirmationRequired(uid: string, email: string | null): void {
  const before = readConfirmationRecord(uid);
  write(uid, { email, sentAt: before?.email === email ? before.sentAt : null, required: true });
}

/** An email has just gone to this address. */
export function recordConfirmationSent(uid: string, email: string | null, now: number = Date.now()): void {
  write(uid, { email, sentAt: now, required: readConfirmationRecord(uid)?.required ?? false });
}

/** The address is confirmed, or the account is gone: nothing more to remember. */
export function clearConfirmationRecord(uid: string): void {
  try {
    localStorage.removeItem(KEY(uid));
  } catch {
    // Nothing to do.
  }
}

/** Milliseconds until the app will send another email to this account; 0 when it will now. */
export function resendWaitLeft(record: ConfirmationRecord | null, email: string | null, now: number = Date.now()): number {
  if (!record || record.sentAt === null || record.email !== email) return 0;
  return Math.max(0, record.sentAt + RESEND_WAIT_MS - now);
}

/**
 * What the app has learned about whether a profile predates the rule, kept
 * so that an offline start does not have to guess. `null`: never learned.
 */
const PREDATES_KEY = (uid: string) => `anatomy-revision:v1:predates-verification:${uid}`;

export function rememberPredates(uid: string, predates: boolean): void {
  try {
    localStorage.setItem(PREDATES_KEY(uid), predates ? '1' : '0');
  } catch {
    // Nothing to do.
  }
}

export function rememberedPredates(uid: string): boolean | null {
  try {
    const raw = localStorage.getItem(PREDATES_KEY(uid));
    return raw === '1' ? true : raw === '0' ? false : null;
  } catch {
    return null;
  }
}
