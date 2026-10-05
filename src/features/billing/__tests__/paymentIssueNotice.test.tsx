import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { PaymentIssueNotice, accessSentence } from '../PaymentIssueNotice';
import { PaymentIssue } from '../../anatomy-revision/components/shared/PaymentIssue';
import { SubscriptionSummary } from '../../anatomy-revision/components/shared/SubscriptionSummary';
import { effectiveTier, type Entitlement } from '../../anatomy-revision/lib/entitlement';
import type { UseEntitlement } from '../../anatomy-revision/hooks/useEntitlement';

/**
 * The failed-payment notice (paywall trace finding 10).
 *
 * What is pinned is the wording, because every sentence is a claim about what
 * the code does: access is described by the stored expiry and by nothing
 * else, and no grace period is promised because none is given. And the
 * behaviour that keeps it from nagging: on Today it can be put away for the
 * session; on the account screen it stays.
 */

// Nobody is signed in here, so asking for the portal fails — which is the
// case the last test of the first block is about. Mocked rather than loaded:
// the real module brings the whole Firebase SDK with it.
vi.mock('../../anatomy-revision/data/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: null }),
}));

const NOW = '2026-05-14T12:00:00.000Z';

/** What the webhook leaves on a monthly subscriber whose 12 May renewal failed. */
const pastDue: Entitlement = {
  tier: 'individual',
  source: 'paddle',
  expiresAt: '2026-05-12T10:18:47.635Z',
  externalId: 'sub_1',
  interval: 'month',
  paymentIssueSince: '2026-05-12T10:19:26.014Z',
};

function accessWith(entitlement: Entitlement, over: Partial<UseEntitlement> = {}): UseEntitlement {
  return {
    entitlement,
    tier: effectiveTier(entitlement),
    loading: false,
    canAccess: () => true,
    locked: () => [],
    areas: ['knee'],
    freeArea: { area: 'knee', chosenAt: '2026-04-01T12:00:00.000Z', switches: 0 },
    chooseFreeArea: () => {},
    canSwitchFree: false,
    daysUntilSwitch: 0,
    switchUsed: false,
    refresh: () => {},
    ...over,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the failed-payment notice', () => {
  it('says what happened, what has happened to access, and what to do', () => {
    render(<PaymentIssueNotice entitlement={pastDue} placement="account" />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toBe(
      'Your last payment did not go through' +
      'Full access stopped on 12 May 2026, the end of the time you had paid for. ' +
      'Update your card and full access returns once the payment goes through. Your progress is kept.' +
      'Update your card',
    );
    expect(screen.getByRole('button', { name: 'Update your card' })).toBeTruthy();
  });

  it('describes access by the stored expiry alone', () => {
    const at = new Date(NOW);
    expect(accessSentence(pastDue, at)).toBe('Full access stopped on 12 May 2026, the end of the time you had paid for.');
    // If the stored expiry were still ahead, it would say so — never a grace period of its own.
    expect(accessSentence({ ...pastDue, expiresAt: '2026-05-20T10:00:00.000Z' }, at)).toBe('Full access runs until 20 May 2026.');
    expect(accessSentence({ ...pastDue, expiresAt: null }, at)).toBe('');
  });

  it('promises nothing the code does not do', () => {
    render(<PaymentIssueNotice entitlement={pastDue} placement="today" />);
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).not.toMatch(/grace|days? left|try again|retry|we will|cancel/i);
  });

  it('is a polite status, not an alert, and every control is a real button', () => {
    render(<PaymentIssueNotice entitlement={pastDue} placement="today" />);
    expect(screen.queryByRole('alert')).toBeNull();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Update your card', 'Not now']);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('tabindex')).not.toBe('-1');
      // Big enough to hit on a phone.
      expect(b.style.minHeight).toBe('44px');
    }
  });

  it('on Today can be put away, and stays away for the session', () => {
    const first = render(<PaymentIssueNotice entitlement={pastDue} placement="today" />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('status')).toBeNull();
    first.unmount();
    // Coming back to Today later in the same session.
    render(<PaymentIssueNotice entitlement={pastDue} placement="today" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('but a NEW failure is shown again', () => {
    render(<PaymentIssueNotice entitlement={pastDue} placement="today" />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    cleanup();
    render(<PaymentIssueNotice entitlement={{ ...pastDue, paymentIssueSince: '2026-06-12T10:19:26.014Z' }} placement="today" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('on the account screen cannot be dismissed, and ignores a dismissal made on Today', () => {
    sessionStorage.setItem('locusmsk.paymentIssueDismissed', pastDue.paymentIssueSince!);
    render(<PaymentIssueNotice entitlement={pastDue} placement="account" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('shows nothing once the flag is gone, or for access that is not a Paddle subscription', () => {
    const { paymentIssueSince: _gone, ...recovered } = pastDue;
    void _gone;
    const { container } = render(<PaymentIssueNotice entitlement={recovered} placement="account" />);
    expect(container.textContent).toBe('');
    cleanup();
    // A stray field on a complimentary grant must not tell somebody who pays nothing that a payment failed.
    const comped = render(<PaymentIssueNotice entitlement={{ ...pastDue, source: 'complimentary', expiresAt: null }} placement="account" />);
    expect(comped.container.textContent).toBe('');
  });

  it('says so, as an alert, when the portal cannot be opened', async () => {
    render(<PaymentIssueNotice entitlement={pastDue} placement="account" />);
    fireEvent.click(screen.getByRole('button', { name: 'Update your card' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/billing portal could not be opened/));
  });
});

describe('where the notice is mounted', () => {
  it('nothing is rendered, and nothing fetched, for an account with no payment problem', () => {
    const { container } = render(
      <PaymentIssue access={accessWith({ tier: 'individual', source: 'paddle', expiresAt: '2027-01-01T00:00:00.000Z' })} placement="today" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('nothing while the entitlement is still loading', () => {
    const { container } = render(<PaymentIssue access={accessWith(pastDue, { loading: true })} placement="today" />);
    expect(container.innerHTML).toBe('');
  });

  it('the notice, for an account whose payment failed', async () => {
    render(<PaymentIssue access={accessWith(pastDue)} placement="today" />);
    expect((await screen.findByRole('status')).textContent).toMatch(/^Your last payment did not go through/);
  });

  it('on the account screen, above a line that says access stopped — not that the subscription ended', async () => {
    const { container } = render(<MemoryRouter><SubscriptionSummary access={accessWith(pastDue)} /></MemoryRouter>);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(container.querySelector('[data-testid="subscription-status"]')?.textContent).toBe(
      'Full access stopped on 12 May 2026. Free: knee only.',
    );
    // The way to fix it is offered twice over: the button, and the standing portal link.
    expect(screen.getByRole('button', { name: 'Update your card' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Manage or cancel your subscription' })).toBeTruthy();
  });

  // The desktop and the phone are separate components, and each has to mount
  // it. Rendering either needs the whole content set; what is checked is that
  // both ask for the same thing in the same place.
  it.each([
    ['Today/Today.tsx'],
    ['mobile/MobileToday.tsx'],
  ])('%s mounts it once, as the Today placement', (file) => {
    const source = readFileSync(join(process.cwd(), 'src/features/anatomy-revision/components', file), 'utf8');
    expect(source.match(/<PaymentIssue /g)).toHaveLength(1);
    expect(source).toMatch(/<PaymentIssue access=\{access\} placement="today"/);
  });
});
