import { describe, expect, it } from 'vitest';
import { countUsers, matchesFilter, userAccess } from '../userAccess';
import type { AdminUserProfile } from '../../types/adminUser';

const NOW = new Date('2026-10-29T12:00:00.000Z');

const profile = (over: Partial<AdminUserProfile>): AdminUserProfile => ({
  uid: 'u',
  displayName: null,
  email: null,
  createdAt: null,
  lastActiveAt: null,
  ...over,
});

const codeGrant = (expiresAt: string) => ({
  tier: 'individual' as const,
  source: 'complimentary' as const,
  expiresAt,
  accessCode: 'LOCUSMSK27',
  teaching: false as const,
});

describe('userAccess', () => {
  it('reads a profile with no email as a guest on the free tier', () => {
    expect(userAccess(profile({}), NOW)).toEqual({ signedUp: false, fullAccess: false, accessCode: null, label: 'Free' });
  });

  it('counts a redeemed code that is still running as full access', () => {
    const a = userAccess(profile({ email: 'a@b.com', entitlement: codeGrant('2027-01-01T00:00:00.000Z') }), NOW);
    expect(a).toEqual({ signedUp: true, fullAccess: true, accessCode: 'LOCUSMSK27', label: 'Code LOCUSMSK27' });
  });

  it('still names the code once its access has ended', () => {
    const a = userAccess(profile({ email: 'a@b.com', entitlement: codeGrant('2026-10-01T00:00:00.000Z') }), NOW);
    expect(a.fullAccess).toBe(false);
    expect(a.label).toBe('Code LOCUSMSK27 (ended)');
    expect(matchesFilter(a, 'redeemed')).toBe(true);
    expect(matchesFilter(a, 'full-access')).toBe(false);
  });

  it('labels a paid subscription and a permanent grant', () => {
    const paid = userAccess(profile({ email: 'a@b.com', entitlement: { tier: 'individual', source: 'paddle', expiresAt: '2026-11-29T00:00:00.000Z' } }), NOW);
    const comp = userAccess(profile({ email: 'a@b.com', entitlement: { tier: 'individual', source: 'complimentary', expiresAt: null } }), NOW);
    expect([paid.label, comp.label]).toEqual(['Paid', 'Complimentary']);
  });

  it('counts each group', () => {
    const accesses = [
      userAccess(profile({}), NOW),
      userAccess(profile({ email: 'a@b.com' }), NOW),
      userAccess(profile({ email: 'c@d.com', entitlement: codeGrant('2027-01-01T00:00:00.000Z') }), NOW),
    ];
    expect(countUsers(accesses)).toEqual({ all: 3, signedUp: 2, fullAccess: 1, redeemed: 1 });
  });
});
