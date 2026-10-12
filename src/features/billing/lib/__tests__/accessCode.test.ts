import { describe, expect, it } from 'vitest';
import { ACCESS_CODES, decideRedemption, findAccessCode, normaliseCode, type AccessCode, type RedeemInput } from '../accessCode';
import { parseEntitlement } from '../../../anatomy-revision/lib/entitlementRecord';
import { effectiveTier } from '../../../anatomy-revision/lib/entitlement';
import { ownFullAccess } from '../../../educator/lib/teachingAccess';

/**
 * Access codes: who gets one, and what it writes. The function around this
 * is tested in netlify/tests/redeem-code.test.ts.
 */

const NOW = new Date('2026-10-12T12:00:00.000Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

const CODE: AccessCode = { code: 'LOCUSMSK27', accessUntil: '2027-01-01T00:00:00.000Z', maxRedemptions: 100, teaching: false };
const ACCOUNT = { anonymous: false, emailVerified: true };

const redeem = (over: Partial<RedeemInput> = {}) =>
  decideRedemption({ code: CODE, account: ACCOUNT, current: undefined, redeemed: 0, alreadyRedeemed: false, now: NOW, ...over });

describe('the code the owner asked for', () => {
  it('is LOCUSMSK27: 100 accounts, until the start of 1 January 2027, no teaching', () => {
    expect(ACCESS_CODES).toEqual([CODE]);
  });

  it('is found however it is typed', () => {
    for (const typed of ['LocusMSK27', 'locusmsk27', ' LOCUSMSK27 ', 'Locus MSK 27']) {
      expect(findAccessCode(typed)?.code, typed).toBe('LOCUSMSK27');
    }
  });

  it('is not found from anything else', () => {
    for (const typed of ['', 'LOCUSMSK', 'LOCUSMSK28', null, undefined, 27, {}, 'L'.repeat(500)]) {
      expect(findAccessCode(typed), String(typed)).toBeNull();
    }
    expect(normaliseCode('x'.repeat(41))).toBe('');
  });
});

describe('redeeming', () => {
  it('gives a free account full access until the code ends, marked as not teaching', () => {
    const decision = redeem();
    expect(decision).toEqual({
      kind: 'grant',
      entitlement: {
        tier: 'individual',
        source: 'complimentary',
        expiresAt: '2027-01-01T00:00:00.000Z',
        accessCode: 'LOCUSMSK27',
        teaching: false,
      },
    });
  });

  it('writes something the app reads as full access now, free again on 1 January, and never as teaching', () => {
    const decision = redeem();
    if (decision.kind !== 'grant') throw new Error('expected a grant');
    const read = parseEntitlement(decision.entitlement);
    expect(read).not.toBeNull();
    expect(effectiveTier(read, NOW)).toBe('individual');
    expect(effectiveTier(read, new Date('2026-12-31T23:59:59.000Z'))).toBe('individual');
    expect(effectiveTier(read, new Date('2027-01-01T00:00:00.000Z'))).toBe('free');
    expect(ownFullAccess({ entitlement: decision.entitlement }, NOW)).toBe(false);
  });

  it('leaves teaching alone for a code that allows it', () => {
    const decision = redeem({ code: { ...CODE, teaching: true } });
    if (decision.kind !== 'grant') throw new Error('expected a grant');
    expect('teaching' in decision.entitlement).toBe(false);
    expect(ownFullAccess({ entitlement: decision.entitlement }, NOW)).toBe(true);
  });

  it('refuses a guest, and an account whose email address is not confirmed', () => {
    expect(redeem({ account: { anonymous: true, emailVerified: false } })).toEqual({ kind: 'refuse', reason: 'guest' });
    expect(redeem({ account: { anonymous: false, emailVerified: false } })).toEqual({ kind: 'refuse', reason: 'unconfirmed' });
  });

  it('takes the hundredth account and refuses the hundred and first', () => {
    expect(redeem({ redeemed: 99 }).kind).toBe('grant');
    expect(redeem({ redeemed: 100 })).toEqual({ kind: 'refuse', reason: 'all-used' });
    expect(redeem({ redeemed: 250 })).toEqual({ kind: 'refuse', reason: 'all-used' });
  });

  it('refuses once the code has ended, to the second', () => {
    expect(redeem({ now: new Date('2026-12-31T23:59:59.000Z') }).kind).toBe('grant');
    expect(redeem({ now: new Date('2027-01-01T00:00:00.000Z') })).toEqual({ kind: 'refuse', reason: 'ended' });
  });

  describe('an account that has redeemed it already', () => {
    it('is told what it has, and nothing is granted or counted again', () => {
      const held = { tier: 'individual', source: 'complimentary', expiresAt: CODE.accessUntil, accessCode: 'LOCUSMSK27', teaching: false };
      expect(redeem({ alreadyRedeemed: true, current: held })).toEqual({ kind: 'already', accessUntil: CODE.accessUntil });
    });

    it('is told the same when every place has gone, or the code has ended, or it has since subscribed', () => {
      expect(redeem({ alreadyRedeemed: true, redeemed: 100 }).kind).toBe('already');
      expect(redeem({ alreadyRedeemed: true, now: new Date('2027-02-01T00:00:00.000Z') }).kind).toBe('already');
      expect(redeem({ alreadyRedeemed: true, current: { tier: 'individual', source: 'paddle', expiresAt: at(300) } }).kind).toBe('already');
    });
  });

  describe('never over access that is live or paid for', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['a paid subscription', { tier: 'individual', source: 'paddle', expiresAt: at(20), externalId: 'sub_1' }],
      ['a cancelled subscription with paid time left', { tier: 'individual', source: 'paddle', expiresAt: at(5), cancelAt: at(5) }],
      ['a failed renewal inside its days of grace', { tier: 'individual', source: 'paddle', expiresAt: at(2), paymentIssueSince: at(-1) }],
      ['a subscription bought and not yet started', { tier: 'individual', source: 'paddle', startsAt: at(10), expiresAt: at(40) }],
      ["the owner's permanent grant", { tier: 'institutional', source: 'complimentary', expiresAt: null }],
    ];
    it.each(cases)('%s', (_name, current) => {
      expect(redeem({ current })).toEqual({ kind: 'refuse', reason: 'has-access' });
    });
  });

  describe('over a subscription that has run out', () => {
    const lapsed = {
      tier: 'individual',
      source: 'paddle',
      expiresAt: at(-30),
      externalId: 'sub_1',
      interval: 'month',
      cancelAt: at(-30),
      eventAt: at(-30),
      customerId: 'ctm_1',
      consent: { coolingOffWaived: true, agreedAt: at(-60), wordingVersion: 'v1' },
    };

    it('grants, keeping the consent, the customer id and the time of the last Paddle event', () => {
      const decision = redeem({ current: lapsed });
      if (decision.kind !== 'grant') throw new Error('expected a grant');
      expect(decision.entitlement).toEqual({
        tier: 'individual',
        source: 'complimentary',
        expiresAt: CODE.accessUntil,
        accessCode: 'LOCUSMSK27',
        teaching: false,
        consent: lapsed.consent,
        customerId: 'ctm_1',
        eventAt: lapsed.eventAt,
      });
    });

    it('grants over a refunded one and a stored free tier too', () => {
      expect(redeem({ current: { ...lapsed, refundedAt: at(-30) } }).kind).toBe('grant');
      expect(redeem({ current: { tier: 'free', source: null, expiresAt: null } }).kind).toBe('grant');
    });
  });
});
