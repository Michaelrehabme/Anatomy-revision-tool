import type { Entitlement } from '../../lib/entitlement';

/**
 * HOW LONG A FETCHED AREA MAY BE KEPT WITHOUT ASKING AGAIN
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, "How facts are served" and "Offline").
 *
 * The server hands every area out with a lease: the moment after which the
 * device must ask again before showing it. It is what lets a student revise
 * on a train — nothing is asked while the lease runs — without a cancelled
 * subscription keeping its content for ever.
 *
 * FOURTEEN DAYS, as designed. THE OWNER HAS NOT RULED ON IT
 * (docs/CONTENT-SERVER-STATUS.md, decision 10). What it means in practice: a
 * paying student who downloads an area and is then offline for more than two
 * weeks opens the app to pictures without facts, and is told to connect. Any
 * connection inside the two weeks renews it silently. Longer is kinder to
 * them and gives a lapsed subscriber the content for longer; this constant is
 * the whole of the decision.
 *
 * One file, two readers: the content function stamps the lease, and the app
 * decides when to renew one. Pure, so the function can import it.
 */
export const CONTENT_LEASE_DAYS = 14;

/**
 * Renew when less than this much of a lease is left, if the device is online.
 *
 * Half the lease. Renewing at the last minute would leave a student who goes
 * offline on day thirteen with one day; renewing every time the app opens
 * would be nine function calls a visit. At half, a student who opens the app
 * once a week while online always has at least a week in hand.
 */
export const CONTENT_LEASE_RENEW_WITHIN_DAYS = CONTENT_LEASE_DAYS / 2;

const DAY_MS = 86_400_000;

/**
 * When a lease granted now runs out: fourteen days on, or when the
 * entitlement that opened the area ends, whichever is sooner.
 *
 * So a subscription with three days left gives a three-day lease, a failed
 * renewal gives one that ends with its days of grace (the webhook has already
 * written that date as the expiry), and the free area — which no entitlement
 * ends — gets the full fourteen.
 */
export function leaseUntil(entitlement: Entitlement | null | undefined, now: Date = new Date()): string {
  const longest = now.getTime() + CONTENT_LEASE_DAYS * DAY_MS;
  const expires = entitlement && entitlement.tier !== 'free' && entitlement.expiresAt ? Date.parse(entitlement.expiresAt) : Number.NaN;
  // An unparseable expiry reads as "does not expire" everywhere else
  // (lib/entitlement.ts hasExpired); here that still means fourteen days.
  return new Date(Number.isNaN(expires) ? longest : Math.min(longest, expires)).toISOString();
}

/** Whether a lease has run out. Unreadable counts as run out: nothing is shown on a lease nobody can read. */
export function leaseExpired(until: string, now: Date = new Date()): boolean {
  const at = Date.parse(until);
  return Number.isNaN(at) || at <= now.getTime();
}

/** Whether a live lease is close enough to its end to be worth renewing while online. */
export function leaseNeedsRenewal(until: string, now: Date = new Date()): boolean {
  const at = Date.parse(until);
  return Number.isNaN(at) || at - now.getTime() < CONTENT_LEASE_RENEW_WITHIN_DAYS * DAY_MS;
}
