import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LinkResult } from '../../data/firebase';
import { readConfirmationRecord, recordConfirmationSent } from '../../lib/emailVerification';

/** A Firebase user, by way of the app's own module: test files are held to not importing the SDK. */
type User = LinkResult['user'];

/**
 * What the provider does about a confirmed email address (owner's decision,
 * 7 Oct 2026; lib/emailVerification.ts).
 *
 * Like a guest becoming an account, an address becoming confirmed keeps the
 * uid, so Firebase's listener says nothing about it: the stand-in here calls
 * the listener ONCE, as Firebase does, and whatever the screens learn after
 * that they learn from the provider's own actions.
 */

const firebase = vi.hoisted(() => ({
  listener: null as ((user: unknown) => void) | null,
  listenerCalls: 0,
  current: null as unknown,
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  reloadSignedInUser: vi.fn(),
  removeEmailSignIn: vi.fn(),
  confirmedForRules: vi.fn(),
  touchUserProfile: vi.fn(async () => {}),
  order: [] as string[],
}));

vi.mock('../../data/firebase', () => ({
  subscribeToAuthState: (callback: (user: unknown) => void) => {
    firebase.listener = (user) => {
      firebase.listenerCalls += 1;
      callback(user);
    };
    return () => { firebase.listener = null; };
  },
  ensureAnonymousUser: vi.fn(async () => {}),
  touchUserProfile: firebase.touchUserProfile,
  signUpWithEmail: firebase.signUpWithEmail,
  signInWithEmail: firebase.signInWithEmail,
  signInWithGoogle: firebase.signInWithGoogle,
  linkAnonymousAccount: vi.fn(),
  signOutUser: vi.fn(async () => {}),
}));
vi.mock('../../data/emailConfirmation', () => ({
  sendConfirmationEmail: firebase.sendConfirmationEmail,
  reloadSignedInUser: firebase.reloadSignedInUser,
  removeEmailSignIn: firebase.removeEmailSignIn,
  confirmedForRules: firebase.confirmedForRules,
}));

vi.stubEnv('VITE_PERSISTENCE', 'firestore');

const { AuthProvider, useAuth } = await import('../AuthProvider');

const PASSWORD = [{ providerId: 'password' }];
const guest = { uid: 'u1', isAnonymous: true, email: null, displayName: null, emailVerified: false, providerData: [] } as unknown as User;
const unconfirmed = { uid: 'u1', isAnonymous: false, email: 'sam@example.com', displayName: null, emailVerified: false, providerData: PASSWORD } as unknown as User;
const confirmed = { ...unconfirmed, emailVerified: true } as unknown as User;
const google = { uid: 'u1', isAnonymous: false, email: 'sam@gmail.com', displayName: 'Sam', emailVerified: true, providerData: [{ providerId: 'google.com' }] } as unknown as User;
/** What Firebase leaves when the only sign-in is taken off: not "anonymous", and no way of signing in. */
const signInRemoved = { uid: 'u1', isAnonymous: false, email: 'sam@example.com', displayName: null, emailVerified: false, providerData: [] } as unknown as User;

function Who() {
  const { user, loading } = useAuth();
  return (
    <p data-testid="who">
      {loading ? 'loading' : `${user?.isAnonymous ? 'guest' : 'account'}|${user?.email ?? 'no email'}|${user?.emailVerified ? 'confirmed' : 'unconfirmed'}`}
    </p>
  );
}

function Actions() {
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, sendConfirmationEmail, checkEmailConfirmed, removeUnconfirmedEmail } = useAuth();
  return (
    <>
      <button type="button" onClick={() => void signUpWithEmail('sam@example.com', 'password123')}>sign up</button>
      <button type="button" onClick={() => void signInWithEmail('sam@example.com', 'password123')}>sign in</button>
      <button type="button" onClick={() => void signInWithGoogle()}>google</button>
      <button type="button" onClick={() => void sendConfirmationEmail().catch(() => {})}>send</button>
      <button type="button" onClick={() => void checkEmailConfirmed().catch(() => {})}>check</button>
      <button type="button" onClick={() => void removeUnconfirmedEmail()}>different</button>
    </>
  );
}

async function openAs(user: User) {
  render(
    <AuthProvider>
      <Who />
      <Actions />
    </AuthProvider>,
  );
  await waitFor(() => expect(firebase.listener).toBeTruthy());
  firebase.current = user;
  act(() => firebase.listener!(user));
  await waitFor(() => expect(screen.getByTestId('who').textContent).not.toBe('loading'));
}

const who = () => screen.getByTestId('who').textContent;

beforeEach(() => {
  localStorage.clear();
  firebase.listenerCalls = 0;
  firebase.listener = null;
  firebase.current = null;
  firebase.order.length = 0;
  vi.clearAllMocks();
  firebase.confirmedForRules.mockImplementation(async (user: User) => user.emailVerified === true);
  firebase.sendConfirmationEmail.mockImplementation(async () => {
    firebase.order.push('email sent');
    return { uid: 'u1', email: 'sam@example.com' };
  });
});

afterEach(cleanup);

describe('creating an account with an email and password', () => {
  it('emails the link at once, notes that this account must confirm, and only then tells the screens', async () => {
    firebase.signUpWithEmail.mockImplementation(async () => {
      firebase.order.push('account made');
      firebase.current = unconfirmed;
      return { user: unconfirmed, recoveredExistingAccount: false };
    });
    await openAs(guest);
    expect(who()).toBe('guest|no email|unconfirmed');

    fireEvent.click(screen.getByRole('button', { name: 'sign up' }));
    await waitFor(() => expect(who()).toBe('account|sam@example.com|unconfirmed'));

    expect(firebase.order).toEqual(['account made', 'email sent']);
    const record = readConfirmationRecord('u1');
    expect(record).toMatchObject({ email: 'sam@example.com', required: true });
    expect(record?.sentAt).toBeTypeOf('number');
    // Firebase said nothing about any of it.
    expect(firebase.listenerCalls).toBe(1);
  });

  it('still makes the account when the email cannot be sent, and records that none went', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    firebase.signUpWithEmail.mockResolvedValue({ user: unconfirmed, recoveredExistingAccount: false });
    firebase.sendConfirmationEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    await openAs(guest);

    fireEvent.click(screen.getByRole('button', { name: 'sign up' }));
    await waitFor(() => expect(who()).toBe('account|sam@example.com|unconfirmed'));
    expect(readConfirmationRecord('u1')).toEqual({ email: 'sam@example.com', sentAt: null, required: true });
  });

  // "An account with this email already existed, so we signed you into it":
  // that account is not one this app has just made, and is not sent anything.
  it('sends nothing when the address turned out to belong to an existing account', async () => {
    firebase.signUpWithEmail.mockResolvedValue({ user: { ...unconfirmed, uid: 'someone-else' }, recoveredExistingAccount: true });
    await openAs(guest);
    fireEvent.click(screen.getByRole('button', { name: 'sign up' }));
    await waitFor(() => expect(firebase.signUpWithEmail).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(firebase.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(readConfirmationRecord('someone-else')).toBeNull();
  });
});

describe('an account that arrives confirmed', () => {
  it('Google: confirmed from the first moment, no email, nothing noted', async () => {
    firebase.signInWithGoogle.mockResolvedValue({ user: google, recoveredExistingAccount: false });
    await openAs(guest);
    fireEvent.click(screen.getByRole('button', { name: 'google' }));
    await waitFor(() => expect(who()).toBe('account|sam@gmail.com|confirmed'));
    expect(firebase.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(readConfirmationRecord('u1')).toBeNull();
  });

  // The address is confirmed on the account before it is confirmed on the
  // token the database reads. Nothing is told "confirmed" until both agree,
  // because the first thing a confirmed account does may be to choose its area.
  it('on load: waits for the token to say so before any screen is told', async () => {
    let release!: () => void;
    firebase.confirmedForRules.mockImplementation(() => new Promise<boolean>((resolve) => { release = () => resolve(true); }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(firebase.listener).toBeTruthy());
    act(() => firebase.listener!(confirmed));
    await act(async () => { await Promise.resolve(); });
    expect(who()).toBe('loading');
    await act(async () => { release(); });
    await waitFor(() => expect(who()).toBe('account|sam@example.com|confirmed'));
    expect(firebase.confirmedForRules).toHaveBeenCalledWith(confirmed);
  });

  it('on load: forgets what this device had noted about the email', async () => {
    recordConfirmationSent('u1', 'sam@example.com');
    await openAs(confirmed);
    expect(readConfirmationRecord('u1')).toBeNull();
  });

  it('on load, unconfirmed: is told at once, without asking about the token', async () => {
    await openAs(unconfirmed);
    expect(who()).toBe('account|sam@example.com|unconfirmed');
    expect(firebase.confirmedForRules).not.toHaveBeenCalled();
  });
});

describe('"I\'ve confirmed — continue"', () => {
  it('tells every screen once the address is confirmed, with no reload and nothing from Firebase', async () => {
    await openAs(unconfirmed);
    recordConfirmationSent('u1', 'sam@example.com');
    firebase.reloadSignedInUser.mockResolvedValue(confirmed);

    fireEvent.click(screen.getByRole('button', { name: 'check' }));
    await waitFor(() => expect(who()).toBe('account|sam@example.com|confirmed'));
    expect(firebase.listenerCalls).toBe(1);
    expect(readConfirmationRecord('u1')).toBeNull();
    // The profile is refreshed, as it is for any change to who this is.
    expect(firebase.touchUserProfile).toHaveBeenLastCalledWith(confirmed);
  });

  it('changes nothing when it is not confirmed yet', async () => {
    await openAs(unconfirmed);
    firebase.reloadSignedInUser.mockResolvedValue(unconfirmed);
    firebase.touchUserProfile.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'check' }));
    await waitFor(() => expect(firebase.reloadSignedInUser).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(who()).toBe('account|sam@example.com|unconfirmed');
    expect(firebase.touchUserProfile).not.toHaveBeenCalled();
  });
});

describe('resending', () => {
  it('records when and where the email went', async () => {
    await openAs(unconfirmed);
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(readConfirmationRecord('u1')?.sentAt).toBeTypeOf('number'));
    // Asking for the link does not, by itself, mark the account as one that must confirm.
    expect(readConfirmationRecord('u1')).toMatchObject({ email: 'sam@example.com', required: false });
  });

  it('records nothing when Firebase refuses', async () => {
    firebase.sendConfirmationEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    await openAs(unconfirmed);
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(firebase.sendConfirmationEmail).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(readConfirmationRecord('u1')).toBeNull();
  });
});

describe('"Use a different email"', () => {
  // The sign-in is taken off and the uid is kept. Firebase goes on calling
  // such a user "not anonymous"; with no way of signing in, they are a guest,
  // and are told so — which is what brings the sign-up form back.
  it('makes them a guest again with the same uid, and forgets the address', async () => {
    await openAs(unconfirmed);
    recordConfirmationSent('u1', 'sam@example.com');
    firebase.removeEmailSignIn.mockResolvedValue(signInRemoved);

    fireEvent.click(screen.getByRole('button', { name: 'different' }));
    await waitFor(() => expect(who()).toBe('guest|no email|unconfirmed'));
    expect(readConfirmationRecord('u1')).toBeNull();
    expect(firebase.listenerCalls).toBe(1);
  });
});

describe('a build with no accounts', () => {
  it('has nobody to confirm: its one user counts as confirmed, and checking says so', async () => {
    vi.stubEnv('VITE_PERSISTENCE', 'local');
    try {
      render(<AuthProvider><Who /><Actions /></AuthProvider>);
      await waitFor(() => expect(who()).toBe('guest|no email|confirmed'));
      expect(firebase.listener).toBeNull();
    } finally {
      vi.stubEnv('VITE_PERSISTENCE', 'firestore');
    }
  });
});
