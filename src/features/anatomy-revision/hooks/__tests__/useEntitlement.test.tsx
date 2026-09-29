import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { refreshEntitlementEverywhere, useEntitlement } from '../useEntitlement';
import type { Entitlement } from '../../lib/entitlement';

const PAID: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2099-01-01T00:00:00.000Z' } as Entitlement;
const FREE: Entitlement = { tier: 'free', source: null, expiresAt: null };

let next: () => Promise<Entitlement | null> = async () => FREE;
vi.mock('../../data/entitlementRepository', () => ({
  readEntitlement: () => next(),
}));

/**
 * Paywall trace finding 4 (docs/PAYWALL-TRACE-2026-09-29.md): each screen held
 * its own copy of the entitlement, and refreshing the pricing page's copy left
 * every gate in App locked until a reload.
 */
describe('useEntitlement across screens', () => {
  beforeEach(() => {
    next = async () => FREE;
  });

  it('a refresh signalled from another screen unlocks this one', async () => {
    const app = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    expect(app.result.current.tier).toBe('free');

    next = async () => PAID; // the webhook has landed
    act(() => refreshEntitlementEverywhere()); // what the pricing page's refresh() now does
    await waitFor(() => expect(app.result.current.tier).not.toBe('free'));
  });

  it('a failed re-read keeps a paying student paid, and does not flicker loading', async () => {
    next = async () => PAID;
    const app = renderHook(() => useEntitlement('u1'));
    await waitFor(() => expect(app.result.current.tier).not.toBe('free'));

    next = async () => {
      throw new Error('offline');
    };
    act(() => app.result.current.refresh());
    expect(app.result.current.loading).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(app.result.current.tier).not.toBe('free');
  });

  it('a failed first read still resolves to free', async () => {
    next = async () => {
      throw new Error('offline');
    };
    const app = renderHook(() => useEntitlement('u2'));
    await waitFor(() => expect(app.result.current.loading).toBe(false));
    expect(app.result.current.tier).toBe('free');
  });
});
