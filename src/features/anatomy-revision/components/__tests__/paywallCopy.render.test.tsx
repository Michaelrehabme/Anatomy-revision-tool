import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LockedAreaPanel, UnlockNote } from '../shared/AreaLock';
import { SubscriptionSummary } from '../shared/SubscriptionSummary';
import {
  FREE_ENTITLEMENT,
  canSwitchFreeArea,
  daysUntilFreeAreaSwitch,
  hasUsedFreeAreaSwitch,
  type FreeAreaChoice,
} from '../../lib/entitlement';
import type { UseEntitlement } from '../../hooks/useEntitlement';

/**
 * What the paywall SAYS about the one change of free area. The rule itself is
 * tested in lib/entitlement.test.ts; this holds the sentences, because the
 * roadmap's bar is that a refused change comes "with the date it becomes
 * possible" and a countdown alone goes stale the day after it is read.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function access(choice: FreeAreaChoice): UseEntitlement {
  return {
    entitlement: FREE_ENTITLEMENT,
    tier: 'free',
    loading: false,
    canAccess: (area) => area === choice.area,
    locked: (all) => all.filter((a) => a !== choice.area),
    areas: [choice.area],
    freeArea: choice,
    chooseFreeArea: () => {},
    canSwitchFree: canSwitchFreeArea(choice),
    daysUntilSwitch: daysUntilFreeAreaSwitch(choice),
    switchUsed: hasUsedFreeAreaSwitch(choice),
    refresh: () => {},
  };
}

const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
};

describe('the wait before the one change of free area', () => {
  it('is stated as a date as well as a countdown, on a locked card', () => {
    at('2026-10-14T12:00:00.000Z');
    const a = access({ area: 'knee', chosenAt: '2026-10-04T12:00:00.000Z', switches: 0 });
    render(<MemoryRouter><LockedAreaPanel area="shoulder" access={a} onSwitchFree={() => {}} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Changeable from 3 November 2026 (20 days)' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: 'See the plans' }).getAttribute('href')).toBe('/pricing');
  });

  it('is stated as a date under a list of locked areas', () => {
    at('2026-10-14T12:00:00.000Z');
    const a = access({ area: 'knee', chosenAt: '2026-10-04T12:00:00.000Z', switches: 0 });
    const { container } = render(<MemoryRouter><UnlockNote access={a} /></MemoryRouter>);
    expect(container.textContent).toBe(
      'Knee is your free area. Unlock every region — or change your free area from 3 November 2026 (20 days).',
    );
  });

  it('is stated as a date on the account screen', () => {
    at('2026-10-14T12:00:00.000Z');
    const a = access({ area: 'knee', chosenAt: '2026-10-04T12:00:00.000Z', switches: 0 });
    render(<MemoryRouter><SubscriptionSummary access={a} /></MemoryRouter>);
    expect((screen.getByLabelText('Your free area') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/You can change this once, 30 days after you picked it: from 3 November 2026 \(20 days to go\)\./)).toBeTruthy();
  });

  it('offers the change once the 30 days are up', () => {
    at('2026-11-04T12:00:00.000Z');
    const a = access({ area: 'knee', chosenAt: '2026-10-04T12:00:00.000Z', switches: 0 });
    render(<MemoryRouter><LockedAreaPanel area="shoulder" access={a} onSwitchFree={() => {}} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Use my one change: make Shoulder free instead' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('offers no second change, however long they wait, and promises no date', () => {
    at('2027-06-01T12:00:00.000Z');
    const a = access({ area: 'shoulder', chosenAt: '2026-11-04T12:00:00.000Z', switches: 1 });
    const panel = render(<MemoryRouter><LockedAreaPanel area="hip" access={a} onSwitchFree={() => {}} /></MemoryRouter>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(panel.container.textContent).toContain('Your free area is Shoulder. A subscription opens every region.');
    expect(panel.container.textContent).not.toMatch(/from \d|days/);
    cleanup();

    render(<MemoryRouter><SubscriptionSummary access={a} /></MemoryRouter>);
    expect((screen.getByLabelText('Your free area') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/You have used your one change, so this is now your free area\./)).toBeTruthy();
  });
});
