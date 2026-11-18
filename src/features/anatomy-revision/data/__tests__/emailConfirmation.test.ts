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
  applyActionCode: vi.fn(),
  checkActionCode: vi.fn(),
  current: null as unknown,
}));

vi.mock('firebase/auth', () => ({
  sendEmailVerification: sdk.sendEmailVerification,
  unlink: sdk.unlink,
  applyActionCode: sdk.applyActionCode,
  checkActionCode: sdk.checkActionCode,
  EmailAuthProvider: { PROVIDER_ID: 'password' },
}));
vi.mock('../firebase', () => ({ getFirebaseAuth: () => ({ currentUser: sdk.current }) }));

const { confirmEmailWithCode, confirmationContinueUrl, confirmedForRules, reloadSignedInUser, removeEmailSignIn, sendConfirmationEmail } = await import('../emailConfirmation');

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
  // No send-verification-email function by default: Firebase's own email goes.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('Not found', { status: 404 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('the confirmation email', () => {
  it('is asked for once, plainly, with no address to come back to', async () => {
    const u = user();
    sdk.current = u;
    expect(confirmationContinueUrl()).toBe(`${location.origin}/onboarding?emailConfirmed=1`);
    expect(await sendConfirmationEmail()).toEqual({ uid: 'u1', email: 'sam@example.com' });
    expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(u);
  });

  // Firebase limits how often one account may ask, and a refused request
  // counts. A second request straight after a refusal is itself refused, so
  // there must never be one: on the real service that retry was what turned
  // every sign-up into "Too many emails" with nothing sent (8 Oct 2026).
  it.each(['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/too-many-requests'])(
    'never asks a second time after a refusal (%s)',
    async (code) => {
      sdk.current = user();
      sdk.sendEmailVerification.mockRejectedValueOnce(authError(code));
      await expect(sendConfirmationEmail()).rejects.toMatchObject({ code });
      expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(1);
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

describe('the app’s own confirmation email', () => {
  const answer = (status: number, body: unknown) => vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

  it('is sent by the function with the account’s token, and Firebase sends nothing', async () => {
    sdk.current = user();
    answer(200, { ok: true });
    expect(await sendConfirmationEmail()).toEqual({ uid: 'u1', email: 'sam@example.com' });
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/send-verification-email', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('reports its own limit as Firebase’s, and sends nothing else', async () => {
    sdk.current = user();
    answer(429, { ok: false, reason: 'too-soon' });
    await expect(sendConfirmationEmail()).rejects.toMatchObject({ code: 'auth/too-many-requests' });
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled();
  });

  it.each([
    ['not configured', () => answer(503, { ok: false })],
    ['refused', () => answer(502, { ok: false })],
    ['the SPA page where no function is', () => vi.mocked(fetch).mockResolvedValueOnce(new Response('<!doctype html>', { status: 200 }))],
    ['unreachable', () => vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))],
  ])('falls back to Firebase’s email when the function is %s', async (_, arrange) => {
    sdk.current = user();
    arrange();
    await sendConfirmationEmail();
    expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(1);
  });
});

describe('following the link on /auth/action', () => {
  it('confirms with the code and re-reads the signed-in account', async () => {
    const u = user();
    sdk.current = u;
    sdk.checkActionCode.mockResolvedValue({ data: { email: 'sam@example.com' } });
    sdk.applyActionCode.mockResolvedValue(undefined);
    expect(await confirmEmailWithCode('CODE')).toEqual({ email: 'sam@example.com' });
    expect(sdk.applyActionCode).toHaveBeenCalledWith(expect.anything(), 'CODE');
    expect(u.reload).toHaveBeenCalled();
  });

  it('works with nobody signed in, and passes on an expired link', async () => {
    sdk.checkActionCode.mockResolvedValueOnce({ data: { email: 'sam@example.com' } });
    sdk.applyActionCode.mockResolvedValueOnce(undefined);
    expect(await confirmEmailWithCode('CODE')).toEqual({ email: 'sam@example.com' });
    sdk.checkActionCode.mockRejectedValueOnce(authError('auth/expired-action-code'));
    await expect(confirmEmailWithCode('OLD')).rejects.toMatchObject({ code: 'auth/expired-action-code' });
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
