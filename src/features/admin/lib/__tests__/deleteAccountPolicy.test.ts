import { describe, expect, it } from 'vitest';
import { confirmationWord, deleteRefusal } from '../deleteAccountPolicy';

const base = { actorUid: 'me', targetUid: 'them', targetIsAdmin: false, entitlement: null, now: new Date('2026-11-15') };

describe('deleteRefusal', () => {
  it('lets an admin delete an ordinary or complimentary account', () => {
    expect(deleteRefusal(base)).toBeNull();
    expect(deleteRefusal({ ...base, entitlement: { tier: 'individual', source: 'complimentary', expiresAt: null } as never })).toBeNull();
  });
  it('refuses yourself, another admin, and a live Paddle subscription', () => {
    expect(deleteRefusal({ ...base, targetUid: 'me' })).toBe('self');
    expect(deleteRefusal({ ...base, targetIsAdmin: true })).toBe('admin');
    expect(deleteRefusal({ ...base, entitlement: { tier: 'individual', source: 'paddle', expiresAt: null } as never })).toBe('paying');
  });
  it('allows a Paddle subscription that has ended', () => {
    expect(deleteRefusal({ ...base, entitlement: { tier: 'individual', source: 'paddle', expiresAt: '2026-01-01T00:00:00Z' } as never })).toBeNull();
  });
});

describe('confirmationWord', () => {
  it('is the email, or DELETE for a guest', () => {
    expect(confirmationWord('a@b.com')).toBe('a@b.com');
    expect(confirmationWord(null)).toBe('DELETE');
  });
});
