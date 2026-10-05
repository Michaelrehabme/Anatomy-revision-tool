import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyPaddleSignature,
  actionForEvent,
  adjustmentActionForEvent,
  entitlementAfterRefund,
  isLatestPayment,
  isStale,
  nextEntitlement,
  SIGNATURE_TOLERANCE_SECONDS,
  type PaddleAdjustmentEvent,
  type PaddleEvent,
  type PaddleTransactionSummary,
} from '../paddleWebhook';

/**
 * This is the only code in the product that grants paid access, so the tests
 * lean hard on the ways it could be made to grant access it should not. Every
 * signature case below is somebody trying to get a year for free.
 */

const SECRET = 'pdl_ntfset_test_secret';
const NOW = 1_760_000_000; // seconds

function sign(body: string, ts = NOW, secret = SECRET): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

const BODY = JSON.stringify({ event_type: 'subscription.activated', data: { id: 'sub_1' } });

describe('verifyPaddleSignature', () => {
  it('accepts a body Paddle signed', () => {
    expect(verifyPaddleSignature(BODY, sign(BODY), SECRET, NOW).ok).toBe(true);
  });

  it('rejects a body altered after signing', () => {
    // Somebody takes a real event and edits the account it grants to.
    const tampered = BODY.replace('sub_1', 'sub_2');
    expect(verifyPaddleSignature(tampered, sign(BODY), SECRET, NOW).ok).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyPaddleSignature(BODY, sign(BODY, NOW, 'guessed'), SECRET, NOW).ok).toBe(false);
  });

  it('rejects a request with no signature at all', () => {
    expect(verifyPaddleSignature(BODY, undefined, SECRET, NOW).ok).toBe(false);
    expect(verifyPaddleSignature(BODY, '', SECRET, NOW).ok).toBe(false);
  });

  it('rejects a captured request replayed outside the window', () => {
    const old = NOW - SIGNATURE_TOLERANCE_SECONDS - 1;
    expect(verifyPaddleSignature(BODY, sign(BODY, old), SECRET, NOW).reason).toMatch(/replay/);
  });

  it('accepts one just inside the window', () => {
    const recent = NOW - SIGNATURE_TOLERANCE_SECONDS + 1;
    expect(verifyPaddleSignature(BODY, sign(BODY, recent), SECRET, NOW).ok).toBe(true);
  });

  it('rejects a malformed header rather than throwing', () => {
    expect(verifyPaddleSignature(BODY, 'garbage', SECRET, NOW).ok).toBe(false);
    expect(verifyPaddleSignature(BODY, 'ts=abc;h1=00', SECRET, NOW).ok).toBe(false);
    expect(verifyPaddleSignature(BODY, `ts=${NOW};h1=zz`, SECRET, NOW).ok).toBe(false);
  });

  it('refuses everything when no secret is configured', () => {
    // A missing env var must fail CLOSED. Verifying against an empty secret
    // would be something an attacker could reproduce.
    expect(verifyPaddleSignature(BODY, sign(BODY, NOW, ''), '', NOW).ok).toBe(false);
  });
});

const NOW_DATE = new Date('2026-10-15T12:00:00.000Z');

function event(over: Partial<PaddleEvent['data']> = {}, type = 'subscription.activated'): PaddleEvent {
  return {
    event_type: type,
    data: {
      id: 'sub_123',
      status: 'active',
      current_billing_period: { starts_at: '2026-10-15T12:00:00.000Z', ends_at: '2027-10-15T12:00:00.000Z' },
      custom_data: { uid: 'user-1' },
      ...over,
    },
  };
}

describe('actionForEvent', () => {
  it('grants access to the end of the paid period', () => {
    const action = actionForEvent(event(), NOW_DATE);
    expect(action.kind).toBe('grant');
    if (action.kind !== 'grant') return;
    expect(action.uid).toBe('user-1');
    expect(action.entitlement).toEqual({
      tier: 'individual', source: 'paddle', expiresAt: '2027-10-15T12:00:00.000Z', externalId: 'sub_123',
      // Measured from the period, since this event states no billing cycle.
      interval: 'year',
    });
  });

  it('records the billing cycle Paddle states', () => {
    // The renewal reminders need to know which plan somebody is on, and
    // expiresAt cannot tell them: a period end says nothing about its length.
    const action = actionForEvent(event({
      billing_cycle: { interval: 'month', frequency: 1 },
      started_at: '2026-10-15T12:00:00.000Z',
    }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.interval).toBe('month');
    expect(action.entitlement.startedAt).toBe('2026-10-15T12:00:00.000Z');
  });

  it('measures the cycle from the period when Paddle does not state it', () => {
    const action = actionForEvent(event({
      current_billing_period: { starts_at: '2026-10-15T12:00:00.000Z', ends_at: '2026-11-15T12:00:00.000Z' },
    }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.interval).toBe('month');
  });

  it('leaves the cycle unset rather than guessing it', () => {
    // An unknown interval makes reminderDue decline, which is the safe way to
    // be wrong: a missed notice shows in the log, a wrong one reaches a student.
    const action = actionForEvent(event({
      status: 'canceled', canceled_at: '2026-10-10T12:00:00.000Z',
    }, 'subscription.canceled'), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.interval).toBeUndefined();
  });

  it('grants during a trial', () => {
    expect(actionForEvent(event({ status: 'trialing' }, 'subscription.trialing'), NOW_DATE).kind).toBe('grant');
  });

  it('keeps access through a failed renewal while Paddle retries the card', () => {
    // Cutting somebody off mid-revision because a bank declined once would be
    // punishing them for the retry schedule.
    const action = actionForEvent(event({ status: 'past_due' }, 'subscription.past_due'), NOW_DATE);
    expect(action.kind).toBe('grant');
    if (action.kind === 'grant') expect(action.entitlement.expiresAt).toBe('2027-10-15T12:00:00.000Z');
  });

  it('keeps access to the period end after a cancellation is merely scheduled', () => {
    // The owner's policy: cancel any time, keep what you paid for. A scheduled
    // cancellation arrives while the subscription is still active.
    const action = actionForEvent(event({ status: 'active' }, 'subscription.updated'), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.expiresAt).toBe('2027-10-15T12:00:00.000Z');
  });

  it('ends access when Paddle reports the subscription cancelled', () => {
    const action = actionForEvent(
      event({ status: 'canceled', canceled_at: '2026-10-10T12:00:00.000Z' }, 'subscription.canceled'),
      NOW_DATE,
    );
    if (action.kind !== 'grant') throw new Error('expected an expiring grant');
    expect(action.entitlement.expiresAt).toBe('2026-10-10T12:00:00.000Z');
  });

  it('never lets a cancellation extend access into the future', () => {
    // A cancelled subscription with a future cancellation time must not
    // become a way to hold access beyond "now".
    const action = actionForEvent(
      event({ status: 'canceled', canceled_at: '2099-01-01T00:00:00.000Z' }, 'subscription.canceled'),
      NOW_DATE,
    );
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(Date.parse(action.entitlement.expiresAt!)).toBeLessThanOrEqual(NOW_DATE.getTime());
  });

  it('refuses to grant to nobody when custom_data carries no uid', () => {
    const action = actionForEvent(event({ custom_data: {} }), NOW_DATE);
    expect(action.kind).toBe('ignore');
    if (action.kind === 'ignore') expect(action.reason).toMatch(/no uid/);
  });

  it('ignores event types it does not handle', () => {
    expect(actionForEvent(event({}, 'address.created'), NOW_DATE).kind).toBe('ignore');
  });

  it('takes the tier from the signed event, never from custom_data', () => {
    // custom_data is written by the browser at checkout. A student setting
    // `tier: institutional` there must get exactly what they paid for.
    const action = actionForEvent(event({ custom_data: { uid: 'u', tier: 'institutional' } }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.tier).toBe('individual');
  });

  it('carries the cooling-off consent through for the record', () => {
    const action = actionForEvent(event({
      custom_data: { uid: 'u', coolingOffWaived: true, consentAt: '2026-10-15T11:59:00.000Z', consentVersion: 'v1' },
    }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.consent).toEqual({ coolingOffWaived: true, agreedAt: '2026-10-15T11:59:00.000Z', wordingVersion: 'v1' });
  });

  it('starts access 14 days after the subscription began when the waiver was declined', () => {
    // The promise /refunds makes: keep the right, and access simply starts later.
    const action = actionForEvent(event({
      started_at: '2026-10-15T12:00:00.000Z',
      custom_data: { uid: 'u', coolingOffWaived: false },
    }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.startsAt).toBe('2026-10-29T12:00:00.000Z');
  });

  it('does not restart the 14 days on a renewal', () => {
    // A renewal carries a new billing period but the same started_at. Counting
    // from the period would lock a monthly subscriber out every month.
    const action = actionForEvent(event({
      started_at: '2026-10-15T12:00:00.000Z',
      current_billing_period: { starts_at: '2027-10-15T12:00:00.000Z', ends_at: '2028-10-15T12:00:00.000Z' },
      custom_data: { uid: 'u', coolingOffWaived: false },
    }, 'subscription.updated'), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.startsAt).toBe('2026-10-29T12:00:00.000Z');
  });

  it('starts access immediately when the waiver was given', () => {
    const action = actionForEvent(event({
      started_at: '2026-10-15T12:00:00.000Z',
      custom_data: { uid: 'u', coolingOffWaived: true },
    }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.entitlement.startsAt).toBeUndefined();
  });

  it('records a consent that was declined, not only one that was given', () => {
    const action = actionForEvent(event({ custom_data: { uid: 'u', coolingOffWaived: false } }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    expect(action.consent?.coolingOffWaived).toBe(false);
  });
});

/**
 * REFUNDS. Paywall trace finding 9. Payload fields and values are Paddle's
 * documented ones (https://developer.paddle.com/webhooks/adjustments/adjustment-created,
 * .../adjustment-updated, read 5 October 2026). The webhook as a whole —
 * which account, duplicates, a deleted account, the dry run — is tested in
 * netlify/functions/__tests__/paddle-webhook.test.ts.
 */
function refund(over: Partial<PaddleAdjustmentEvent['data']> = {}, type = 'adjustment.updated'): PaddleAdjustmentEvent {
  return {
    event_id: 'evt_01hvgfdfepj8eaevsjh5g4swbe',
    event_type: type,
    occurred_at: '2026-10-05T08:54:10.646377Z',
    data: {
      id: 'adj_01hvgf2s84dr6reszzg29zbvcm',
      action: 'refund',
      type: 'full',
      status: 'approved',
      reason: 'error',
      transaction_id: 'txn_01hvcc93znj3mpqt1tenkjb04y',
      subscription_id: 'sub_123',
      customer_id: 'ctm_01hv6y1jedq4p1n0yqn5ba3ky4',
      ...over,
    },
  };
}

describe('adjustmentActionForEvent', () => {
  it('a full refund, approved, on a subscription is the one thing that may end access', () => {
    expect(adjustmentActionForEvent(refund())).toEqual({
      kind: 'refund',
      adjustmentId: 'adj_01hvgf2s84dr6reszzg29zbvcm',
      transactionId: 'txn_01hvcc93znj3mpqt1tenkjb04y',
      subscriptionId: 'sub_123',
      customerId: 'ctm_01hv6y1jedq4p1n0yqn5ba3ky4',
    });
    expect(adjustmentActionForEvent(refund({}, 'adjustment.created')).kind).toBe('refund');
  });

  it.each(['pending_approval', 'rejected', 'reversed'])('a %s refund changes nothing', (status) => {
    const action = adjustmentActionForEvent(refund({ status }));
    expect(action.kind).toBe('ignore');
  });

  it('a partial refund changes nothing, and neither does one whose type is not stated', () => {
    expect(adjustmentActionForEvent(refund({ type: 'partial' })).kind).toBe('ignore');
    expect(adjustmentActionForEvent(refund({ type: null })).kind).toBe('ignore');
  });

  it.each(['credit', 'credit_reverse', 'chargeback_reverse', 'chargeback_warning_reverse'])('a %s is not a refund', (action) => {
    expect(adjustmentActionForEvent(refund({ action })).kind).toBe('ignore');
  });

  it.each(['chargeback', 'chargeback_warning'])('a %s is for a person to decide', (action) => {
    const decided = adjustmentActionForEvent(refund({ action }));
    expect(decided.kind).toBe('review');
  });

  it('a full refund with no subscription is recorded, never matched by guesswork', () => {
    const action = adjustmentActionForEvent(refund({ subscription_id: null }));
    expect(action.kind).toBe('review');
    if (action.kind === 'review') expect(action.subscriptionId).toBeNull();
  });

  it('is not fooled by another event carrying the same shape', () => {
    expect(adjustmentActionForEvent(refund({}, 'transaction.completed')).kind).toBe('ignore');
  });
});

describe('isLatestPayment', () => {
  const txn = (id: string, billedAt: string | null, over: Partial<PaddleTransactionSummary> = {}): PaddleTransactionSummary => ({
    id, status: 'completed', origin: 'subscription_recurring', subscription_id: 'sub_123', billed_at: billedAt, ...over,
  });

  it('the only payment is the latest', () => {
    expect(isLatestPayment([txn('a', '2026-10-01T09:00:00Z', { origin: 'web' })], 'a', 'sub_123')).toBe('latest');
  });

  it('the newest of several is the latest, whatever order they arrive in', () => {
    const list = [txn('a', '2026-08-01T09:00:00Z'), txn('c', '2026-10-01T09:00:00Z'), txn('b', '2026-09-01T09:00:00Z')];
    expect(isLatestPayment(list, 'c', 'sub_123')).toBe('latest');
    expect(isLatestPayment(list, 'b', 'sub_123')).toBe('older');
  });

  it('a payment taken but not yet processed counts as a payment', () => {
    const list = [txn('a', '2026-09-01T09:00:00Z'), txn('b', '2026-10-01T09:00:00Z', { status: 'paid' })];
    expect(isLatestPayment(list, 'a', 'sub_123')).toBe('older');
  });

  it('a renewal that failed, and a card change, are not payments', () => {
    const list = [
      txn('a', '2026-09-01T09:00:00Z'),
      txn('unpaid', '2026-10-01T09:00:00Z', { status: 'past_due' }),
      txn('card', '2026-10-02T09:00:00Z', { origin: 'subscription_payment_method_change' }),
    ];
    expect(isLatestPayment(list, 'a', 'sub_123')).toBe('latest');
  });

  it('says so when it cannot tell', () => {
    // Not in the list at all.
    expect(isLatestPayment([txn('a', '2026-10-01T09:00:00Z')], 'z', 'sub_123')).toBe('unknown');
    expect(isLatestPayment([], 'a', 'sub_123')).toBe('unknown');
    // A payment with no date could be either side of it.
    expect(isLatestPayment([txn('a', '2026-10-01T09:00:00Z'), txn('b', null)], 'a', 'sub_123')).toBe('unknown');
    // The transactions of another subscription settle nothing about this one.
    expect(isLatestPayment([txn('a', '2026-10-01T09:00:00Z', { subscription_id: 'sub_other' })], 'a', 'sub_123')).toBe('unknown');
  });

  it('two payments at the same instant: not provably the latest, so not treated as it', () => {
    expect(isLatestPayment([txn('a', '2026-10-01T09:00:00Z'), txn('b', '2026-10-01T09:00:00Z')], 'a', 'sub_123')).toBe('older');
  });
});

describe('entitlementAfterRefund', () => {
  const AT = '2026-10-05T08:54:10.646377Z';
  const stored = {
    tier: 'individual', source: 'paddle', expiresAt: '2027-10-01T09:00:00.000Z', externalId: 'sub_123',
    eventAt: '2026-10-01T09:00:05.000Z', customerId: 'ctm_1', consent: { coolingOffWaived: true },
  };

  it('ends access at the time of the event and keeps the record of what was bought', () => {
    expect(entitlementAfterRefund(stored, 'sub_123', AT)).toEqual({
      kind: 'end',
      entitlement: { ...stored, expiresAt: AT, eventAt: AT, refundedAt: AT },
    });
  });

  it('never ends complimentary access, even though the old subscription id is still in the map', () => {
    const comped = { ...stored, source: 'complimentary', expiresAt: null };
    expect(entitlementAfterRefund(comped, 'sub_123', AT).kind).toBe('skip');
  });

  it('never ends a different subscription', () => {
    expect(entitlementAfterRefund({ ...stored, externalId: 'sub_new' }, 'sub_123', AT).kind).toBe('skip');
  });

  it('gives way to a newer event already stored', () => {
    expect(entitlementAfterRefund({ ...stored, eventAt: '2026-10-06T00:00:00.000Z' }, 'sub_123', AT).kind).toBe('skip');
  });

  it('does nothing twice, and nothing to access that had already ended', () => {
    const once = entitlementAfterRefund(stored, 'sub_123', AT);
    if (once.kind !== 'end') throw new Error('expected end');
    expect(entitlementAfterRefund(once.entitlement, 'sub_123', AT).kind).toBe('skip');
    expect(entitlementAfterRefund({ ...stored, expiresAt: '2026-09-01T00:00:00.000Z' }, 'sub_123', AT).kind).toBe('skip');
  });

  it('does nothing to an account with no entitlement', () => {
    expect(entitlementAfterRefund(undefined, 'sub_123', AT).kind).toBe('skip');
  });

  it('drops a start date still in the future', () => {
    const outcome = entitlementAfterRefund({ ...stored, startsAt: '2026-10-15T09:00:00.000Z' }, 'sub_123', AT);
    if (outcome.kind !== 'end') throw new Error('expected end');
    expect(outcome.entitlement.startsAt).toBeUndefined();
  });
});

describe('nextEntitlement', () => {
  const grant = () => {
    const action = actionForEvent(event({ customer_id: 'ctm_new' }), NOW_DATE);
    if (action.kind !== 'grant') throw new Error('expected grant');
    return action;
  };

  it('replaces the map, carrying over only consent and the customer id', () => {
    const current = {
      tier: 'individual', source: 'paddle', expiresAt: '2026-10-15T12:00:00.000Z', externalId: 'sub_old',
      startsAt: '2099-01-01T00:00:00.000Z', refundedAt: '2026-10-01T00:00:00.000Z',
      eventAt: '2026-10-01T00:00:00.000Z', customerId: 'ctm_old', consent: { coolingOffWaived: false },
    };
    const next = nextEntitlement(current, { ...grant(), customerId: null }, '2026-10-15T12:00:01.000Z');
    expect(next).toEqual({
      tier: 'individual', source: 'paddle', expiresAt: '2027-10-15T12:00:00.000Z', externalId: 'sub_123', interval: 'year',
      eventAt: '2026-10-15T12:00:01.000Z', customerId: 'ctm_old', consent: { coolingOffWaived: false },
    });
  });

  it('refuses an event older than the one stored, and applies the same event twice', () => {
    const current = { eventAt: '2026-10-15T12:00:01.000Z' };
    expect(nextEntitlement(current, grant(), '2026-10-15T12:00:00.000Z')).toBe('stale');
    expect(nextEntitlement(current, grant(), '2026-10-15T12:00:01.000Z')).not.toBe('stale');
    expect(isStale(undefined, '2026-10-15T12:00:00.000Z')).toBe(false);
  });
});
