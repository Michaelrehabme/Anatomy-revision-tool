import type { Area } from '../types/region';

/**
 * What a person is entitled to, and nothing about how they paid for it.
 *
 * CR-027 item 1. Every gate in the product asks this module, never a payment
 * provider, and that separation is the whole point: pricing, providers and
 * platforms change, and feature code should not notice. The same subscription
 * bought through Paddle on the web and through Apple in the iOS app produces
 * the same entitlement, because a student who paid twice over would otherwise
 * be told they had paid for different things.
 *
 * THE ENTITLEMENT IS WRITTEN SERVER-SIDE ONLY. firestore.rules forbids a client
 * writing its own, because a paywall a user can lift by editing a document is
 * decoration. Everything here computes and reads; nothing here grants.
 *
 * A LAPSED SUBSCRIBER LOSES ACCESS, NOT HISTORY. Expiry drops the tier back to
 * free. It never touches attempts, mastery, streaks or class membership, and
 * the free area stays open — somebody who paid for a term and stopped should
 * find their work where they left it, not a locked door.
 */

/** What someone can reach. Ordered: a later tier includes everything before it. */
export type EntitlementTier = 'free' | 'individual' | 'institutional';

/**
 * Where the entitlement came from. Recorded for support and reconciliation —
 * never for deciding access, which is `tier`'s job alone.
 *
 * `complimentary` is the pilot case: a cohort given a year at no charge. It is
 * a first-class source rather than a fake subscription, because a pilot that
 * looked like a payment in the data would corrupt every revenue figure the
 * February conversation depends on.
 */
export type EntitlementSource = 'paddle' | 'apple' | 'google' | 'licence' | 'complimentary';

export interface Entitlement {
  tier: EntitlementTier;
  /** Null on the free tier, which nobody grants and nobody pays for. */
  source: EntitlementSource | null;
  /** ISO, or null for an entitlement that does not expire. */
  expiresAt: string | null;
  /**
   * ISO, when access begins; absent means it already has.
   *
   * Exists for exactly one promise. /refunds tells a student that if they keep
   * their 14-day cancellation right instead of waiving it, their access starts
   * 14 days later. Without a start date there was no way to keep that promise:
   * an entitlement could only say when access ENDED, so a paid subscription
   * was either live immediately or not at all. A published commitment the
   * data model cannot express is a commitment waiting to be broken.
   */
  startsAt?: string;
  /** Institutional only: which seat of the licence this consumes. */
  seatId?: string;
  /** The provider's own id, for reconciling a support question against their dashboard. */
  externalId?: string;
}

/** What every account has before anyone pays anything. */
export const FREE_ENTITLEMENT: Entitlement = { tier: 'free', source: null, expiresAt: null };

/**
 * The permanently free area.
 *
 * CR-027 is explicit that this is one COMPLETE area with every question type,
 * not a trial and not a crippled demo — every competitor has a free tier, and
 * a free tier that cannot teach anything sells nothing.
 *
 * Configurable rather than hardcoded, as that item requires. It is a constant
 * here rather than a literal scattered through the gates, so changing which
 * area is free is one edit and cannot half-apply.
 *
 * Shoulder because it is where a musculoskeletal course usually starts, and
 * because it is one of the best-covered areas in the dataset — the free tier
 * should show the product at its best, not at its thinnest.
 */
export const FREE_AREAS: readonly Area[] = ['shoulder'];

const TIER_RANK: Record<EntitlementTier, number> = { free: 0, individual: 1, institutional: 2 };

/** Whether an entitlement has run out. A null expiry never expires. */
export function hasExpired(entitlement: Entitlement, now: Date = new Date()): boolean {
  if (!entitlement.expiresAt) return false;
  const at = Date.parse(entitlement.expiresAt);
  // An unparseable date is treated as NOT expired: the cost of being wrong is
  // locking out somebody who paid, against briefly over-serving somebody whose
  // record is malformed. Those are not the same mistake.
  if (Number.isNaN(at)) return false;
  return at <= now.getTime();
}

/** Whether access has begun. An entitlement with no start date began when it was granted. */
export function hasStarted(entitlement: Entitlement, now: Date = new Date()): boolean {
  if (!entitlement.startsAt) return true;
  const at = Date.parse(entitlement.startsAt);
  // Unparseable reads as started, for the same reason an unparseable expiry
  // reads as live: a malformed date must not lock out somebody who paid.
  if (Number.isNaN(at)) return true;
  return at <= now.getTime();
}

/**
 * The tier actually in force, which is `free` once an entitlement has lapsed.
 *
 * Every gate should ask this rather than reading `.tier`, because a stored
 * entitlement keeps its tier after expiry — the record of what somebody bought
 * is worth keeping, and is what makes a renewal prompt possible.
 */
export function effectiveTier(entitlement: Entitlement | null | undefined, now: Date = new Date()): EntitlementTier {
  if (!entitlement) return 'free';
  if (!hasStarted(entitlement, now)) return 'free';
  return hasExpired(entitlement, now) ? 'free' : entitlement.tier;
}

/**
 * The entitlement that wins when somebody holds more than one.
 *
 * It happens more than it sounds: a student subscribes, their university then
 * buys a licence, and both are live. The rule is highest active tier first,
 * then latest expiry — so an institutional seat beats a personal subscription,
 * and between two of a kind the one that lasts longer wins.
 *
 * Deliberately never merges them. Two entitlements are two facts, and a
 * synthesised third would have a seat id belonging to one and an expiry
 * belonging to the other, which is a record of something that never happened.
 */
export function resolveEntitlement(
  candidates: readonly Entitlement[],
  now: Date = new Date(),
): Entitlement {
  const active = candidates.filter((e) => hasStarted(e, now) && !hasExpired(e, now) && e.tier !== 'free');
  if (active.length === 0) return FREE_ENTITLEMENT;

  return [...active].sort((a, b) => {
    const byTier = TIER_RANK[b.tier] - TIER_RANK[a.tier];
    if (byTier !== 0) return byTier;
    // A null expiry outlasts every date.
    if (a.expiresAt === null) return -1;
    if (b.expiresAt === null) return 1;
    return b.expiresAt.localeCompare(a.expiresAt);
  })[0];
}

/** Whether the free tier reaches this area. */
export function isFreeArea(area: Area, freeAreas: readonly Area[] = FREE_AREAS): boolean {
  return freeAreas.includes(area);
}

/**
 * The gate. Can this entitlement reach this area?
 *
 * Takes areas rather than structures or questions on purpose: the free tier is
 * defined by area, so a gate that took a structure would have to resolve its
 * areas first, and every caller would resolve them slightly differently.
 */
export function canAccessArea(
  area: Area,
  entitlement: Entitlement | null | undefined,
  now: Date = new Date(),
  freeAreas: readonly Area[] = FREE_AREAS,
): boolean {
  if (isFreeArea(area, freeAreas)) return true;
  return effectiveTier(entitlement, now) !== 'free';
}

/** Areas this entitlement cannot reach — what a paywall offers to unlock. */
export function lockedAreas(
  allAreas: readonly Area[],
  entitlement: Entitlement | null | undefined,
  now: Date = new Date(),
  freeAreas: readonly Area[] = FREE_AREAS,
): Area[] {
  return allAreas.filter((a) => !canAccessArea(a, entitlement, now, freeAreas));
}

/**
 * Days until this entitlement lapses; null when it does not, or already has.
 *
 * For a renewal prompt. Rounded up, so "1 day left" covers the last few hours
 * rather than showing zero to somebody who still has access.
 */
export function daysUntilExpiry(entitlement: Entitlement | null | undefined, now: Date = new Date()): number | null {
  if (!entitlement?.expiresAt) return null;
  const at = Date.parse(entitlement.expiresAt);
  if (Number.isNaN(at) || at <= now.getTime()) return null;
  return Math.ceil((at - now.getTime()) / 86400000);
}
