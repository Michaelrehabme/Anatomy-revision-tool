import { describe, expect, it } from 'vitest';
import { reminderDue, reminderEmail, REMINDER_EVERY, REMINDER_LEAD_DAYS } from '../renewalReminders';
import type { Entitlement } from '../../../anatomy-revision/lib/entitlement';

/**
 * The failure that matters here is silence: a reminder that should have gone
 * and did not is the one an enforcement query asks about. The second failure
 * is duplication — emailing somebody about a renewal Paddle already warned
 * them of, or twice about the same one.
 */

const NOW = new Date('2027-03-24T09:00:00.000Z');

/** A monthly subscriber whose 6th payment falls inside the reminder window. */
function monthly(over: Partial<Entitlement> = {}): Entitlement {
  return {
    tier: 'individual',
    source: 'paddle',
    interval: 'month',
    startedAt: '2026-09-28T12:00:00.000Z',
    expiresAt: '2027-03-28T12:00:00.000Z', // the 6th payment
    externalId: 'sub_1',
    ...over,
  };
}

describe('reminderDue', () => {
  it('is due seven days before the sixth payment', () => {
    const decision = reminderDue(monthly(), NOW);
    expect(decision.due).toBe(true);
    if (!decision.due) return;
    expect(decision.reminder.paymentNumber).toBe(REMINDER_EVERY);
    expect(decision.reminder.chargeAt).toBe('2027-03-28T12:00:00.000Z');
    expect(decision.reminder.key).toBe('sub_1:6');
  });

  it('is due again before the twelfth, and the eighteenth', () => {
    for (const [expires, payment] of [
      ['2027-09-28T12:00:00.000Z', 12],
      ['2028-03-28T12:00:00.000Z', 18],
    ] as const) {
      const at = new Date(Date.parse(expires) - 3 * 86_400_000);
      const decision = reminderDue(monthly({ expiresAt: expires }), at);
      expect(decision.due).toBe(true);
      if (decision.due) expect(decision.reminder.paymentNumber).toBe(payment);
    }
  });

  it('does not fire on the payments in between', () => {
    // The 7th. Reminding monthly would be nagging, not compliance.
    const decision = reminderDue(monthly({ expiresAt: '2027-04-28T12:00:00.000Z' }), new Date('2027-04-24T09:00:00.000Z'));
    expect(decision.due).toBe(false);
  });

  it('does not fire before the sixth payment at all', () => {
    const decision = reminderDue(monthly({ expiresAt: '2026-12-28T12:00:00.000Z' }), new Date('2026-12-24T09:00:00.000Z'));
    expect(decision.due).toBe(false);
  });

  it('stays silent until the window opens', () => {
    const early = new Date(Date.parse('2027-03-28T12:00:00.000Z') - (REMINDER_LEAD_DAYS + 1) * 86_400_000);
    expect(reminderDue(monthly(), early).due).toBe(false);
  });

  it('leaves the annual plan to Paddle', () => {
    // UK law makes Paddle send this one. A second email is a support question,
    // not extra compliance.
    const decision = reminderDue(monthly({ interval: 'year' }), NOW);
    expect(decision.due).toBe(false);
    if (!decision.due) expect(decision.reason).toMatch(/Paddle/);
  });

  it('says nothing about a subscription that has already lapsed', () => {
    const decision = reminderDue(monthly({ expiresAt: '2027-01-01T00:00:00.000Z' }), NOW);
    expect(decision.due).toBe(false);
  });

  it('refuses to guess when it cannot tell', () => {
    for (const broken of [
      monthly({ interval: undefined }),
      monthly({ startedAt: undefined }),
      monthly({ expiresAt: null }),
      monthly({ startedAt: 'a while ago' }),
      { tier: 'free', source: null, expiresAt: null } as Entitlement,
      monthly({ source: 'licence' }),
    ]) {
      expect(reminderDue(broken, NOW).due).toBe(false);
    }
    expect(reminderDue(null, NOW).due).toBe(false);
  });

  it('does not drift a payment behind over a year of short months', () => {
    // Months are 28-31 days. Counting them by flooring 30-day blocks loses a
    // payment by the twelfth, which would send the notice one charge late.
    const started = '2026-01-31T12:00:00.000Z';
    const twelfth = '2027-01-31T12:00:00.000Z';
    const decision = reminderDue(
      monthly({ startedAt: started, expiresAt: twelfth }),
      new Date(Date.parse(twelfth) - 2 * 86_400_000),
    );
    expect(decision.due).toBe(true);
    if (decision.due) expect(decision.reminder.paymentNumber).toBe(12);
  });
});

describe('reminderEmail', () => {
  it('names the date, the amount and the way out', () => {
    const { subject, text } = reminderEmail(
      { key: 'sub_1:6', paymentNumber: 6, chargeAt: '2027-03-28T12:00:00.000Z' },
      { price: '£4.99', manageUrl: 'https://locusmsk.co.uk/account' },
    );
    expect(subject).toContain('28 March 2027');
    expect(text).toContain('£4.99');
    expect(text).toContain('https://locusmsk.co.uk/account');
    // It must not read as a demand for payment.
    expect(text).toContain('This is a reminder, not a bill.');
  });
});
