import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { effectiveTier, type Entitlement } from '../../anatomy-revision/lib/entitlement';
import { clearPendingCode, readPendingCode, savePendingCode } from '../lib/codeOffer';

/**
 * /pricing?code=… — a student claiming the home page's code.
 *
 * The page opens on the code, not the plans; the account step is the one
 * thing asked of them; and the code is kept across the trip to confirm an
 * email, then sent by itself once the account is confirmed.
 */

const state = vi.hoisted(() => ({
  entitlement: { tier: 'free' } as unknown,
  user: null as unknown,
  fetch: vi.fn(),
}));

vi.mock('../../anatomy-revision/context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ user: state.user }),
}));

vi.mock('../../anatomy-revision/hooks/useEntitlement', () => ({
  useEntitlement: () => {
    const entitlement = state.entitlement as Entitlement;
    return { entitlement, tier: effectiveTier(entitlement), loading: false, refresh: () => {} };
  },
  refreshEntitlementEverywhere: () => {},
}));

vi.mock('../../anatomy-revision/data/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }),
}));

vi.mock('../../anatomy-revision/components/Auth/EmailConfirmPanel', () => ({
  default: () => <div data-testid="email-confirm-panel" />,
}));

import { PricingPage } from '../PricingPage';

beforeEach(() => {
  state.entitlement = { tier: 'free' };
  state.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, accessUntil: '2027-01-01T00:00:00.000Z' }), { status: 200 }));
  vi.stubGlobal('fetch', state.fetch);
});

afterEach(() => {
  cleanup();
  clearPendingCode();
  vi.unstubAllGlobals();
});

function show(path: string) {
  render(<MemoryRouter initialEntries={[path]}><PricingPage onQuickStart={() => {}} onCustomSession={() => {}} /></MemoryRouter>);
}

describe('/pricing with a code', () => {
  it('opens on the code and the account step, with the plans below and no second code box', () => {
    state.user = { uid: 'g1', isAnonymous: true, emailVerified: false };
    show('/pricing?code=LocusMSK27');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Every region, free until 1 January 2027');
    expect(screen.getByRole('button', { name: 'Create my account' })).toBeTruthy();
    expect(screen.getByText('Prefer to pay?')).toBeTruthy();
    expect(screen.queryByLabelText('Have an access or discount code?')).toBeNull();
    expect(readPendingCode()).toBe('LocusMSK27');
  });

  it('waits on the inbox step for an unconfirmed account, sending nothing', async () => {
    state.user = { uid: 'u1', isAnonymous: false, emailVerified: false };
    savePendingCode('LocusMSK27');
    show('/pricing');
    expect(screen.getByText('Check your inbox')).toBeTruthy();
    expect(await screen.findByTestId('email-confirm-panel')).toBeTruthy();
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it('sends the kept code by itself once the account is confirmed, and forgets it', async () => {
    state.user = { uid: 'u1', isAnonymous: false, emailVerified: true };
    savePendingCode('LocusMSK27');
    show('/pricing');
    await waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toEqual({ code: 'LocusMSK27' });
    await waitFor(() => expect(readPendingCode()).toBeNull());
  });

  it('offers a code-holder the two ways to start', () => {
    state.user = { uid: 'u1', isAnonymous: false, emailVerified: true };
    state.entitlement = { tier: 'individual', source: 'complimentary', expiresAt: '2099-01-01T00:00:00.000Z', accessCode: 'LOCUSMSK27' };
    show('/pricing');
    expect(screen.getByRole('button', { name: 'Start 10 questions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Build a session' })).toBeTruthy();
  });

  it('is the plain pricing page without a code', () => {
    state.user = { uid: 'u1', isAnonymous: false, emailVerified: true };
    show('/pricing');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Unlock every region');
    expect(screen.getByLabelText('Have an access or discount code?')).toBeTruthy();
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
