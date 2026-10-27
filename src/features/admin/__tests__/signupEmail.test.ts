import { describe, expect, it } from 'vitest';
import { isSignedUp, signupEmail, type SignupAccount } from '../data/signupEmail';

const account: SignupAccount = {
  uid: 'u1',
  email: 'sam@example.com',
  displayName: 'Sam Lee',
  providers: ['password'],
  emailVerified: false,
  createdAt: 'Sun, 25 Oct 2026 10:00:00 GMT',
};

describe('signupEmail', () => {
  it('says who signed up, how, and where to see them', () => {
    const { subject, text } = signupEmail(account, 42);
    expect(subject).toBe('New sign-up: sam@example.com');
    expect(text).toContain('Name: Sam Lee');
    expect(text).toContain('Signed up with: Email and password');
    expect(text).toContain('Email confirmed: not yet');
    expect(text).toContain('Signed-up accounts in all: 42');
    expect(text).toContain('/admin/users/u1');
  });

  it('leaves out email confirmation for a Google sign-up', () => {
    const { text } = signupEmail({ ...account, providers: ['google.com'], emailVerified: true }, 1);
    expect(text).toContain('Signed up with: Google');
    expect(text).not.toContain('Email confirmed');
  });

  it('falls back to the uid when there is no email or name', () => {
    expect(signupEmail({ ...account, email: null, displayName: null }, 1).subject).toBe('New sign-up: u1');
  });
});

describe('isSignedUp', () => {
  it('does not count a guest', () => {
    expect(isSignedUp({ providers: [] })).toBe(false);
    expect(isSignedUp({ providers: ['google.com'] })).toBe(true);
  });
});
