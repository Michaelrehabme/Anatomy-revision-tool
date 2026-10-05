import { useState } from 'react';
import { hasExpired, paymentIssueSince, type Entitlement } from '../anatomy-revision/lib/entitlement';
import { Button } from '../anatomy-revision/components/shared/Button';
import { useBillingPortal } from './ManageSubscription';

/**
 * "Your last payment did not go through" — paywall trace finding 10.
 *
 * Until this existed a failed renewal was silent. The regions relocked (or,
 * before the webhook was corrected, stayed open on a period nobody had paid
 * for) and the only explanation was whatever email Paddle sent, which a
 * student may never have opened.
 *
 * IT SAYS THREE THINGS AND NOTHING ELSE: what happened, what to do, and what
 * has happened to access.
 *
 *  - What happened is known because the webhook stores `paymentIssueSince`
 *    while Paddle reports the subscription past due, and removes it with the
 *    next event that says otherwise. Nothing in the browser can set it:
 *    firestore.rules makes the whole entitlement map read-only to clients.
 *  - What to do is Paddle's customer portal, where a card is changed — the
 *    same link "Manage or cancel your subscription" opens.
 *  - What has happened to access is the stored `expiresAt` and no other
 *    rule. While past due, the webhook holds it at the end of the last
 *    period that was paid for (billing/lib/paddleWebhook.ts), so this
 *    normally reads "stopped on". It never promises a grace period, because
 *    the code gives none, and never says when Paddle will try the card again
 *    or give up, because the app is not told.
 *
 * CALM, NOT AN ALARM. `role="status"`, not "alert": a declined card is worth
 * knowing about and is not an emergency, and an assertive announcement on
 * every visit to Today would be the nagging this is meant to avoid. On Today
 * it can be dismissed, and stays dismissed for the browser session; on the
 * account screen it stays, because that is where somebody goes to deal with
 * it. A new failure is a new `paymentIssueSince` and is shown again.
 */

const DISMISSED_KEY = 'locusmsk.paymentIssueDismissed';

function wasDismissed(since: string): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === since;
  } catch {
    // Storage blocked: show it. Being shown twice is the cheaper mistake.
    return false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The sentence about access: only ever what the stored expiry says. */
export function accessSentence(entitlement: Entitlement, now: Date = new Date()): string {
  if (!entitlement.expiresAt) return '';
  return hasExpired(entitlement, now)
    ? `Full access stopped on ${formatDate(entitlement.expiresAt)}, the end of the time you had paid for.`
    : `Full access runs until ${formatDate(entitlement.expiresAt)}.`;
}

export interface PaymentIssueNoticeProps {
  entitlement: Entitlement;
  /** 'today' can be dismissed for the session; 'account' cannot. */
  placement: 'account' | 'today';
  className?: string;
}

export function PaymentIssueNotice({ entitlement, placement, className = '' }: PaymentIssueNoticeProps) {
  const since = paymentIssueSince(entitlement);
  const [dismissed, setDismissed] = useState(() => (since ? wasDismissed(since) : false));
  const portal = useBillingPortal();

  if (!since) return null;
  if (placement === 'today' && dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, since);
    } catch {
      // Dismissed for this screen at least.
    }
    setDismissed(true);
  };

  const access = accessSentence(entitlement);

  return (
    <div
      role="status"
      data-testid="payment-issue"
      className={`rounded-[3px] px-4 py-3.5 ${className}`}
      style={{
        background: 'var(--sf)',
        border: '1.2px solid var(--line-strong)',
        borderLeft: '4px solid var(--acc2d)',
        maxWidth: 620,
      }}
    >
      <p style={{ font: '600 15px/1.4 var(--font-ui)', color: 'var(--ink)', margin: 0 }}>
        Your last payment did not go through
      </p>
      <p className="mt-1.5" style={{ font: '400 14px/1.55 var(--font-ui)', color: 'var(--ink2)', margin: '6px 0 0' }}>
        {access && `${access} `}
        Update your card and full access returns once the payment goes through. Your progress is kept.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="button"
          onClick={portal.open}
          disabled={portal.loading}
          className="px-4"
          style={{ minHeight: 44, fontSize: 14 }}
        >
          {portal.loading ? 'Opening…' : 'Update your card'}
        </Button>
        {placement === 'today' && (
          <button
            type="button"
            onClick={dismiss}
            className="px-2"
            style={{ minHeight: 44, font: '400 14px/1.4 var(--font-ui)', color: 'var(--ink2)', textDecoration: 'underline' }}
          >
            Not now
          </button>
        )}
      </div>
      {portal.error && (
        <p className="mt-2" role="alert" style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--acc2d)' }}>
          {portal.error}
        </p>
      )}
    </div>
  );
}

export default PaymentIssueNotice;
