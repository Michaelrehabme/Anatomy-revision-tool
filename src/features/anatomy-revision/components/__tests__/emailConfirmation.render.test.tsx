import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmailConfirmPanel from '../Auth/EmailConfirmPanel';
import EmailConfirmGate from '../Auth/EmailConfirmGate';
import { Onboarding } from '../Onboarding/Onboarding';
import { MobileOnboarding } from '../mobile/MobileOnboarding';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';
import { FREE_ENTITLEMENT, type Entitlement, type FreeAreaChoice } from '../../lib/entitlement';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { RESEND_WAIT_MS, recordConfirmationSent } from '../../lib/emailVerification';
import type { Area } from '../../types/region';

/**
 * "Check your inbox": the step where an account confirms its email address
 * before its free area (owner's decision, 7 Oct 2026).
 *
 * What is held here is the WORDS, the ORDER and what a keyboard or screen
 * reader user is told: which address the link went to, what to do if it does
 * not arrive, that the three ways out all work, and that nobody with full
 * access — and nobody who was here before the rule — is ever shown it. The
 * rule itself is in hooks/useEntitlement (the app), firestore.rules (the
 * database) and netlify/functions/content-area (the facts).
 */

const auth = vi.hoisted(() => ({
  user: { uid: 'u1', isAnonymous: false, email: 'sam@example.com', displayName: null, emailVerified: false } as {
    uid: string; isAnonymous: boolean; email: string | null; displayName: string | null; emailVerified: boolean;
  },
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  checkEmailConfirmed: vi.fn(),
  removeUnconfirmedEmail: vi.fn(),
}));

vi.mock('../../context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ loading: false, signOut: vi.fn(), ...auth }),
}));
vi.mock('../../hooks/useRepository', () => ({ useRepository: () => ({ repository: null }) }));

const content = anatomyContentFrom([], []);
const chosen = (area: Area): FreeAreaChoice => ({ area, chosenAt: '2026-08-20T08:00:00.000Z', switches: 0 });

function access(over: Partial<UseEntitlement> = {}): UseEntitlement {
  return {
    entitlement: FREE_ENTITLEMENT,
    tier: 'free',
    loading: false,
    known: true,
    canAccess: () => false,
    locked: (all) => [...all],
    areas: [],
    freeArea: null,
    chooseFreeArea: () => {},
    canSwitchFree: true,
    daysUntilSwitch: 0,
    switchUsed: false,
    refresh: () => {},
    ...over,
  };
}
const PAID: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2099-01-01T00:00:00.000Z' };

const CONTINUE = 'I’ve confirmed — continue';

/** As the sign-up leaves things: the email has gone, a moment ago. */
const emailWasSent = (at = Date.now()) => recordConfirmationSent('u1', 'sam@example.com', at);

beforeEach(() => {
  vi.stubEnv('VITE_PERSISTENCE', 'firestore');
  localStorage.clear();
  vi.clearAllMocks();
  auth.user = { uid: 'u1', isAnonymous: false, email: 'sam@example.com', displayName: null, emailVerified: false };
  auth.sendConfirmationEmail.mockResolvedValue(undefined);
  auth.checkEmailConfirmed.mockResolvedValue(false);
  auth.removeUnconfirmedEmail.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('the panel, for a new account', () => {
  const open = () => render(<EmailConfirmPanel purpose="free-area" />);

  it('says which address the link went to, and what to do with it', () => {
    emailWasSent();
    open();
    expect(screen.getByTestId('email-confirm-lead').textContent).toBe(
      'We sent a link to sam@example.com. Open it to confirm your email address, then come back here.',
    );
    // The sign-up sent it: the panel does not send a second one by opening.
    expect(auth.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it('says what to do if it does not arrive: spam, resend, a different address', () => {
    emailWasSent();
    open();
    expect(screen.getByText('If it does not arrive, check your spam or junk folder, resend it, or use a different address.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resend the email' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use a different email' })).toBeTruthy();
    // The main button is described by that help, for a screen reader.
    const main = screen.getByRole('button', { name: CONTINUE });
    expect(document.getElementById(main.getAttribute('aria-describedby')!)?.textContent).toMatch(/check your spam or junk folder/);
  });

  it('never blames: nothing is called wrong, invalid, failed or unverified', () => {
    emailWasSent();
    open();
    expect(document.body.textContent).not.toMatch(/invalid|failed|wrong|unverified|must|error|locked/i);
  });

  // An account made on another device, or whose sign-up could not send: the
  // email goes as the panel opens, once.
  it('sends the email itself when none has gone to this address from this device', async () => {
    open();
    await waitFor(() => expect(auth.sendConfirmationEmail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sent to sam@example.com. It can take a minute or two to arrive.'));
  });

  it('says so honestly when the email could not be sent, and offers to send it', async () => {
    auth.sendConfirmationEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    open();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'We could not send the email. You seem to be offline. Connect and try again. Nothing on this device has been lost.',
      ),
    );
    expect(screen.getByTestId('email-confirm-lead').textContent).toBe('We have not been able to send the link to sam@example.com yet.');
    expect(screen.getByRole('button', { name: 'Send the email' })).toBeTruthy();
  });

  describe('"I\'ve confirmed — continue"', () => {
    it('asks, and says plainly when the address is not confirmed yet', async () => {
      emailWasSent();
      open();
      fireEvent.click(screen.getByRole('button', { name: CONTINUE }));
      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe(
          'That address is not confirmed yet. Open the link in the email we sent to sam@example.com, then try again.',
        ),
      );
      expect(auth.checkEmailConfirmed).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toBe('');
    });

    it('says nothing more once it is confirmed: the app is moving on', async () => {
      emailWasSent();
      auth.checkEmailConfirmed.mockResolvedValue(true);
      open();
      fireEvent.click(screen.getByRole('button', { name: CONTINUE }));
      await waitFor(() => expect(auth.checkEmailConfirmed).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('status').textContent).toBe('');
      expect(screen.getByRole('alert').textContent).toBe('');
    });

    it('says it could not check when offline, as an alert, and that nothing is lost', async () => {
      emailWasSent();
      auth.checkEmailConfirmed.mockRejectedValue({ code: 'auth/network-request-failed' });
      open();
      fireEvent.click(screen.getByRole('button', { name: CONTINUE }));
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(
          'We could not check. You seem to be offline. Connect and try again. Nothing on this device has been lost.',
        ),
      );
    });
  });

  describe('noticing by itself', () => {
    it('asks quietly when the tab is come back to, and says nothing if the answer is still no', async () => {
      emailWasSent();
      open();
      act(() => { window.dispatchEvent(new Event('focus')); });
      await waitFor(() => expect(auth.checkEmailConfirmed).toHaveBeenCalledTimes(1));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('status').textContent).toBe('');
      expect(screen.getByRole('alert').textContent).toBe('');
    });

    it('does not ask again and again: focus and visibility arriving together are one question', async () => {
      emailWasSent();
      open();
      act(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      });
      await act(async () => { await Promise.resolve(); });
      expect(auth.checkEmailConfirmed).toHaveBeenCalledTimes(1);
    });

    it('stays quiet when the quiet question cannot be asked', async () => {
      emailWasSent();
      auth.checkEmailConfirmed.mockRejectedValue({ code: 'auth/network-request-failed' });
      open();
      act(() => { window.dispatchEvent(new Event('focus')); });
      await waitFor(() => expect(auth.checkEmailConfirmed).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('alert').textContent).toBe('');
    });
  });

  describe('resending', () => {
    it('sends again and says where to, once a minute has passed', async () => {
      emailWasSent(Date.now() - RESEND_WAIT_MS - 1);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Resend the email' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sent again to sam@example.com. It can take a minute or two to arrive.'));
      expect(auth.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    });

    // The wait is said, not hidden behind a button that has gone grey.
    it('inside the minute: sends nothing and says why', async () => {
      emailWasSent();
      open();
      const resend = screen.getByRole('button', { name: 'Resend the email' }) as HTMLButtonElement;
      expect(resend.disabled).toBe(false);
      fireEvent.click(resend);
      expect(screen.getByRole('status').textContent).toBe('We sent one less than a minute ago. Give it a moment to arrive, then try again.');
      expect(auth.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    // Firebase has a limit of its own, which it does not publish.
    it("is honest about Firebase's own limit, and that the last link still works", async () => {
      emailWasSent(Date.now() - RESEND_WAIT_MS - 1);
      auth.sendConfirmationEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Resend the email' }));
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(
          'Too many emails have been sent to this address for now. Wait a few minutes, then try again. The last link we sent still works.',
        ),
      );
    });
  });

  describe('"Use a different email"', () => {
    it('takes the address off and tells whoever is showing the panel', async () => {
      emailWasSent();
      const onDifferentEmail = vi.fn();
      render(<EmailConfirmPanel purpose="free-area" onDifferentEmail={onDifferentEmail} />);
      fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
      await waitFor(() => expect(onDifferentEmail).toHaveBeenCalledTimes(1));
      expect(auth.removeUnconfirmedEmail).toHaveBeenCalledTimes(1);
    });

    it('says so, and leaves the account as it is, when that cannot be done', async () => {
      emailWasSent();
      auth.removeUnconfirmedEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
      const onDifferentEmail = vi.fn();
      render(<EmailConfirmPanel purpose="free-area" onDifferentEmail={onDifferentEmail} />);
      fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/^We could not change the address\. You seem to be offline\./));
      expect(onDifferentEmail).not.toHaveBeenCalled();
      expect((screen.getByRole('button', { name: CONTINUE }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('offline', () => {
    it('says before anything is pressed that confirming needs a connection, and that nothing is lost', () => {
      emailWasSent();
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      try {
        open();
        expect(screen.getByText(/You are offline\. Confirming your email address needs a connection\. Everything you have done is still on\s+this device\./)).toBeTruthy();
      } finally {
        onLine.mockRestore();
      }
    });

    it('drops that line, and asks quietly, when the connection comes back', async () => {
      emailWasSent();
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      try {
        open();
        onLine.mockReturnValue(true);
        act(() => { window.dispatchEvent(new Event('online')); });
        await waitFor(() => expect(screen.queryByText(/You are offline/)).toBeNull());
        expect(auth.checkEmailConfirmed).toHaveBeenCalledTimes(1);
      } finally {
        onLine.mockRestore();
      }
    });
  });

  it('can be worked from the keyboard: three buttons, in order, all real buttons', () => {
    emailWasSent();
    open();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([CONTINUE, 'Resend the email', 'Use a different email']);
    for (const b of buttons) expect(b.tagName).toBe('BUTTON');
  });
});

describe('the screen that stands in for revision', () => {
  const open = (props: Partial<Parameters<typeof EmailConfirmGate>[0]> = {}) =>
    render(
      <MemoryRouter>
        <EmailConfirmGate isDesktop active="today" onNavigate={() => {}} onNavigateTab={() => {}} freeArea="knee" {...props} />
      </MemoryRouter>,
    );

  it('says what to do, and what they keep', () => {
    emailWasSent();
    open();
    expect(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeTruthy();
    expect(screen.getByText(/Your free area needs a confirmed email address\. It takes a minute, and nothing you have done is lost\./)).toBeTruthy();
    expect(screen.getByText(/Your free area is Knee, and your progress is waiting for you\./)).toBeTruthy();
    expect(screen.getByTestId('email-confirm-lead').textContent).toMatch(/^We sent a link to sam@example\.com\./);
  });

  it('moves focus to the heading for someone who pressed something to get here', () => {
    emailWasSent();
    fireEvent.pointerDown(document.body);
    open();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('keeps the navigation and the way to the prices, and says nothing of an area never chosen', () => {
    emailWasSent();
    open({ freeArea: null });
    expect(screen.getByRole('link', { name: 'see the plans' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Your free area is/);
  });

  it('is the same screen on a phone', () => {
    emailWasSent();
    open({ isDesktop: false });
    expect(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeTruthy();
    expect(screen.getByRole('button', { name: CONTINUE })).toBeTruthy();
  });
});

describe.each([
  ['desktop', Onboarding],
  ['phone', MobileOnboarding],
] as const)('onboarding on a %s', (_name, Screen) => {
  const open = (over: Partial<UseEntitlement>, only?: ('areas')[]) =>
    render(
      <MemoryRouter>
        <Screen content={content} access={access(over)} only={only} onDone={vi.fn()} />
      </MemoryRouter>,
    );

  it('shows "Check your inbox" as the second half of step one, and no way past it', async () => {
    emailWasSent();
    // A new visitor: a guest as the screen opens, an unconfirmed account a moment later.
    const { rerender } = render(
      <MemoryRouter>
        <Screen content={content} access={access({ guest: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Create your free account' })).toBeTruthy();
    rerender(
      <MemoryRouter>
        <Screen content={content} access={access({ needsEmailConfirmation: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeTruthy();
    expect(screen.getByText('Step one of four')).toBeTruthy();
    expect(await screen.findByRole('button', { name: CONTINUE })).toBeTruthy();
    // No Continue to the next step, no Skip, no area to tick.
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Choose an area$|^Continue$/ })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('puts focus on the new heading when the step changes to it', async () => {
    emailWasSent();
    const { rerender } = render(
      <MemoryRouter>
        <Screen content={content} access={access({ guest: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <Screen content={content} access={access({ needsEmailConfirmation: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })));
  });

  // Somebody who reloads the page half way: an account now, not a guest, so
  // onboarding opens on the choice of area — which they may not make yet.
  it('stands in front of the choice of area for an account that reloaded before confirming', async () => {
    emailWasSent();
    open({ needsEmailConfirmation: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeTruthy();
    expect(screen.queryByText('Pick your free area')).toBeNull();
    expect(await screen.findByRole('button', { name: CONTINUE })).toBeTruthy();
  });

  it('gives way to the choice of area the moment the address is confirmed', async () => {
    emailWasSent();
    const { rerender } = open({ needsEmailConfirmation: true });
    await screen.findByRole('button', { name: CONTINUE });
    rerender(
      <MemoryRouter>
        <Screen content={content} access={access({ needsFreeArea: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Pick your free area' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: CONTINUE })).toBeNull();
  });

  it('"Use a different email" brings the sign-up form back', async () => {
    emailWasSent();
    const { rerender } = open({ needsEmailConfirmation: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));
    await waitFor(() => expect(auth.removeUnconfirmedEmail).toHaveBeenCalled());
    // The provider now reports a guest with the same uid.
    rerender(
      <MemoryRouter>
        <Screen content={content} access={access({ guest: true })} onDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: CONTINUE })).toBeNull();
    // …under the account step's own heading, not "Pick your free area": this
    // onboarding was opened by an account, so it has no account step to go back to.
    expect(screen.getByRole('heading', { level: 1, name: 'Create your free account' })).toBeTruthy();
    expect(screen.queryByText('Pick your free area')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('is never shown to a Google account or to full access: straight to the next thing', () => {
    open({ needsFreeArea: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Pick your free area' })).toBeTruthy();
    cleanup();
    open({ entitlement: PAID, tier: 'individual', areas: ['knee', 'hip'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Which areas are you learning?' })).toBeTruthy();
    expect(screen.queryByText('Check your inbox')).toBeNull();
  });
});

describe('the account screen', () => {
  const summary = (over: Partial<UseEntitlement>) =>
    render(
      <MemoryRouter>
        <SubscriptionSummary access={access(over)} />
      </MemoryRouter>,
    );

  it('a new unconfirmed account is told what its free area is waiting for, and is not offered a picker', async () => {
    emailWasSent();
    summary({ needsEmailConfirmation: true, switchNeedsConfirmation: true });
    expect(screen.getByTestId('subscription-status').textContent).toBe('Free: confirm your email address to open your free area.');
    expect(document.body.textContent).not.toMatch(/shoulder only/i);
    expect(screen.queryByLabelText('Your free area')).toBeNull();
    expect(await screen.findByRole('button', { name: CONTINUE })).toBeTruthy();
  });

  it('an account from before the rule keeps its area, and is asked to confirm only to change it', async () => {
    summary({ freeArea: chosen('knee'), areas: ['knee'], canSwitchFree: false, switchNeedsConfirmation: true });
    expect(screen.getByTestId('subscription-status').textContent).toBe('Free: knee only.');
    const picker = screen.getByLabelText('Your free area') as HTMLSelectElement;
    expect(picker.value).toBe('knee');
    expect(picker.disabled).toBe(true);
    expect(screen.getByText(/This is your free area, and it stays yours\. To change it — once, 30 days after you picked it — confirm your email address first\./)).toBeTruthy();
    // Nothing is sent until they ask, and their sign-in is never offered up.
    expect(await screen.findByRole('button', { name: 'Send me the link' })).toBeTruthy();
    expect(screen.getByTestId('email-confirm-lead').textContent).toMatch(/^We will send a link to sam@example\.com\./);
    expect(auth.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use a different email' })).toBeNull();
  });

  it('…and once they ask, is sent the link and offered the same check and resend', async () => {
    summary({ freeArea: chosen('knee'), areas: ['knee'], canSwitchFree: false, switchNeedsConfirmation: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Send me the link' }));
    await waitFor(() => expect(auth.sendConfirmationEmail).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: CONTINUE })).toBeTruthy();
    expect(screen.getByText('If it does not arrive, check your spam or junk folder, or resend it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use a different email' })).toBeNull();
  });

  it('says nothing about confirming once the one change has been used', () => {
    summary({ freeArea: { ...chosen('knee'), switches: 1 }, areas: ['knee'], canSwitchFree: false, switchUsed: true, switchNeedsConfirmation: true });
    expect(document.body.textContent).not.toMatch(/confirm your email/i);
  });

  // Confirmation gates the free area and nothing else.
  it('says nothing about confirming to an account with full access, confirmed or not', () => {
    summary({ entitlement: PAID, tier: 'individual', needsEmailConfirmation: false, switchNeedsConfirmation: false });
    expect(screen.getByTestId('subscription-status').textContent).toMatch(/^Full access until/);
    expect(document.body.textContent).not.toMatch(/confirm/i);
    expect(screen.queryByTestId('email-confirm-panel')).toBeNull();
  });

  it('is unchanged for a confirmed free account', () => {
    summary({ freeArea: chosen('knee'), areas: ['knee'], canSwitchFree: true });
    expect((screen.getByLabelText('Your free area') as HTMLSelectElement).disabled).toBe(false);
    expect(document.body.textContent).not.toMatch(/confirm/i);
  });
});
