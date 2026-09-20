import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyPaddleSignature,
  actionForEvent,
  SIGNATURE_TOLERANCE_SECONDS,
  type PaddleEvent,
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
