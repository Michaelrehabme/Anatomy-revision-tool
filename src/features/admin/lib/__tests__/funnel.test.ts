import { describe, expect, it } from 'vitest';
import { funnelRows, funnelSources } from '../funnel';
import type { FunnelEvent, FunnelStep } from '../../../feedback/data/telemetry';

const event = (userId: string, step: FunnelStep, source = '', createdAt = '2026-10-12T10:00:00.000Z'): FunnelEvent => ({
  userId,
  step,
  source,
  createdAt,
});

describe('funnelRows', () => {
  it('counts people at each step and the share who came through from the step before', () => {
    const rows = funnelRows([
      event('a', 'landing-viewed'),
      event('b', 'landing-viewed'),
      event('c', 'landing-viewed'),
      event('d', 'landing-viewed'),
      event('a', 'signup-started'),
      event('b', 'signup-started'),
      event('a', 'account-created'),
    ]);
    expect(rows.filter((r) => !r.step.startsWith('trial-')).map((r) => [r.step, r.people, r.ofPrevious]).slice(0, 4)).toEqual([
      ['landing-viewed', 4, null],
      ['signup-started', 2, 50],
      ['account-created', 1, 50],
      ['email-confirmed', 0, 0],
    ]);
  });

  it('measures the trial against the home page, and the account form against the home page too', () => {
    const rows = funnelRows([
      event('a', 'landing-viewed'),
      event('b', 'landing-viewed'),
      event('c', 'landing-viewed'),
      event('d', 'landing-viewed'),
      event('a', 'trial-started'),
      event('b', 'trial-started'),
      event('a', 'trial-finished'),
      event('a', 'signup-started'),
      event('c', 'signup-started'),
      event('d', 'signup-started'),
    ]);
    const share = (step: FunnelStep) => rows.find((r) => r.step === step)?.ofPrevious;
    expect(share('trial-started')).toBe(50);
    expect(share('trial-finished')).toBe(50);
    expect(share('signup-started')).toBe(75);
  });

  it('gives no percentage where nobody reached the step before', () => {
    const rows = funnelRows([event('a', 'pricing-viewed')]);
    expect(rows.find((r) => r.step === 'pricing-viewed')).toMatchObject({ people: 1, ofPrevious: null });
  });

  it('gives no percentage where a step was reached by more people than the one before it', () => {
    const rows = funnelRows([event('a', 'landing-viewed'), event('a', 'signup-started'), event('b', 'signup-started')]);
    expect(rows.find((r) => r.step === 'signup-started')).toMatchObject({ people: 2, ofPrevious: null });
  });

  it('follows the people who arrived from a source, even where a later step lost the tag', () => {
    const events = [
      event('a', 'landing-viewed', 'tiktok', '2026-10-12T10:00:00.000Z'),
      // The next day, typed the address in: no source on the event itself.
      event('a', 'account-created', '', '2026-10-13T10:00:00.000Z'),
      event('b', 'landing-viewed', 'instagram'),
      event('b', 'account-created', 'instagram'),
    ];
    const tiktok = funnelRows(events, 'tiktok');
    expect(tiktok.find((r) => r.step === 'landing-viewed')?.people).toBe(1);
    expect(tiktok.find((r) => r.step === 'account-created')?.people).toBe(1);
  });
});

describe('funnelSources', () => {
  it('lists each source once per person, busiest first', () => {
    expect(
      funnelSources([
        event('a', 'landing-viewed', 'tiktok'),
        event('a', 'signup-started', 'tiktok'),
        event('b', 'landing-viewed', 'tiktok'),
        event('c', 'landing-viewed', 'instagram'),
        event('d', 'landing-viewed'),
      ]),
    ).toEqual([
      { source: 'tiktok', people: 2 },
      { source: 'instagram', people: 1 },
    ]);
  });
});
