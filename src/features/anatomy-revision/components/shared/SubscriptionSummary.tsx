import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { freeAreaSwitchDate, hasExpired, hasStarted, isCancelled, paymentIssueSince } from '../../lib/entitlement';
import { PaymentIssue } from './PaymentIssue';
import { AREAS, AREA_LABELS, type Area } from '../../types/region';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * The account screen's billing block: what you have, which area is free, and
 * the way to /pricing.
 *
 * THE FREE-AREA SWAP LIVES HERE because this is the one screen a student
 * already visits to see what they are paying for, and the swap is a
 * consequence of being on the free plan rather than a study setting. It is
 * offered ONCE, from 30 days after the first pick — see FREE_AREA_SWITCH_DAYS
 * and FREE_AREA_SWITCHES_ALLOWED — and the wait is stated, with its date,
 * rather than hidden behind a disabled control with no explanation.
 *
 * Returns nothing in the public demo, which has no /pricing route. A link
 * there would just bounce the visitor back to the home screen.
 */

const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

/**
 * Lazy, and null in the demo: it fetches a billing portal link, which the
 * demo has no account to ask about. Same treatment as the pricing page in
 * App.tsx.
 */
const ManageSubscription = PUBLIC_DEMO ? null : lazy(() => import('../../../billing/ManageSubscription'));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function SubscriptionSummary({ access }: { access: UseEntitlement }) {
  const { entitlement, tier, loading, freeArea, canSwitchFree, daysUntilSwitch, switchUsed, chooseFreeArea } = access;
  if (PUBLIC_DEMO || loading) return null;

  const pending = entitlement.tier !== 'free' && !hasStarted(entitlement);
  /**
   * Bought something, and it has run out. Worth saying out loud: the regions
   * simply relock, and a student who does not know why assumes the app broke.
   * Only shown for a lapse — an ACTIVE subscription's expiry date is its
   * renewal date, and warning about that would be a false alarm every month.
   */
  const lapsed = entitlement.tier !== 'free' && hasExpired(entitlement);
  const free = freeArea?.area ?? 'shoulder';
  /**
   * A failed renewal is not a subscription that "ended": it is still there,
   * waiting for a card that works, and the notice above the line says so.
   * The line then states only the date: until it, during the days of grace
   * (PAYMENT_GRACE_DAYS); stopped on it, after. And it does not say "renews"
   * on a date that is the end of a grace, not a charge.
   */
  const unpaid = paymentIssueSince(entitlement) !== null;
  const status = pending && entitlement.startsAt
    ? `Subscribed. Access starts ${formatDate(entitlement.startsAt)}.`
    : lapsed && entitlement.expiresAt && unpaid
      ? `Full access stopped on ${formatDate(entitlement.expiresAt)}. Free: ${AREA_LABELS[free].toLowerCase()} only.`
    : lapsed && entitlement.expiresAt
      // A refund ends access before the date the student was first given
      // (the webhook's handleAdjustment). Saying why is the difference
      // between "that is right" and "the app has lost my subscription".
      ? `Your subscription ${entitlement.refundedAt ? 'was refunded and ended' : 'ended'} on ${formatDate(entitlement.expiresAt)}. Free: ${AREA_LABELS[free].toLowerCase()} only.`
      : tier === 'free'
        ? `Free: ${AREA_LABELS[free].toLowerCase()} only.`
        : entitlement.expiresAt && unpaid
          ? `Full access until ${formatDate(entitlement.expiresAt)}. Your last payment did not go through.`
        : entitlement.expiresAt
          // "Renews" only of a subscription nothing has cancelled. A cancelled
          // one keeps what was paid for and then stops, and used to be told it
          // renewed (finding 8). A licence or a comped year never renews
          // either, and is not a subscription to cancel.
          ? isCancelled(entitlement)
            ? `Full access until ${formatDate(entitlement.expiresAt)}, when it ends. Your subscription is cancelled and will not renew.`
            : entitlement.source === 'paddle'
              ? `Full access until ${formatDate(entitlement.expiresAt)}, when it renews.`
              : `Full access until ${formatDate(entitlement.expiresAt)}.`
          : 'Full access.';

  return (
    <div className="mt-4" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
      <PaymentIssue access={access} placement="account" className="mb-4" />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span data-testid="subscription-status">{status}</span>
        <Link to="/pricing" style={{ color: 'var(--accd)' }}>
          {tier === 'free' && !pending ? 'Unlock every region' : 'Plan details'}
        </Link>
      </div>

      {/* Only where there is something to manage: a licensed or comped account
          has no Paddle subscription behind it, and the portal would be empty. */}
      {entitlement.source === 'paddle' && ManageSubscription && (
        <Suspense fallback={null}>
          <ManageSubscription />
        </Suspense>
      )}

      {tier === 'free' && !pending && (
        <div className="mt-3">
          <label
            htmlFor="free-area"
            className="block"
            style={{ font: '500 10px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}
          >
            Your free area
          </label>
          <select
            id="free-area"
            value={free}
            disabled={!canSwitchFree}
            onChange={(e) => chooseFreeArea(e.target.value as Area)}
            className="mt-2 rounded-[3px] px-3 py-2.5 disabled:opacity-60"
            style={{ font: '400 14px/1 var(--font-ui)', border: '1.2px solid var(--line)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            {AREAS.map((area) => (
              <option key={area} value={area}>
                {AREA_LABELS[area]}
              </option>
            ))}
          </select>
          <p className="mt-2" style={{ font: '400 12.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
            {switchUsed
              ? 'You have used your one change, so this is now your free area. A subscription opens every region.'
              : canSwitchFree
                ? 'You can change this once. After that it is fixed, and only a subscription opens the rest.'
                : `You can change this once, 30 days after you picked it: from ${freeAreaSwitchDate(freeArea) ?? 'tomorrow'} (${daysUntilSwitch} ${daysUntilSwitch === 1 ? 'day' : 'days'} to go).`}
            {' '}Your progress in every area is kept either way.
          </p>
        </div>
      )}
    </div>
  );
}
