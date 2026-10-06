import { describe, expect, it } from 'vitest';
import { cohortIsLicensed, mayRunCohort, mayTeach, ownFullAccess } from '../teachingAccess';
import { PAYMENT_GRACE_DAYS } from '../../../anatomy-revision/lib/entitlement';

/**
 * Who may teach (owner's decision, 6 Oct 2026). The same cases are run
 * against firestore.rules in rules-tests/, which is the boundary; these are
 * the app's reading, and the two must give the same answer for every row.
 */

const NOW = new Date('2026-10-06T12:00:00.000Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();
const PADDLE = { tier: 'individual', source: 'paddle', externalId: 'sub_1' };

describe('full access on the account itself', () => {
  const cases: [string, Record<string, unknown> | null, boolean][] = [
    ['no profile at all', null, false],
    ['a free account', { displayName: 'Sam' }, false],
    ['a stored free tier', { entitlement: { tier: 'free', source: null, expiresAt: null } }, false],
    ['a paid subscription', { entitlement: { ...PADDLE, expiresAt: at(20) } }, true],
    ['an expired subscription', { entitlement: { ...PADDLE, expiresAt: at(-1) } }, false],
    ['a failed renewal, inside the days of grace', { entitlement: { ...PADDLE, expiresAt: at(PAYMENT_GRACE_DAYS - 1), paymentIssueSince: at(-1) } }, true],
    ['a failed renewal, after the grace', { entitlement: { ...PADDLE, expiresAt: at(-0.01), paymentIssueSince: at(-PAYMENT_GRACE_DAYS - 0.01) } }, false],
    ['a cancelled subscription with paid time left', { entitlement: { ...PADDLE, expiresAt: at(9), cancelAt: at(9) } }, true],
    ['a refunded subscription', { entitlement: { ...PADDLE, expiresAt: at(-0.5), refundedAt: at(-0.5) } }, false],
    ['a delayed start that has not begun', { entitlement: { ...PADDLE, startsAt: at(10), expiresAt: at(40) } }, false],
    ['a delayed start that has begun', { entitlement: { ...PADDLE, startsAt: at(-1), expiresAt: at(29) } }, true],
    ['a complimentary grant', { entitlement: { tier: 'individual', source: 'complimentary', expiresAt: null } }, true],
    ['an institutional grant', { entitlement: { tier: 'institutional', source: 'licence', expiresAt: null, seatId: 's1' } }, true],
    ['a tier this build has never heard of', { entitlement: { tier: 'platinum', expiresAt: null } }, false],
    // A student in a licensed class holds every area THROUGH THE CLASS. Nothing
    // is on their own account, and a student is not an educator.
    ['a member of a licensed class, with nothing of their own', { cohort: 'c-licensed' }, false],
  ];

  it.each(cases)('%s', (_name, user, expected) => {
    expect(ownFullAccess(user, NOW)).toBe(expected);
  });
});

describe('who may create a class, and who may go on running one', () => {
  const none = { own: false, admin: false };
  const licensed = { licensedUntil: at(100) };

  it('creating: full access on the account, or admin', () => {
    expect(mayTeach(none)).toBe(false);
    expect(mayTeach({ own: true, admin: false })).toBe(true);
    expect(mayTeach({ own: false, admin: true })).toBe(true);
  });

  it("running a class: the same, or the class's own licence while it lasts", () => {
    expect(mayRunCohort(none, { licensedUntil: null }, NOW)).toBe(false);
    expect(mayRunCohort(none, licensed, NOW)).toBe(true);
    expect(mayRunCohort(none, { licensedUntil: at(-1) }, NOW)).toBe(false);
    expect(mayRunCohort({ own: true, admin: false }, { licensedUntil: null }, NOW)).toBe(true);
    expect(mayRunCohort({ own: false, admin: true }, undefined, NOW)).toBe(true);
  });

  it('a class licence is a date: a date alone, a full timestamp, and nothing', () => {
    expect(cohortIsLicensed({ licensedUntil: '2027-06-30' }, NOW)).toBe(true);
    expect(cohortIsLicensed({ licensedUntil: '2026-06-30' }, NOW)).toBe(false);
    expect(cohortIsLicensed({ licensedUntil: at(1) }, NOW)).toBe(true);
    expect(cohortIsLicensed({ licensedUntil: null }, NOW)).toBe(false);
    expect(cohortIsLicensed({}, NOW)).toBe(false);
    expect(cohortIsLicensed(null, NOW)).toBe(false);
    expect(cohortIsLicensed({ licensedUntil: 'next spring' }, NOW)).toBe(false);
  });
});
