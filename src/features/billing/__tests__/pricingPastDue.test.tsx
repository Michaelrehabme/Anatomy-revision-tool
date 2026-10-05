import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { effectiveTier, type Entitlement } from '../../anatomy-revision/lib/entitlement';

/**
 * /pricing for somebody whose renewal failed.
 *
 * Once a failed renewal stopped granting the unpaid period, this student read
 * as free — and the pricing page offers a free student the plans. Buying one
 * would start a second subscription while Paddle was still retrying the card
 * on the first, and they would be charged for both when it worked. So the
 * plans are withheld and the notice shown instead.
 */

const state = vi.hoisted(() => ({ entitlement: null as unknown }));

vi.mock('../../anatomy-revision/context/AuthProvider', () => ({
  AUTH_ENABLED: true,
  useAuth: () => ({ user: { uid: 'u1', isAnonymous: false } }),
}));

vi.mock('../../anatomy-revision/hooks/useEntitlement', () => ({
  useEntitlement: () => {
    const entitlement = state.entitlement as Entitlement;
    return { entitlement, tier: effectiveTier(entitlement), loading: false, refresh: () => {} };
  },
}));

vi.mock('../../anatomy-revision/data/firebase', () => ({ getFirebaseAuth: () => ({ currentUser: null }) }));

import { PricingPage } from '../PricingPage';

afterEach(cleanup);

const lapsed: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2026-05-12T10:18:47.635Z', externalId: 'sub_1' };

function show(entitlement: Entitlement) {
  state.entitlement = entitlement;
  render(<MemoryRouter initialEntries={['/pricing']}><PricingPage /></MemoryRouter>);
}

describe('/pricing', () => {
  it('does not offer the plans to somebody whose payment failed, and sends them to their card', () => {
    show({ ...lapsed, paymentIssueSince: '2026-05-12T10:19:26.014Z' });
    expect(screen.getByRole('status').textContent).toMatch(/^Your last payment did not go through/);
    expect(screen.getByRole('button', { name: 'Update your card' })).toBeTruthy();
    expect(screen.getByText(/You do not need to subscribe again/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Plan' })).toBeNull();
  });

  it('still offers them to somebody whose subscription simply ended', () => {
    show(lapsed);
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
