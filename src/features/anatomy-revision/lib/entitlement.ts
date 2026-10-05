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
  /**
   * How often this subscription bills, and when it first started.
   *
   * Stored for the renewal reminders. UK law requires an auto-renewal reminder
   * for subscription periods of six months or longer, which Paddle sends for
   * us; the monthly plan falls below that line and its reminders are ours to
   * send. Neither can be worked out from `expiresAt` alone — a period end says
   * nothing about how long the period was or how many have been paid.
   */
  interval?: 'month' | 'year';
  /** ISO, when the subscription first began. Stable across renewals. */
  startedAt?: string;
  /** Institutional only: which seat of the licence this consumes. */
  seatId?: string;
  /** The provider's own id, for reconciling a support question against their dashboard. */
  externalId?: string;
  /**
   * ISO, when an approved full refund ended this access early.
   *
   * Written by the payment webhook alone (billing/lib/paddleWebhook.ts), and
   * gone again the moment a later subscription event replaces the map. It is
   * here so the account screen can say why access stopped before the date a
   * student was first given: "ended" with no reason reads as a fault.
   */
  refundedAt?: string;
  /**
   * ISO, since when Paddle has reported this subscription's payment overdue.
   *
   * Set by the payment webhook while the subscription is `past_due` and gone
   * with the next event that says otherwise — active again, cancelled, or
   * refunded. It decides nothing about access, which is `expiresAt`'s job as
   * always; it exists so the app can say "your last payment did not go
   * through" instead of leaving a student to wonder why the regions relocked.
   */
  paymentIssueSince?: string;
  /**
   * ISO, when a cancelled subscription stops — the end of the paid period for
   * a cancellation scheduled from the portal, or the moment Paddle cancelled
   * it. Present means it WILL NOT RENEW; absent means nothing has said so.
   *
   * Without it the account screen told every subscriber their plan "renews"
   * on its expiry date, including the ones who had cancelled (paywall trace
   * finding 8), and a cancelled student could not delete their account until
   * the paid time ran out.
   */
  cancelAt?: string;
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

/**
 * The free area is the student's to CHOOSE, not ours to assign.
 *
 * A physiotherapy student starting on the lower limb got nothing from a free
 * tier fixed to the shoulder, and a free tier that teaches nothing sells
 * nothing. So the first area picked at onboarding becomes the free one, and
 * FREE_AREAS above is only the fallback for an account that has not chosen.
 *
 * ONE SWAP, AND NOT BEFORE 30 DAYS. Locking the choice at the first tap
 * punishes a student who picked wrong in week one, so they get a second
 * chance — once. Any more and a patient free account works through the whole
 * body an area at a time, which is the paid product given away slowly.
 *
 * The delay matters as much as the limit: a month is roughly a course block,
 * so the second choice is made by somebody who has actually used the thing,
 * rather than by somebody still clicking around on day one.
 */
export const FREE_AREA_SWITCH_DAYS = 30;

/** How many times the free area may be changed after the first pick. */
export const FREE_AREA_SWITCHES_ALLOWED = 1;

export interface FreeAreaChoice {
  area: Area;
  /** ISO, when it was chosen. The wait is counted from here. */
  chosenAt: string;
  /** Changes made since the first pick. At FREE_AREA_SWITCHES_ALLOWED the choice is final. */
  switches: number;
}

/** The areas the free tier opens: the chosen one, or the default if none was chosen. */
export function freeAreasFor(choice: FreeAreaChoice | null | undefined): readonly Area[] {
  return choice ? [choice.area] : FREE_AREAS;
}

/**
 * Days until the free area may be changed; 0 when it may be changed now, and
 * 0 also when the one change has already been used — ask canSwitchFreeArea
 * for that, since "0 days" and "never again" are different answers.
 *
 * An unparseable or future date reads as "changeable now", the same way an
 * unparseable expiry reads as live: a malformed record must never leave
 * somebody stuck with an area they cannot study.
 */
export function daysUntilFreeAreaSwitch(
  choice: FreeAreaChoice | null | undefined,
  now: Date = new Date(),
): number {
  if (!choice) return 0;
  const at = Date.parse(choice.chosenAt);
  if (Number.isNaN(at) || at > now.getTime()) return 0;
  const elapsed = (now.getTime() - at) / 86400000;
  return Math.max(0, Math.ceil(FREE_AREA_SWITCH_DAYS - elapsed));
}

/**
 * The day the free area becomes changeable, as "3 November 2026" — or null
 * when there is no wait to state (no choice yet, the wait is over, or the
 * record is malformed and reads as changeable now).
 *
 * A date AND a countdown, not a countdown alone: "23 days to go" is true only
 * on the day it is read, and a student who sees it on a Monday and comes back
 * on a Thursday has to do the sum. The date is the same every time they look.
 * It is the day daysUntilFreeAreaSwitch reaches 0, so the two cannot disagree.
 */
export function freeAreaSwitchDate(
  choice: FreeAreaChoice | null | undefined,
  now: Date = new Date(),
): string | null {
  const days = daysUntilFreeAreaSwitch(choice, now);
  if (!choice || days === 0) return null;
  const on = new Date(Date.parse(choice.chosenAt) + FREE_AREA_SWITCH_DAYS * 86400000);
  return on.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The areas a session-setup screen is really drawing from: what was picked,
 * or, when nothing was picked, every area this person can REACH.
 *
 * "Nothing selected" means "everything" on every picker, and for a free
 * account everything is one area. The setup screens used to count the whole
 * body for an empty selection, so a free student was told "All areas, 479
 * structures in the pool" above a session that could only ever draw from
 * their 51. The session was clamped correctly; the sentence describing it
 * was not.
 */
export function areasInScope(selected: ReadonlySet<Area>, entitled: readonly Area[]): ReadonlySet<Area> {
  return selected.size === 0 ? new Set(entitled) : selected;
}

/** Whether the one permitted change has already been made. */
export function hasUsedFreeAreaSwitch(choice: FreeAreaChoice | null | undefined): boolean {
  return (choice?.switches ?? 0) >= FREE_AREA_SWITCHES_ALLOWED;
}

export function canSwitchFreeArea(
  choice: FreeAreaChoice | null | undefined,
  now: Date = new Date(),
): boolean {
  // No choice yet is not a switch: the first pick is free and immediate.
  if (!choice) return true;
  if (hasUsedFreeAreaSwitch(choice)) return false;
  return daysUntilFreeAreaSwitch(choice, now) === 0;
}

const TIER_RANK: Record<EntitlementTier, number> = { free: 0, individual: 1, institutional: 2 };

/**
 * Since when a Paddle subscription's payment has been overdue, or null.
 *
 * Only ever true of a subscription bought through Paddle: a stray field on a
 * licence or a complimentary grant — left behind by a merge, say — must not
 * tell somebody who pays nothing that their payment failed.
 */
export function paymentIssueSince(entitlement: Entitlement | null | undefined): string | null {
  if (!entitlement || entitlement.source !== 'paddle' || entitlement.tier === 'free') return null;
  return entitlement.paymentIssueSince ?? null;
}

/** Whether a Paddle subscription has been cancelled, now or from a date to come. It will not charge again. */
export function isCancelled(entitlement: Entitlement | null | undefined): boolean {
  return !!entitlement && entitlement.source === 'paddle' && typeof entitlement.cancelAt === 'string';
}

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

/**
 * The entitlement to HAND the app: the active one when there is one, else the
 * record worth telling the student about — a paid subscription that has not
 * started yet, or failing that the one that most recently ended.
 *
 * resolveEntitlement alone returned FREE for both, so a student who paid with
 * a delayed start (keeping their 14-day cancellation right) read as free: the
 * pricing page timed out and offered the plans again, Manage subscription was
 * hidden for exactly the window in which they may cancel for a refund, and
 * "your subscription ended" could never show (paywall trace finding 3,
 * docs/PAYWALL-TRACE-2026-09-29.md). Returning the stored record is safe for
 * the gates: every one asks effectiveTier, which is free until it starts and
 * after it ends.
 */
export function entitlementToShow(candidates: readonly Entitlement[], now: Date = new Date()): Entitlement {
  const active = resolveEntitlement(candidates, now);
  if (active.tier !== 'free') return active;
  const paid = candidates.filter((e) => e.tier !== 'free');
  const pending = paid
    .filter((e) => !hasStarted(e, now))
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))[0];
  if (pending) return pending;
  const lapsed = paid
    .filter((e) => hasExpired(e, now) && e.expiresAt)
    .sort((a, b) => (b.expiresAt ?? '').localeCompare(a.expiresAt ?? ''))[0];
  return lapsed ?? FREE_ENTITLEMENT;
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

/**
 * The areas this entitlement DOES reach — the allow-list every session, picker
 * and drill is clamped to.
 *
 * The counterpart of lockedAreas below, and the one gates should prefer: an
 * allow-list fails closed when a new area is added to the dataset, where a
 * deny-list silently hands it out.
 */
export function entitledAreas(
  allAreas: readonly Area[],
  entitlement: Entitlement | null | undefined,
  now: Date = new Date(),
  freeAreas: readonly Area[] = FREE_AREAS,
): Area[] {
  return allAreas.filter((a) => canAccessArea(a, entitlement, now, freeAreas));
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
