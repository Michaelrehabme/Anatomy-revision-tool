import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * A forgotten password, on the sign-in form (12 October 2026).
 *
 * Until this there was no way back into an email-and-password account whose
 * password was forgotten. What is pinned: the link is asked for with the
 * address already typed, the form says the same thing whether or not that
 * address has an account, and it is offered only where a password is asked
 * for one that already exists.
 */

const auth = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

vi.mock('../../context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ loading: false, user: null, ...auth }),
}));

const { AccountForm, FORGOT_PASSWORD, passwordResetSent } = await import('../Auth/AccountForm');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('forgotten password', () => {
  it('emails a reset link to the address typed, and says so without saying whether it has an account', async () => {
    auth.sendPasswordReset.mockResolvedValue(undefined);
    render(<AccountForm initialMode="sign-in" onDone={() => undefined} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' sam@uni.ac.uk ' } });
    fireEvent.click(screen.getByRole('button', { name: FORGOT_PASSWORD }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(passwordResetSent('sam@uni.ac.uk')));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith('sam@uni.ac.uk');
    expect(passwordResetSent('sam@uni.ac.uk')).toMatch(/^If sam@uni\.ac\.uk has an account/);
  });

  it('asks for the address first when none has been typed', () => {
    render(<AccountForm initialMode="sign-in" onDone={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: FORGOT_PASSWORD }));
    expect(screen.getByRole('alert').textContent).toBe('Enter your email address first.');
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('reports a link that could not be sent', async () => {
    auth.sendPasswordReset.mockRejectedValue({ code: 'auth/network-request-failed' });
    render(<AccountForm initialMode="sign-in" onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@uni.ac.uk' } });
    fireEvent.click(screen.getByRole('button', { name: FORGOT_PASSWORD }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/offline/));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is not offered while creating an account', () => {
    render(<AccountForm initialMode="sign-up" onDone={() => undefined} />);
    expect(screen.queryByRole('button', { name: FORGOT_PASSWORD })).toBeNull();
  });
});
