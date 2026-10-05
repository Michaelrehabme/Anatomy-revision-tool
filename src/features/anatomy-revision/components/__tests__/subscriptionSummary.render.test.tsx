import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import { effectiveTier, type Entitlement } from '../../lib/entitlement';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * The one line on the account screen that says what a student has. It is the
 * same component on the desktop and the phone (Account.tsx, MobileAccount.tsx),
 * so what is pinned here is pinned for both.
 *
 * Each sentence states a rule the webhook enforces
 * (billing/lib/paddleWebhook.ts) and nothing it does not: a date is only ever
 * the stored `expiresAt`, and "renews" is only said of a subscription that
 * has not been cancelled.
 */

const NOW = '2026-10-14T12:00:00.000Z';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function accessWith(entitlement: Entitlement): UseEntitlement {
  return {
    entitlement,
    tier: effectiveTier(entitlement),
    loading: false,
    canAccess: () => true,
    locked: () => [],
    areas: ['knee'],
    freeArea: { area: 'knee', chosenAt: '2026-09-01T12:00:00.000Z', switches: 0 },
    chooseFreeArea: () => {},
    canSwitchFree: false,
    daysUntilSwitch: 0,
    switchUsed: false,
    refresh: () => {},
  };
}

function statusLine(entitlement: Entitlement): string {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  const { container } = render(<MemoryRouter><SubscriptionSummary access={accessWith(entitlement)} /></MemoryRouter>);
  return container.querySelector('[data-testid="subscription-status"]')?.textContent ?? '';
}

const paid: Entitlement = { tier: 'individual', source: 'paddle', expiresAt: '2027-10-01T09:00:00.000Z', externalId: 'sub_1' };

describe('the subscription line on the account screen', () => {
  it('a running subscription', () => {
    expect(statusLine(paid)).toBe('Full access until 1 October 2027, when it renews.');
  });

  it('one that ran out', () => {
    expect(statusLine({ ...paid, expiresAt: '2026-10-01T09:00:00.000Z' })).toBe(
      'Your subscription ended on 1 October 2026. Free: knee only.',
    );
  });

  it('one ended by a refund says so, because access stopped before the date first given', () => {
    expect(statusLine({ ...paid, expiresAt: '2026-10-05T08:54:10.646Z', refundedAt: '2026-10-05T08:54:10.646Z' })).toBe(
      'Your subscription was refunded and ended on 5 October 2026. Free: knee only.',
    );
  });

  it('one bought with a delayed start', () => {
    expect(statusLine({ ...paid, startsAt: '2026-10-15T09:00:00.000Z' })).toBe('Subscribed. Access starts 15 October 2026.');
  });

  it('a free account, and access that never expires', () => {
    expect(statusLine({ tier: 'free', source: null, expiresAt: null })).toBe('Free: knee only.');
    expect(statusLine({ tier: 'individual', source: 'complimentary', expiresAt: null })).toBe('Full access.');
  });
});
