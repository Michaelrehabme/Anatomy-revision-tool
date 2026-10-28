import { afterEach, describe, expect, it } from 'vitest';
import { findAccessCode } from '../accessCode';
import { CLAIM_HREF, CODE_OFFER, clearPendingCode, codeOfferOpen, readPendingCode, savePendingCode } from '../codeOffer';

/**
 * The code the home page prints must be one the server takes, ending when the
 * server says it ends. A test may import the server's list; the app may not.
 */
describe('the advertised code', () => {
  it('is a code the server knows, with the same end date', () => {
    const server = findAccessCode(CODE_OFFER.code);
    expect(server).not.toBeNull();
    expect(server?.accessUntil).toBe(CODE_OFFER.until);
  });

  it('says its end date in words that match the date', () => {
    const d = new Date(CODE_OFFER.until);
    expect(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })).toBe(CODE_OFFER.untilLabel);
  });

  it('comes down by itself when the code ends', () => {
    expect(codeOfferOpen(Date.parse('2026-12-31T23:59:59Z'))).toBe(true);
    expect(codeOfferOpen(Date.parse(CODE_OFFER.until))).toBe(false);
  });

  it('claims through the pricing page with the code typed', () => {
    expect(CLAIM_HREF).toBe('/pricing?code=LocusMSK27');
  });
});

describe('the code being claimed', () => {
  afterEach(() => clearPendingCode());

  it('is kept across a visit to the inbox and cleared when done', () => {
    expect(readPendingCode()).toBeNull();
    savePendingCode(' LocusMSK27 ');
    expect(readPendingCode()).toBe('LocusMSK27');
    clearPendingCode();
    expect(readPendingCode()).toBeNull();
  });

  it('keeps nothing for an empty code', () => {
    savePendingCode('   ');
    expect(readPendingCode()).toBeNull();
  });
});
