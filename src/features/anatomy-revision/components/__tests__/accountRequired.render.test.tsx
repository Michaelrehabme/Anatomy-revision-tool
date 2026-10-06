import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountGate from '../Auth/AccountGate';
import { GuestAccountPanel } from '../Auth/GuestAccountPanel';
import { Onboarding } from '../Onboarding/Onboarding';
import { MobileOnboarding } from '../mobile/MobileOnboarding';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { anatomyContentFrom } from '../../hooks/useAnatomyContent';
import { FREE_ENTITLEMENT, type Entitlement, type FreeAreaChoice } from '../../lib/entitlement';
import type { UseEntitlement } from '../../hooks/useEntitlement';
import { AREAS, type Area } from '../../types/region';

/**
 * The free area, a card's facts and every session need a real account
 * (owner's decision, 6 Oct 2026). These are the three places that is said:
 * the first step of onboarding for a new visitor, the screen an existing
 * guest meets in place of revision, and the account screen's guest block.
 *
 * What is held here is the WORDS and the ORDER — that nobody is walked past
 * the account step, and that a guest with weeks of progress is told what they
 * keep before they are told what to do. The rule itself is in
 * hooks/useEntitlement (the app), firestore.rules (the database) and
 * netlify/functions/content-area (the facts).
 */

const auth = vi.hoisted(() => ({
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ user: { uid: 'g1', isAnonymous: true, email: null, displayName: null }, loading: false, signOut: vi.fn(), ...auth }),
}));
vi.mock('../../hooks/useRepository', () => ({ useRepository: () => ({ repository: null }) }));

const content = anatomyContentFrom([], []);
const chosen = (area: Area): FreeAreaChoice => ({ area, chosenAt: '2026-09-20T08:00:00.000Z', switches: 0 });

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
const guest = (over: Partial<UseEntitlement> = {}) => access({ guest: true, ...over });
const PAID: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2099-01-01T00:00:00.000Z' };

function fillAndSubmit() {
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

beforeEach(() => {
  vi.stubEnv('VITE_PERSISTENCE', 'firestore');
  vi.clearAllMocks();
  auth.signUpWithEmail.mockResolvedValue({ recoveredExistingAccount: false });
  auth.signInWithEmail.mockResolvedValue({ recoveredExistingAccount: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('what an existing guest meets in place of revision', () => {
  const open = (props: Partial<Parameters<typeof AccountGate>[0]> = {}) =>
    render(
      <MemoryRouter>
        <AccountGate isDesktop active="today" onNavigate={() => {}} onNavigateTab={() => {}} freeArea="knee" {...props} />
      </MemoryRouter>,
    );

  it('says what to do, and first of all what they keep', () => {
    open();
    const heading = screen.getByRole('heading', { level: 1, name: 'Create a free account to keep going' });
    expect(heading).toBeTruthy();
    expect(screen.getByText(/Your progress and your free area come with you\./)).toBeTruthy();
    expect(screen.getByText(/Your free area is Knee\./)).toBeTruthy();
    // Not alarming: nothing is called locked, expired, lost or blocked.
    expect(document.body.textContent).not.toMatch(/locked|expired|blocked|lost your|no longer/i);
  });

  // Somebody who pressed something to get here (a link in the navigation,
  // "Start learning") has lost the button they pressed.
  it('moves focus to the heading for someone who pressed something to get here', () => {
    fireEvent.pointerDown(document.body);
    open();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('has the form in the page, with labelled fields and the age and terms tick', () => {
    open();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText(/^Password/)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /I am 16 or over/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    // Nothing can be submitted until the box is ticked, and it says why.
    expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Tick the box above to continue.')).toBeTruthy();
    // There is no way to dismiss it: it is the page, not an overlay.
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('creates the account from the guest they already are', async () => {
    open();
    fillAndSubmit();
    await waitFor(() => expect(auth.signUpWithEmail).toHaveBeenCalledWith('sam@example.com', 'password123'));
  });

  it('warns before they sign in to another account that their guest progress stays behind', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(screen.getByText(/What you have done on this device as a guest stays behind/)).toBeTruthy();
  });

  it('announces a failure, and says so plainly when the device is offline', async () => {
    auth.signUpWithEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    open();
    fillAndSubmit();
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toMatch(/You seem to be offline.*nothing on this device has been lost/));
  });

  it('says before they type that an account cannot be made offline, and that nothing is lost', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    open();
    expect(screen.getByText(/You are offline\. Creating an account needs a connection\./)).toBeTruthy();
    expect(screen.getByText(/Everything you have done is still on this device/)).toBeTruthy();
    online.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByText(/You are offline/)).toBeNull();
  });

  it('keeps the navigation, and the way to the prices', () => {
    open();
    expect(screen.getByRole('link', { name: 'see the plans' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
    // One "Create account" on the page: the form's. The sidebar's own offer is left out here.
    expect(screen.getAllByRole('button', { name: 'Create account' })).toHaveLength(1);
  });

  it('says nothing about a free area a guest never chose', () => {
    open({ freeArea: null });
    expect(screen.queryByText(/Your free area is/)).toBeNull();
  });

  it('is the same screen on a phone', () => {
    open({ isDesktop: false });
    expect(screen.getByRole('heading', { level: 1, name: 'Create a free account to keep going' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });
});

describe.each([
  ['desktop', Onboarding],
  ['mobile', MobileOnboarding],
] as const)('onboarding for a new visitor (%s)', (_name, Screen) => {
  it('starts with the account, as step one of four', () => {
    render(<MemoryRouter><Screen access={guest()} content={content} onDone={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Step one of four')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Create your free account' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    // No way past it: no Continue, no Skip.
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('goes on to the free area once the account exists and is known to have none', async () => {
    const onDone = vi.fn();
    const view = render(<MemoryRouter><Screen access={guest()} content={content} onDone={onDone} /></MemoryRouter>);
    fillAndSubmit();
    expect(await screen.findByText('Setting up your account…')).toBeTruthy();

    // The app now sees the same user as an account; its entitlement is being read…
    view.rerender(<MemoryRouter><Screen access={access({ loading: true })} content={content} onDone={onDone} /></MemoryRouter>);
    expect(screen.getByText('Setting up your account…')).toBeTruthy();
    // …and it has no free area and no subscription: a new student.
    view.rerender(<MemoryRouter><Screen access={access({ needsFreeArea: true })} content={content} onDone={onDone} /></MemoryRouter>);

    expect(await screen.findByRole('heading', { level: 1, name: 'Pick your free area' })).toBeTruthy();
    expect(screen.getByText('Step two of four')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('lets someone who signed in to an account that is already set up straight in', async () => {
    const onDone = vi.fn();
    const view = render(<MemoryRouter><Screen access={guest()} content={content} onDone={onDone} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Setting up your account…');

    view.rerender(
      <MemoryRouter><Screen access={access({ freeArea: chosen('hip'), areas: ['hip'] })} content={content} onDone={onDone} /></MemoryRouter>,
    );
    // null: nothing to choose, nothing to explain again.
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(null));
  });

  it('lets a returning subscriber straight in too', async () => {
    const onDone = vi.fn();
    const view = render(<MemoryRouter><Screen access={guest()} content={content} onDone={onDone} /></MemoryRouter>);
    fillAndSubmit();
    await screen.findByText('Setting up your account…');
    view.rerender(
      <MemoryRouter><Screen access={access({ entitlement: PAID, tier: 'individual', areas: [...AREAS] })} content={content} onDone={onDone} /></MemoryRouter>,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(null));
  });
});

describe('choosing the free area', () => {
  const free = access({ needsFreeArea: true });

  it('is one choice for a free account, and cannot be skipped: there is no default', () => {
    const onDone = vi.fn();
    render(<MemoryRouter><Onboarding access={free} content={content} onDone={onDone} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Pick your free area' })).toBeTruthy();
    expect(screen.getByText('Step one of three')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/keeps the shoulder/);

    const next = screen.getByRole('button', { name: 'Choose an area' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    const group = screen.getByRole('radiogroup', { name: 'Your free area' });
    expect(group).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Knee/ }));
    expect(screen.getByText('Knee will be your free area.')).toBeTruthy();
    // Picking another replaces it: one free area.
    fireEvent.click(screen.getByRole('radio', { name: /Hip/ }));
    expect(screen.getByText('Hip will be your free area.')).toBeTruthy();
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Understood' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start learning' }));
    expect(onDone).toHaveBeenCalledWith(['hip']);
  });

  it('may skip the explanations once an area is chosen, and keeps the choice', () => {
    const onDone = vi.fn();
    render(<MemoryRouter><Onboarding access={free} content={content} onDone={onDone} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('radio', { name: /Elbow/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledWith(['elbow']);
  });

  // An account that got past onboarding when skipping still gave the shoulder.
  it('can be asked alone, of an account already using the app', () => {
    const onDone = vi.fn();
    render(<MemoryRouter><MobileOnboarding access={free} content={content} only={['areas']} onDone={onDone} /></MemoryRouter>);
    expect(screen.getByText('One thing first')).toBeTruthy();
    expect(screen.queryByText(/^Step /)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Ankle/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith(['ankle-foot']);
  });

  it('is several choices, and skippable, for an account with every area', () => {
    const onDone = vi.fn();
    const paid = access({ entitlement: PAID, tier: 'individual', areas: [...AREAS], canAccess: () => true });
    render(<MemoryRouter><Onboarding access={paid} content={content} onDone={onDone} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Which areas are you learning?' })).toBeTruthy();
    expect(screen.getByText('Skip keeps every area in play.')).toBeTruthy();
    // The list; the figure beside it offers the same areas as a picture.
    const list = within(screen.getByRole('group', { name: 'Areas you are learning' }));
    fireEvent.click(list.getByRole('button', { name: /Knee/ }));
    fireEvent.click(list.getByRole('button', { name: /Hip/ }));
    expect(list.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledWith([]);
  });

  // The demo and a dev server have no accounts: nothing asks for one, and the
  // free area still defaults there, as it always did.
  it('keeps Skip, and the default, in a build with no accounts', () => {
    vi.stubEnv('VITE_PERSISTENCE', 'local');
    const onDone = vi.fn();
    render(<MemoryRouter><Onboarding access={access({ areas: ['shoulder'] })} content={content} onDone={onDone} /></MemoryRouter>);
    expect(screen.getByText('Step one of three')).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByText('Skip keeps the shoulder as your free area.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledWith([]);
  });
});

describe("the account screen's block for a guest", () => {
  it('says the same thing, and offers both ways in', () => {
    const onCreate = vi.fn();
    const onSignIn = vi.fn();
    render(<GuestAccountPanel freeArea="hip" onCreate={onCreate} onSignIn={onSignIn} />);
    expect(screen.getByText(/Create a free account to keep going — your progress and your free area\s+come with you\./)).toBeTruthy();
    expect(screen.getByText(/Your free area is Hip\./)).toBeTruthy();
    expect(screen.getByText(/Revising, joining a class and subscribing all need an account\. It is free\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

describe('an account that has not chosen its free area', () => {
  it('is not told its free area is the shoulder', () => {
    render(<MemoryRouter><SubscriptionSummary access={access({ needsFreeArea: true })} /></MemoryRouter>);
    expect(screen.getByTestId('subscription-status').textContent).toBe('Free: you have not chosen your area yet.');
    const select = screen.getByLabelText('Your free area') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByText(/Pick the one area that stays free\./)).toBeTruthy();
  });

  it('chooses from the account screen', () => {
    const chooseFreeArea = vi.fn();
    render(<MemoryRouter><SubscriptionSummary access={access({ needsFreeArea: true, chooseFreeArea })} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Your free area'), { target: { value: 'knee' } });
    expect(chooseFreeArea).toHaveBeenCalledWith('knee');
  });
});
