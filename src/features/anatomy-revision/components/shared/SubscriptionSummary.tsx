import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { hasExpired, hasStarted } from '../../lib/entitlement';
import { AREAS, AREA_LABELS, type Area } from '../../types/region';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * The account screen's billing block: what you have, which area is free, and
 * the way to /pricing.
 *
 * THE FREE-AREA SWAP LIVES HERE because this is the one screen a student
 * already visits to see what they are paying for, and the swap is a
 * consequence of being on the free plan rather than a study setting. It is
 * offered every 30 days — see FREE_AREA_SWITCH_DAYS — and the wait is stated
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
  const status = pending && entitlement.startsAt
    ? `Subscribed. Access starts ${formatDate(entitlement.startsAt)}.`
    : lapsed && entitlement.expiresAt
      ? `Your subscription ended on ${formatDate(entitlement.expiresAt)}. Free: ${AREA_LABELS[free].toLowerCase()} only.`
      : tier === 'free'
        ? `Free: ${AREA_LABELS[free].toLowerCase()} only.`
        : entitlement.expiresAt
          ? `Full access until ${formatDate(entitlement.expiresAt)}, when it renews.`
          : 'Full access.';

  return (
    <div className="mt-4" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span>{status}</span>
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
                : `You can change this once, 30 days after you picked it — ${daysUntilSwitch} ${daysUntilSwitch === 1 ? 'day' : 'days'} to go.`}
            {' '}Your progress in every area is kept either way.
          </p>
        </div>
      )}
    </div>
  );
}
