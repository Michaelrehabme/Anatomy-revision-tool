import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Auth, AuthCredential, User } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
  linkWithCredential: vi.fn(),
  signInWithCredential: vi.fn(),
  linkWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {
    static credentialFromError = vi.fn();
  },
  EmailAuthProvider: {
    credential: vi.fn((email: string, password: string) => ({ providerId: 'password', email, password })),
  },
  getAuth: vi.fn(),
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

const { linkWithCredential, signInWithCredential, linkWithPopup, signInWithPopup, GoogleAuthProvider } = await import(
  'firebase/auth'
);
const { linkAnonymousCredential, linkAnonymousWithGoogle } = await import('../firebase');

function fakeUser(overrides: Partial<User> = {}): User {
  return { uid: 'user-1', isAnonymous: true, displayName: null, email: null, ...overrides } as User;
}

function fakeAuth(currentUser: User | null): Auth {
  return { currentUser } as Auth;
}

function authError(code: string): Error & { code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

const credential = { providerId: 'password' } as AuthCredential;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('linkAnonymousCredential', () => {
  it('links the credential to the current anonymous user, preserving uid', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const linkedUser = fakeUser({ uid: 'anon-uid', isAnonymous: false, email: 'a@b.com' });
    vi.mocked(linkWithCredential).mockResolvedValue({ user: linkedUser } as never);

    const result = await linkAnonymousCredential(auth, credential);

    expect(linkWithCredential).toHaveBeenCalledWith(anon, credential);
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(result).toEqual({ user: linkedUser, recoveredExistingAccount: false });
  });

  it('recovers the existing account on auth/credential-already-in-use, flagging the conflict', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const existingUser = fakeUser({ uid: 'other-device-uid', isAnonymous: false, email: 'a@b.com' });
    vi.mocked(linkWithCredential).mockRejectedValue(authError('auth/credential-already-in-use'));
    vi.mocked(signInWithCredential).mockResolvedValue({ user: existingUser } as never);

    const result = await linkAnonymousCredential(auth, credential);

    expect(signInWithCredential).toHaveBeenCalledWith(auth, credential);
    expect(result).toEqual({ user: existingUser, recoveredExistingAccount: true });
  });

  it('recovers the existing account on auth/email-already-in-use as well', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const existingUser = fakeUser({ uid: 'other-device-uid', isAnonymous: false, email: 'a@b.com' });
    vi.mocked(linkWithCredential).mockRejectedValue(authError('auth/email-already-in-use'));
    vi.mocked(signInWithCredential).mockResolvedValue({ user: existingUser } as never);

    const result = await linkAnonymousCredential(auth, credential);

    expect(result.recoveredExistingAccount).toBe(true);
    expect(result.user).toBe(existingUser);
  });

  it('rethrows unrelated link errors instead of attempting recovery', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    vi.mocked(linkWithCredential).mockRejectedValue(authError('auth/network-request-failed'));

    await expect(linkAnonymousCredential(auth, credential)).rejects.toMatchObject({
      code: 'auth/network-request-failed',
    });
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('signs in directly (no link attempt) when there is no anonymous session', async () => {
    const auth = fakeAuth(null);
    const signedInUser = fakeUser({ uid: 'real-uid', isAnonymous: false });
    vi.mocked(signInWithCredential).mockResolvedValue({ user: signedInUser } as never);

    const result = await linkAnonymousCredential(auth, credential);

    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(signInWithCredential).toHaveBeenCalledWith(auth, credential);
    expect(result).toEqual({ user: signedInUser, recoveredExistingAccount: false });
  });

  it('signs in directly when the current user is already a permanent account', async () => {
    const permanent = fakeUser({ uid: 'real-uid', isAnonymous: false });
    const auth = fakeAuth(permanent);
    vi.mocked(signInWithCredential).mockResolvedValue({ user: permanent } as never);

    await linkAnonymousCredential(auth, credential);

    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});

describe('linkAnonymousWithGoogle', () => {
  it('links via popup, preserving uid', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const linkedUser = fakeUser({ uid: 'anon-uid', isAnonymous: false });
    vi.mocked(linkWithPopup).mockResolvedValue({ user: linkedUser } as never);

    const result = await linkAnonymousWithGoogle(auth);

    expect(linkWithPopup).toHaveBeenCalled();
    expect(result).toEqual({ user: linkedUser, recoveredExistingAccount: false });
  });

  it('recovers the existing account when Google reports auth/credential-already-in-use', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const existingUser = fakeUser({ uid: 'other-device-uid', isAnonymous: false });
    const error = authError('auth/credential-already-in-use');
    vi.mocked(linkWithPopup).mockRejectedValue(error);
    vi.mocked(GoogleAuthProvider.credentialFromError).mockReturnValue(credential as never);
    vi.mocked(signInWithCredential).mockResolvedValue({ user: existingUser } as never);

    const result = await linkAnonymousWithGoogle(auth);

    expect(GoogleAuthProvider.credentialFromError).toHaveBeenCalledWith(error);
    expect(signInWithCredential).toHaveBeenCalledWith(auth, credential);
    expect(result).toEqual({ user: existingUser, recoveredExistingAccount: true });
  });

  it('rethrows if the conflicting credential cannot be recovered from the error', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    const error = authError('auth/credential-already-in-use');
    vi.mocked(linkWithPopup).mockRejectedValue(error);
    vi.mocked(GoogleAuthProvider.credentialFromError).mockReturnValue(null);

    await expect(linkAnonymousWithGoogle(auth)).rejects.toBe(error);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('rethrows unrelated popup errors', async () => {
    const anon = fakeUser({ uid: 'anon-uid' });
    const auth = fakeAuth(anon);
    vi.mocked(linkWithPopup).mockRejectedValue(authError('auth/popup-closed-by-user'));

    await expect(linkAnonymousWithGoogle(auth)).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
  });

  it('signs in with a fresh popup when there is no anonymous session', async () => {
    const auth = fakeAuth(null);
    const signedInUser = fakeUser({ uid: 'real-uid', isAnonymous: false });
    vi.mocked(signInWithPopup).mockResolvedValue({ user: signedInUser } as never);

    const result = await linkAnonymousWithGoogle(auth);

    expect(linkWithPopup).not.toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalled();
    expect(result).toEqual({ user: signedInUser, recoveredExistingAccount: false });
  });
});
