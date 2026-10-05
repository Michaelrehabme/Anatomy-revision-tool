import { lazy, Suspense } from 'react';
import { paymentIssueSince } from '../../lib/entitlement';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * Where the "payment did not go through" notice is mounted: once on Today
 * (desktop and phone) and on the account screen's Subscription section.
 *
 * A WRAPPER, SO THE NOTICE COSTS NOTHING UNTIL IT IS NEEDED. Almost nobody
 * has a failed payment on any given day. The notice itself lives with the
 * billing code and is fetched only when the stored entitlement carries
 * `paymentIssueSince`; what every student downloads is this file.
 *
 * Nothing in the public demo, which has no accounts and no billing — the same
 * treatment SubscriptionSummary gives the portal link.
 */

const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === '1';

const Notice = PUBLIC_DEMO ? null : lazy(() => import('../../../billing/PaymentIssueNotice'));

export function PaymentIssue({
  access,
  placement,
  className,
}: {
  access: UseEntitlement;
  placement: 'account' | 'today';
  className?: string;
}) {
  // Not while the first read is in flight: the entitlement is the free
  // placeholder until it settles, and there is nothing to say about that.
  if (!Notice || access.loading || !paymentIssueSince(access.entitlement)) return null;
  return (
    <Suspense fallback={null}>
      <Notice entitlement={access.entitlement} placement={placement} className={className} />
    </Suspense>
  );
}
