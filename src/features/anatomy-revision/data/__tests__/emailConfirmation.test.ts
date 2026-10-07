import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

/**
 * What the app asks of Firebase to confirm an email address
 * (data/emailConfirmation.ts), against a stand-in for the SDK.
 *
 * The three things worth holding: the email is still sent when the Firebase
 * project does not allow this origin as somewhere to come back to; a
 * confirmed address is not called confirmed until the TOKEN the database
 * reads says so; and "Use a different email" takes off the password sign-in
 * and nothing else.
 */

const sdk = vi.hoisted(() => ({
  sendEmailVerification: vi.fn(),
  unlink: vi.fn(),
  current: null as unknown,
}));

vi.mock('firebase/auth', () => ({
  sendEmailVerification: sdk.sendEmailVerification,
  unlink: sdk.unlink,
  EmailAuthProvider: { PROVIDER_ID: 'password' },
}));
vi.mock('../firebase', () => ({ getFirebaseAuth: () => ({ currentUser: sdk.current }) }));

const { confirmationContinueUrl, confirmedForRules, reloadSignedInUser, removeEmailSignIn, sendConfirmationEmail } = await import('../emailConfirmation');

function user(over: Record<string, unknown> = {}) {
  return {
    uid: 'u1',
    email: 'sam@example.com',
    emailVerified: false,
    isAnonymous: false,
    providerData: [{ providerId: 'password' }],
    reload: vi.fn(async () => {}),
    getIdToken: vi.fn(async () => 'token'),
    getIdTokenResult: vi.fn(async () => ({ claims: { email_verified: false } })),
    ...over,
  };
}
const asUser = (u: ReturnType<typeof user>) => u as unknown as User;
const authError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  vi.clearAllMocks();
  sdk.current = null;
  sdk.sendEmailVerification.mockResolvedValue(undefined);
  sdk.unlink.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('the confirmation email', () => {
  it('leads back to this app, on the origin it is being used from', async () => {
    const u = user();
    sdk.current = u;
    expect(confirmationContinueUrl()).toBe(`${location.origin}/onboarding?emailConfirmed=1`);
    expect(await sendConfirmationEmail()).toEqual({ uid: 'u1', email: 'sam@example.com' });
    expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(u, { url: `${location.origin}/onboarding?emailConfirmed=1`, handleCodeInApp: false });
  });

  // The Firebase console lists the domains a link may come back to. If this
  // origin is not on it, the email goes without the way back rather than not
  // at all: the link still confirms the address.
  it.each(['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/missing-continue-uri'])(
    'is still sent, without the way back, when Firebase refuses the address to come back to (%s)',
    async (code) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const u = user();
      sdk.current = u;
      sdk.sendEmailVerification.mockRejectedValueOnce(authError(code));
      await expect(sendConfirmationEmail()).resolves.toEqual({ uid: 'u1', email: 'sam@example.com' });
      expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(2);
      expect(sdk.sendEmailVerification).toHaveBeenLastCalledWith(u);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('not an authorised domain'));
    },
  );

  it("hands back Firebase's own refusal for anything else: its limit on emails, or no connection", async () => {
    sdk.current = user();
    for (const code of ['auth/too-many-requests', 'auth/network-request-failed']) {
      sdk.sendEmailVerification.mockRejectedValueOnce(authError(code));
      await expect(sendConfirmationEmail()).rejects.toMatchObject({ code });
    }
    expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(2);
  });

  it('refuses when nobody is signed in', async () => {
    await expect(sendConfirmationEmail()).rejects.toThrow('Nobody is signed in.');
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled();
  });
});

describe('confirmed, as the database will see it', () => {
  it('is false for an unconfirmed account, and asks nothing of the token', async () => {
    const u = user();
    expect(await confirmedForRules(asUser(u))).toBe(false);
    expect(u.getIdTokenResult).not.toHaveBeenCalled();
  });

  // The account says confirmed; the token was minted before the link was
  // followed and still says it is not. firestore.rules reads the token.
  it('replaces a token that was minted before the address was confirmed', async () => {
    const u = user({ emailVerified: true });
    expect(await confirmedForRules(asUser(u))).toBe(true);
    expect(u.getIdToken).toHaveBeenCalledWith(true);
  });

  it('leaves a token that already says so alone', async () => {
    const u = user({ emailVerified: true, getIdTokenResult: vi.fn(async () => ({ claims: { email_verified: true } })) });
    expect(await confirmedForRules(asUser(u))).toBe(true);
    expect(u.getIdToken).not.toHaveBeenCalled();
  });

  it('still reports a confirmed account offline, when the token cannot be looked at', async () => {
    const u = user({ emailVerified: true, getIdTokenResult: vi.fn(async () => { throw authError('auth/network-request-failed'); }) });
    expect(await confirmedForRules(asUser(u))).toBe(true);
  });
});

describe('asking whether the link has been followed', () => {
  it('reloads the account, and replaces the token only if it is now confirmed', async () => {
    const waiting = user();
    sdk.current = waiting;
    expect(await reloadSignedInUser()).toBe(waiting);
    expect(waiting.reload).toHaveBeenCalledTimes(1);
    expect(waiting.getIdToken).not.toHaveBeenCalled();

    const done = user();
    done.reload.mockImplementation(async () => { (done as { emailVerified: boolean }).emailVerified = true; });
    sdk.current = done;
    expect((await reloadSignedInUser())?.emailVerified).toBe(true);
    expect(done.getIdToken).toHaveBeenCalledWith(true);
  });

  it('rejects when it cannot ask, so the screen can say so', async () => {
    sdk.current = user({ reload: vi.fn(async () => { throw authError('auth/network-request-failed'); }) });
    await expect(reloadSignedInUser()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
  });

  it('is nothing when nobody is signed in', async () => {
    expect(await reloadSignedInUser()).toBeNull();
  });
});

describe('"Use a different email"', () => {
  it('takes the password sign-in off the account, and reloads it', async () => {
    const u = user();
    sdk.current = u;
    expect(await removeEmailSignIn()).toBe(u);
    expect(sdk.unlink).toHaveBeenCalledWith(u, 'password');
    expect(u.reload).toHaveBeenCalledTimes(1);
  });

  it('does not touch an account that has no password sign-in (Google, or already taken off)', async () => {
    sdk.current = user({ providerData: [{ providerId: 'google.com' }] });
    await removeEmailSignIn();
    sdk.current = user({ providerData: [] });
    await removeEmailSignIn();
    expect(sdk.unlink).not.toHaveBeenCalled();
  });

  it('rejects if Firebase refuses, leaving the account as it was', async () => {
    const u = user();
    sdk.current = u;
    sdk.unlink.mockRejectedValue(authError('auth/network-request-failed'));
    await expect(removeEmailSignIn()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(u.reload).not.toHaveBeenCalled();
  });

  it('still succeeds when the reload afterwards cannot be made', async () => {
    const u = user({ reload: vi.fn(async () => { throw authError('auth/network-request-failed'); }) });
    sdk.current = u;
    await expect(removeEmailSignIn()).resolves.toBe(u);
  });
});
