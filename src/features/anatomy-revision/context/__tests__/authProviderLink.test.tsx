import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LinkResult } from '../../data/firebase';

/** A Firebase user, by way of the app's own module: test files are held to not importing the SDK. */
type User = LinkResult['user'];

/**
 * A guest who creates an account is told so without reloading.
 *
 * "Create account" links the new sign-in to the guest's session, keeping the
 * uid — and for that reason Firebase's `onAuthStateChanged` does not fire.
 * The provider listened to nothing else, so the account was made and every
 * screen went on saying "this device only, until you create an account".
 *
 * The stand-in for Firebase here does what Firebase does: the listener is
 * called once, with the guest, and NEVER AGAIN. Whatever the screens learn
 * after that, they learn from the provider.
 */

const firebase = vi.hoisted(() => ({
  listener: null as ((user: unknown) => void) | null,
  listenerCalls: 0,
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  linkAnonymousAccount: vi.fn(),
  touchUserProfile: vi.fn(async () => {}),
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
  linkAnonymousAccount: firebase.linkAnonymousAccount,
  signOutUser: vi.fn(async () => {}),
}));
// Confirming an email address has its own file (authProviderConfirm.test.tsx).
vi.mock('../../data/emailConfirmation', () => ({
  confirmedForRules: vi.fn(async (user: { emailVerified?: boolean }) => user.emailVerified === true),
  sendConfirmationEmail: vi.fn(async () => ({ uid: 'guest-1', email: 'sam@example.com' })),
}));

vi.stubEnv('VITE_PERSISTENCE', 'firestore');

const { AuthProvider, useAuth } = await import('../AuthProvider');
const { NavSidebar } = await import('../../components/shell/NavSidebar');
const { MobileAccountButton } = await import('../../components/mobile/MobileAccountButton');

const guest = { uid: 'guest-1', isAnonymous: true, email: null, displayName: null } as unknown as User;
/** The same Firebase user after a link: the uid kept, no longer anonymous. */
const linked = { uid: 'guest-1', isAnonymous: false, email: 'sam@example.com', displayName: null } as unknown as User;

/** The sentence both Account screens print under their heading (Account.tsx, MobileAccount.tsx). */
function AccountLine() {
  const { user } = useAuth();
  return (
    <p data-testid="account-line">
      {user?.displayName ?? user?.email ?? 'Signed in'}
      {user?.isAnonymous && ' — this device only, until you create an account.'}
    </p>
  );
}

function Actions() {
  const { signInWithEmail, signInWithGoogle, linkAnonymousAccount } = useAuth();
  return (
    <>
      <button type="button" onClick={() => void signInWithEmail('other@example.com', 'password123')}>test: sign in</button>
      <button type="button" onClick={() => void signInWithGoogle()}>test: google</button>
      <button type="button" onClick={() => void linkAnonymousAccount({ provider: 'google' })}>test: link</button>
    </>
  );
}

async function openAsGuest() {
  render(
    <MemoryRouter>
      <AuthProvider>
        {/* Desktop: the sidebar offers "Create account" and opens the real form. */}
        <NavSidebar active="account" onNavigate={() => {}} />
        {/* Mobile: the header nudge shown only to a device-only account. */}
        <MobileAccountButton />
        <AccountLine />
        <Actions />
      </AuthProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(firebase.listener).toBeTruthy());
  act(() => firebase.listener!(guest));
  await waitFor(() => expect(screen.getByTestId('account-line').textContent).toMatch(/this device only/));
}

beforeEach(() => {
  firebase.listenerCalls = 0;
  firebase.listener = null;
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('a guest creates an account', () => {
  it('stops being called a guest at once, on the desktop screens and the mobile ones, with no reload', async () => {
    firebase.signUpWithEmail.mockResolvedValue({ user: linked, recoveredExistingAccount: false });
    await openAsGuest();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });
    const form = screen.getByLabelText('Email').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByTestId('account-line').textContent).toBe('sam@example.com'));
    // Desktop sidebar: the name and Sign out, no longer the offer.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    // Mobile header: the nudge for a device-only account is gone.
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();

    // And Firebase said nothing: the listener was called once, with the guest.
    expect(firebase.listenerCalls).toBe(1);
    expect(firebase.signUpWithEmail).toHaveBeenCalledWith('sam@example.com', 'password123');
  });

  it('records the account on the profile, as a reload would have', async () => {
    firebase.signUpWithEmail.mockResolvedValue({ user: linked, recoveredExistingAccount: false });
    await openAsGuest();
    firebase.touchUserProfile.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);

    await waitFor(() => expect(firebase.touchUserProfile).toHaveBeenCalledTimes(1));
    expect(firebase.touchUserProfile).toHaveBeenCalledWith(linked);
  });

  it('is told the same way when the account is made with Google', async () => {
    const google = { ...linked, email: 'sam@gmail.com', displayName: 'Sam Okoro' } as unknown as User;
    firebase.signInWithGoogle.mockResolvedValue({ user: google, recoveredExistingAccount: false });
    await openAsGuest();

    fireEvent.click(screen.getByRole('button', { name: 'test: google' }));
    await waitFor(() => expect(screen.getByTestId('account-line').textContent).toBe('Sam Okoro'));
    expect(firebase.listenerCalls).toBe(1);
  });

  it('is told the same way through the link action', async () => {
    firebase.linkAnonymousAccount.mockResolvedValue({ user: linked, recoveredExistingAccount: false });
    await openAsGuest();

    fireEvent.click(screen.getByRole('button', { name: 'test: link' }));
    await waitFor(() => expect(screen.getByTestId('account-line').textContent).toBe('sam@example.com'));
  });
});

describe('what the provider leaves to Firebase', () => {
  // Signing in to an account that already exists is a change of uid, which
  // the listener does report. Taking it from the action as well would write
  // the profile twice and could show the new account before its data.
  it('does not take up a different account from an action: that arrives by the listener', async () => {
    const other = { uid: 'other-9', isAnonymous: false, email: 'other@example.com', displayName: null } as unknown as User;
    firebase.signInWithEmail.mockResolvedValue({ user: other, recoveredExistingAccount: false });
    await openAsGuest();
    firebase.touchUserProfile.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'test: sign in' }));
    await waitFor(() => expect(firebase.signInWithEmail).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('account-line').textContent).toMatch(/this device only/);
    expect(firebase.touchUserProfile).not.toHaveBeenCalled();

    act(() => firebase.listener!(other));
    await waitFor(() => expect(screen.getByTestId('account-line').textContent).toBe('other@example.com'));
    expect(firebase.touchUserProfile).toHaveBeenCalledTimes(1);
  });

  it('does nothing when an action ends with the account exactly as it was', async () => {
    firebase.linkAnonymousAccount.mockResolvedValue({ user: guest, recoveredExistingAccount: false });
    await openAsGuest();
    firebase.touchUserProfile.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'test: link' }));
    await waitFor(() => expect(firebase.linkAnonymousAccount).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(firebase.touchUserProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId('account-line').textContent).toMatch(/this device only/);
  });
});
