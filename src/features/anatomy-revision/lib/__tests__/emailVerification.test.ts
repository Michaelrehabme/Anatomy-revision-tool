import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RESEND_WAIT_MS,
  VERIFICATION_STARTS,
  clearConfirmationRecord,
  markConfirmationRequired,
  mayChangeFreeArea,
  mayHoldFreeArea,
  predatesVerification,
  readConfirmationRecord,
  recordConfirmationSent,
  rememberPredates,
  rememberedPredates,
  resendWaitLeft,
} from '../emailVerification';
import { accessRecord, areaAccess } from '../entitlementRecord';
import { AREAS } from '../../types/region';

/**
 * A confirmed email address before the free area (owner's decision, 7 Oct
 * 2026). The rule is stated once, in lib/emailVerification.ts, and kept in
 * three places: the database's rules, the content function, and the app.
 * This file holds the parts that are pure, and that the three agree on WHEN
 * the rule starts.
 */

describe('when the rule starts', () => {
  // firestore.rules can import nothing, so it repeats the date. An account
  // from before it keeps its free area unconfirmed; if the rules and the app
  // drew that line on different days, the app would show a student an area
  // the database then refused to store (or the reverse).
  it('is the same day in firestore.rules as in the app and the function', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const match = rules.match(/function verificationStarts\(\) \{\s*return timestamp\.date\((\d+), (\d+), (\d+)\);/);
    expect(match, 'firestore.rules has no verificationStarts() of the expected shape').not.toBeNull();
    const [, year, month, day] = match!.map(Number);
    expect(new Date(Date.UTC(year, month - 1, day)).toISOString()).toBe(VERIFICATION_STARTS);
  });

  // It may be moved LATER, to the day the new app is released, and never
  // earlier than the day the rule was made: before that, nobody had been
  // told. (A date still in the future on the day it is deployed would count
  // every sign-up until then as "here before the rule". No test can know the
  // day of a deploy; docs/CONTENT-SERVER-STATUS.md, "Before you deploy".)
  it('is midnight UTC on a day no earlier than the day the rule was made', () => {
    expect(Date.parse(VERIFICATION_STARTS)).not.toBeNaN();
    expect(VERIFICATION_STARTS.endsWith('T00:00:00.000Z')).toBe(true);
    expect(Date.parse(VERIFICATION_STARTS)).toBeGreaterThanOrEqual(Date.parse('2026-10-07T00:00:00.000Z'));
  });
});

describe('whether a profile was here before the rule', () => {
  const before = Date.parse(VERIFICATION_STARTS) - 1;
  const after = Date.parse(VERIFICATION_STARTS);

  it('reads a timestamp from either SDK, a date, a string or a number', () => {
    expect(predatesVerification({ toMillis: () => before })).toBe(true);
    expect(predatesVerification({ seconds: Math.floor(before / 1000) - 1, nanoseconds: 0 })).toBe(true);
    expect(predatesVerification({ _seconds: Math.floor(before / 1000) - 1, _nanoseconds: 0 })).toBe(true);
    expect(predatesVerification(new Date(before))).toBe(true);
    expect(predatesVerification(new Date(before).toISOString())).toBe(true);
    expect(predatesVerification(before)).toBe(true);
  });

  it('draws the line at the instant itself: that instant and after are new', () => {
    expect(predatesVerification({ toMillis: () => after })).toBe(false);
    expect(predatesVerification({ toMillis: () => after + 86_400_000 })).toBe(false);
  });

  // "Could not tell" is not "old": the rules say the same of a profile with no date.
  it('does not take a missing or unreadable date for an old one', () => {
    for (const nothing of [undefined, null, '', 'yesterday', {}, [], Number.NaN, true]) {
      expect(predatesVerification(nothing), String(nothing)).toBe(false);
    }
  });
});

describe('who may hold a free area, and who may change it', () => {
  it('a confirmed account may do both', () => {
    expect(mayHoldFreeArea({ emailVerified: true, predatesVerification: false })).toBe(true);
    expect(mayChangeFreeArea({ emailVerified: true })).toBe(true);
  });

  it('an unconfirmed account from before the rule keeps its area and may not change it', () => {
    expect(mayHoldFreeArea({ emailVerified: false, predatesVerification: true })).toBe(true);
    expect(mayChangeFreeArea({ emailVerified: false })).toBe(false);
  });

  it('an unconfirmed account since the rule may do neither', () => {
    expect(mayHoldFreeArea({ emailVerified: false, predatesVerification: false })).toBe(false);
    expect(mayChangeFreeArea({ emailVerified: false })).toBe(false);
  });
});

describe('the decision the function and the app share (areaAccess)', () => {
  const NOW = new Date('2026-11-01T12:00:00.000Z');
  const NEW = { toMillis: () => Date.parse(VERIFICATION_STARTS) + 86_400_000 };
  const OLD = { toMillis: () => Date.parse(VERIFICATION_STARTS) - 86_400_000 };
  const knee = { area: 'knee', chosenAt: { toMillis: () => NOW.getTime() - 5 * 86_400_000 }, switches: 0 };
  const paid = { tier: 'individual', source: 'paddle', expiresAt: '2026-12-01T00:00:00.000Z' };

  it('refuses an unconfirmed account its free area and says why', () => {
    const record = accessRecord({ createdAt: NEW, freeArea: knee }, null, NOW);
    expect(areaAccess('knee', record, NOW, { emailVerified: false })).toMatchObject({ allowed: false, reason: 'unconfirmed' });
    // An area it never held is a plain refusal: confirming would not open it.
    expect(areaAccess('hip', record, NOW, { emailVerified: false })).toEqual({ allowed: false, entitlement: expect.objectContaining({ tier: 'free' }) });
    expect(areaAccess('knee', record, NOW, { emailVerified: true }).allowed).toBe(true);
  });

  it('serves an account from before the rule the area it has', () => {
    const record = accessRecord({ createdAt: OLD, freeArea: knee }, null, NOW);
    expect(areaAccess('knee', record, NOW, { emailVerified: false }).allowed).toBe(true);
  });

  // The whole point of the exception for full access: nobody is kept from
  // what they paid for by an email they have not opened.
  it('never holds back full access: every area, confirmed or not, old profile or new', () => {
    for (const createdAt of [NEW, OLD, undefined]) {
      const record = accessRecord({ createdAt, entitlement: paid }, null, NOW);
      for (const area of AREAS) expect(areaAccess(area, record, NOW, { emailVerified: false }).allowed, area).toBe(true);
    }
    const member = accessRecord({ createdAt: NEW, cohort: 'c1' }, { licensedUntil: '2027-01-01T00:00:00.000Z' }, NOW);
    for (const area of AREAS) expect(areaAccess(area, member, NOW, { emailVerified: false }).allowed, area).toBe(true);
  });

  it('holds nothing back when the caller does not say whether the address is confirmed', () => {
    const record = accessRecord({ createdAt: NEW, freeArea: knee }, null, NOW);
    expect(areaAccess('knee', record, NOW).allowed).toBe(true);
  });
});

describe('what the device remembers about the email', () => {
  beforeEach(() => localStorage.clear());

  it('notes an account this app made as one that must confirm, and forgets it when told', () => {
    expect(readConfirmationRecord('u1')).toBeNull();
    markConfirmationRequired('u1', 'sam@example.com');
    expect(readConfirmationRecord('u1')).toEqual({ email: 'sam@example.com', sentAt: null, required: true });
    // Another account on the same device is another record.
    expect(readConfirmationRecord('u2')).toBeNull();
    clearConfirmationRecord('u1');
    expect(readConfirmationRecord('u1')).toBeNull();
  });

  it('keeps "must confirm" when an email is sent, and does not invent it for an account that was not marked', () => {
    markConfirmationRequired('u1', 'sam@example.com');
    recordConfirmationSent('u1', 'sam@example.com', 1000);
    expect(readConfirmationRecord('u1')).toEqual({ email: 'sam@example.com', sentAt: 1000, required: true });
    // An account from before the rule that asks for the link, to change its
    // area, is not thereby locked out of the area it has.
    recordConfirmationSent('old', 'old@example.com', 1000);
    expect(readConfirmationRecord('old')?.required).toBe(false);
  });

  it('makes them wait a minute between two emails to the same address, and not at all for a new one', () => {
    recordConfirmationSent('u1', 'sam@example.com', 10_000);
    const record = readConfirmationRecord('u1');
    expect(resendWaitLeft(record, 'sam@example.com', 10_000)).toBe(RESEND_WAIT_MS);
    expect(resendWaitLeft(record, 'sam@example.com', 10_000 + RESEND_WAIT_MS - 1)).toBe(1);
    expect(resendWaitLeft(record, 'sam@example.com', 10_000 + RESEND_WAIT_MS)).toBe(0);
    expect(resendWaitLeft(record, 'other@example.com', 10_000)).toBe(0);
    expect(resendWaitLeft(null, 'sam@example.com', 10_000)).toBe(0);
  });

  it('survives storage that holds rubbish', () => {
    localStorage.setItem('anatomy-revision:v1:email-confirmation:u1', '{not json');
    expect(readConfirmationRecord('u1')).toBeNull();
    localStorage.setItem('anatomy-revision:v1:email-confirmation:u1', JSON.stringify({ sentAt: 'soon', required: 'yes' }));
    expect(readConfirmationRecord('u1')).toEqual({ email: null, sentAt: null, required: false });
  });

  it('remembers whether a profile predates the rule, per account, and says when it never learned', () => {
    expect(rememberedPredates('u1')).toBeNull();
    rememberPredates('u1', true);
    rememberPredates('u2', false);
    expect(rememberedPredates('u1')).toBe(true);
    expect(rememberedPredates('u2')).toBe(false);
    expect(rememberedPredates('u3')).toBeNull();
  });
});
