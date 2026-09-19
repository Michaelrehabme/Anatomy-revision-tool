import { describe, expect, it } from 'vitest';
import { buildCheckoutRequest, readPaddleConfig, CONSENT_WORDING_VERSION, PLANS } from '../checkout';

const ENV = {
  VITE_PADDLE_ENV: 'sandbox',
  VITE_PADDLE_CLIENT_TOKEN: 'test_abc',
  VITE_PADDLE_PRICE_MONTHLY: 'pri_month',
  VITE_PADDLE_PRICE_ANNUAL: 'pri_year',
};

describe('readPaddleConfig', () => {
  it('reads a complete sandbox configuration', () => {
    expect(readPaddleConfig(ENV)).toEqual({
      environment: 'sandbox', token: 'test_abc', prices: { monthly: 'pri_month', annual: 'pri_year' },
    });
  });

  it('is null until every value is set, so the page disables checkout rather than breaking it', () => {
    expect(readPaddleConfig({})).toBeNull();
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_PRICE_ANNUAL: '' })).toBeNull();
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_CLIENT_TOKEN: '  ' })).toBeNull();
  });

  it('refuses a live token in sandbox, and a test token in production', () => {
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_CLIENT_TOKEN: 'live_abc' })).toBeNull();
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_ENV: 'production' })).toBeNull();
  });

  it('accepts a live token in production', () => {
    const config = readPaddleConfig({ ...ENV, VITE_PADDLE_ENV: 'production', VITE_PADDLE_CLIENT_TOKEN: 'live_abc' });
    expect(config?.environment).toBe('production');
  });

  it('refuses production in the public demo build, which may only ever run a sandbox checkout', () => {
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_ENV: 'production', VITE_PADDLE_CLIENT_TOKEN: 'live_abc', VITE_PUBLIC_DEMO: '1' })).toBeNull();
    expect(readPaddleConfig({ ...ENV, VITE_PUBLIC_DEMO: '1' })?.environment).toBe('sandbox');
  });

  it('treats anything other than "production" as sandbox, so a typo can never take real money', () => {
    expect(readPaddleConfig({ ...ENV, VITE_PADDLE_ENV: 'prod' })?.environment).toBe('sandbox');
  });
});

describe('buildCheckoutRequest', () => {
  const config = readPaddleConfig(ENV)!;
  const NOW = new Date('2026-10-15T12:00:00.000Z');

  it('puts the chosen plan in the basket', () => {
    const req = buildCheckoutRequest({
      config, plan: 'annual', uid: 'u1', email: 'a@b.co', coolingOffWaived: true, origin: 'https://x', now: NOW,
    });
    expect(req.items).toEqual([{ priceId: 'pri_year', quantity: 1 }]);
    expect(req.customer).toEqual({ email: 'a@b.co' });
  });

  it('carries the uid and the consent the webhook records', () => {
    const req = buildCheckoutRequest({
      config, plan: 'monthly', uid: 'u1', email: null, coolingOffWaived: false, origin: 'https://x', now: NOW,
    });
    expect(req.customData).toEqual({
      uid: 'u1', coolingOffWaived: false, consentAt: '2026-10-15T12:00:00.000Z', consentVersion: CONSENT_WORDING_VERSION,
    });
    expect(req.customer).toBeUndefined();
  });

  it('never sends a tier or a date the webhook might trust', () => {
    const req = buildCheckoutRequest({
      config, plan: 'monthly', uid: 'u1', email: null, coolingOffWaived: true, origin: 'https://x', now: NOW,
    });
    expect(Object.keys(req.customData).sort()).toEqual(['consentAt', 'consentVersion', 'coolingOffWaived', 'uid']);
  });

  it('returns to the pricing page afterwards', () => {
    const req = buildCheckoutRequest({
      config, plan: 'monthly', uid: 'u1', email: null, coolingOffWaived: true, origin: 'https://locusmsk.co.uk', now: NOW,
    });
    expect(req.settings.successUrl).toBe('https://locusmsk.co.uk/pricing?checkout=done');
  });
});

describe('PLANS', () => {
  it('lists annual first, the plan most students should pick', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['annual', 'monthly']);
  });
});
