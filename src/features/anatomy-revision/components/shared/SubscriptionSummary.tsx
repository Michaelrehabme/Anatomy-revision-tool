import { Link } from 'react-router-dom';
import { useEntitlement } from '../../hooks/useEntitlement';
import { hasStarted } from '../../lib/entitlement';

/**
 * One line on the account screen: what you have, and the way to /pricing.
 *
 * Returns nothing in the public demo, which has no /pricing route. A link
 * there would just bounce the visitor back to the home screen.
 */

const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function SubscriptionSummary({ uid }: { uid: string }) {
  const { entitlement, tier, loading } = useEntitlement(uid);
  if (PUBLIC_DEMO || loading) return null;

  const pending = entitlement.tier !== 'free' && !hasStarted(entitlement);
  const status = pending && entitlement.startsAt
    ? `Subscribed. Access starts ${formatDate(entitlement.startsAt)}.`
    : tier === 'free'
      ? 'Free: the shoulder region.'
      : entitlement.expiresAt
        ? `Full access until ${formatDate(entitlement.expiresAt)}.`
        : 'Full access.';

  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
      <span>{status}</span>
      <Link to="/pricing" style={{ color: 'var(--accd)' }}>
        {tier === 'free' && !pending ? 'Unlock every region' : 'Plan details'}
      </Link>
    </div>
  );
}
