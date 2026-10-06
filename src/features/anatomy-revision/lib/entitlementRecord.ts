import type { Area } from '../types/region';
import {
  FREE_ENTITLEMENT,
  canAccessArea,
  entitlementToShow,
  resolveEntitlement,
  type Entitlement,
  type EntitlementSource,
  type EntitlementTier,
  type FreeAreaChoice,
} from './entitlement';
import { parseStoredFreeArea } from './freeAreaRecord';

/**
 * From the two documents that say what an account may reach — users/{uid} and,
 * for a class member, cohorts/{id} — to an answer.
 *
 * ONE READING, TWO READERS. The browser reads these documents with the web
 * SDK to decide what to draw (data/entitlementRepository.ts), and the content
 * function reads the same two with the Admin SDK to decide what to serve
 * (netlify/functions/content-area.ts). If each parsed them its own way they
 * would disagree sooner or later, and the disagreement would be a student
 * shown an open area whose facts the server then refuses, or the reverse.
 * So the parsing and the decision live here, pure, with no SDK in sight, and
 * both ends are handed plain data.
 *
 * Nothing here grants. It reads what the payment webhook or an admin wrote.
 */

const TIERS: EntitlementTier[] = ['free', 'individual', 'institutional'];
const SOURCES: EntitlementSource[] = ['paddle', 'apple', 'google', 'licence', 'complimentary'];

/**
 * A stored value is only an entitlement if it says so in terms this build
 * recognises. An unknown tier reads as nothing rather than as access: the
 * failure mode of a typo, a half-finished migration or a future tier this
 * version has never heard of should be a locked door, not an open one.
 */
export function parseEntitlement(raw: unknown): Entitlement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const tier = r.tier as EntitlementTier;
  if (!TIERS.includes(tier)) return null;

  const source = SOURCES.includes(r.source as EntitlementSource) ? (r.source as EntitlementSource) : null;
  const expiresAt = typeof r.expiresAt === 'string' ? r.expiresAt : null;

  return {
    tier,
    source,
    expiresAt,
    ...(typeof r.startsAt === 'string' ? { startsAt: r.startsAt } : {}),
    ...(typeof r.seatId === 'string' ? { seatId: r.seatId } : {}),
    ...(typeof r.externalId === 'string' ? { externalId: r.externalId } : {}),
    ...(typeof r.refundedAt === 'string' ? { refundedAt: r.refundedAt } : {}),
    ...(typeof r.paymentIssueSince === 'string' ? { paymentIssueSince: r.paymentIssueSince } : {}),
    ...(typeof r.cancelAt === 'string' ? { cancelAt: r.cancelAt } : {}),
  };
}

type Fields = Record<string, unknown> | null | undefined;

/**
 * The entitlements stored on a user document. An array is supported because a
 * person can hold two: their own subscription and a seat on a licence.
 */
export function storedEntitlements(user: Fields): Entitlement[] {
  const raw = user?.entitlement;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(parseEntitlement).filter((e): e is Entitlement => e !== null);
}

/** The class this account has joined, or null. */
export function cohortIdOf(user: Fields): string | null {
  const cohort = user?.cohort;
  return typeof cohort === 'string' && cohort ? cohort : null;
}

/**
 * The entitlement a licensed cohort gives its members (CR-027's institutional
 * tier), or null when the cohort is unlicensed or was not found.
 *
 * DERIVED, NOT STORED, and deliberately so. A pilot cohort's students arrive
 * over weeks — some on the first day, some in week six — and a stored grant
 * would mean a server write per student per join, which is a queue of things
 * to go wrong before a course lead's first lecture. Membership already proves
 * itself: firestore.rules refuses a change to `cohort` that arrives without a
 * join code or an invitation, and pins `licensedUntil` against the educator
 * who owns the cohort.
 *
 * The seat id is the cohort id: there are no numbered seats yet, and a pilot
 * does not need them. When licences are sold by seat count this is where that
 * accounting goes.
 */
export function licenceEntitlement(cohortId: string, cohort: Fields): Entitlement | null {
  const licensedUntil = cohort?.licensedUntil;
  if (typeof licensedUntil !== 'string') return null;
  return { tier: 'institutional', source: 'licence', expiresAt: licensedUntil, seatId: cohortId };
}

/** What a repository hands the app: the entitlement to show and the stored free area. */
export interface StoredAccess {
  /** The entitlement to show, or null when the account holds none. */
  entitlement: Entitlement | null;
  /** The free area stored on the account, or null when none has been chosen there yet. */
  freeArea: FreeAreaChoice | null;
}

/** Everything the two documents say, before anything is decided from it. */
export interface AccessRecord {
  /** Every entitlement this account holds: its own, and its class's licence if there is one. */
  candidates: Entitlement[];
  /** The free area stored on the account, or null when none has been chosen there. */
  freeArea: FreeAreaChoice | null;
}

/**
 * `cohort` is the class document named by cohortIdOf(user), or null/undefined
 * when the account is in no class or the class could not be found.
 */
export function accessRecord(user: Fields, cohort: Fields, now: Date = new Date()): AccessRecord {
  const candidates = storedEntitlements(user);
  const cohortId = cohortIdOf(user);
  const licence = cohortId && cohort ? licenceEntitlement(cohortId, cohort) : null;
  if (licence) candidates.push(licence);
  return { candidates, freeArea: parseStoredFreeArea(user?.freeArea, now) };
}

/**
 * The entitlement to hand the app's screens: the one in force, else the one
 * worth telling the student about (see entitlementToShow), else null.
 */
export function entitlementForDisplay(record: AccessRecord, now: Date = new Date()): Entitlement | null {
  return record.candidates.length > 0 ? entitlementToShow(record.candidates, now) : null;
}

/** What the server tells a client about an area it may have. */
export interface AreaAccess {
  allowed: boolean;
  /** The entitlement in force. `free` for an account reaching its free area. */
  entitlement: Entitlement;
}

/**
 * THE GATE, as the server applies it: may this account have this area now?
 *
 * Built from the same three calls every gate in the app makes —
 * resolveEntitlement, freeAreasFor, canAccessArea (lib/entitlement.ts) — so a
 * rule changed there (the three days of payment grace, a cancellation date, a
 * refund, a delayed start, a licence) changes here in the same commit, without
 * anyone remembering that the server has a copy. It does not have a copy.
 *
 * TWO THINGS THE SERVER SAYS NO TO, both decided on 6 Oct 2026, both also
 * what the app's own hook now reports (hooks/useEntitlement.ts):
 *
 *   - A GUEST HAS NOTHING (`guest`). The anonymous sign-in every visitor
 *     gets is not an account, and the free area needs one. Whatever a
 *     guest's document holds — a free area written before this rule, a
 *     class's licence — the answer is no until they create an account, at
 *     which point the same uid, with everything it had, is asked about again.
 *
 *   - THERE IS NO DEFAULT FREE AREA. An account that has not chosen used to
 *     be served the shoulder, which is how a new student's device came to
 *     hold two areas: the shoulder on first load, then the one they picked.
 *     Not chosen now means not served. (A build with no accounts keeps the
 *     default, in the hook; it never asks this function anything.)
 */
export function areaAccess(
  area: Area,
  record: AccessRecord,
  now: Date = new Date(),
  who: { guest?: boolean } = {},
): AreaAccess {
  if (who.guest) return { allowed: false, entitlement: FREE_ENTITLEMENT };
  const entitlement = resolveEntitlement(record.candidates, now);
  return {
    allowed: canAccessArea(area, entitlement, now, record.freeArea ? [record.freeArea.area] : []),
    entitlement,
  };
}
