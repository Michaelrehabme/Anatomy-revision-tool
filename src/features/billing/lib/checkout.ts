/**
 * Everything the pricing page decides before Paddle's overlay opens. It is kept
 * pure so it can be tested without loading Paddle.js or a browser.
 *
 * WHAT THE BROWSER IS TRUSTED WITH. Two things only: which price to put in the
 * basket, and the `customData` that travels with the subscription to the
 * webhook. The webhook uses `uid` to find the account and records the consent
 * fields as evidence. It never takes the tier or the dates from here (see
 * paddleWebhook.ts), so nothing a student edits in devtools can buy more than
 * they paid for.
 */

export type PlanId = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  label: string;
  /** Display only. The charge is whatever the Paddle price says. */
  price: string;
  per: string;
  note: string;
}

/**
 * The prices as SHOWN. The prices CHARGED live in Paddle, and those two must be
 * kept in step by hand: change a price in the Paddle dashboard and change it
 * here in the same sitting. Paddle's checkout shows the real figure (VAT
 * included) before anybody pays, so if they ever drift apart the customer sees
 * the correct price. The cost is only an embarrassing mismatch.
 */
export const PLANS: readonly Plan[] = [
  { id: 'annual', label: 'Annual', price: '£29.99', per: 'a year', note: 'About £2.50 a month. Covers a full academic year.' },
  { id: 'monthly', label: 'Monthly', price: '£4.99', per: 'a month', note: 'Cancel whenever you like.' },
];

/**
 * Bump this whenever the wording in CoolingOffWaiver changes. It is stored with
 * each subscription, so a later rewording never changes what an earlier
 * customer is recorded as having agreed to.
 */
export const CONSENT_WORDING_VERSION = 'cooling-off-v1';

export interface PaddleConfig {
  environment: 'sandbox' | 'production';
  token: string;
  prices: Record<PlanId, string>;
}

/** The slice of import.meta.env the config reads. A parameter so tests can pass their own. */
export interface BillingEnv {
  VITE_PADDLE_ENV?: string;
  VITE_PADDLE_CLIENT_TOKEN?: string;
  VITE_PADDLE_PRICE_MONTHLY?: string;
  VITE_PADDLE_PRICE_ANNUAL?: string;
}

/**
 * Paddle settings from the build environment, or null if any are missing.
 *
 * Null is a normal state, not an error. Until the account is approved and the
 * Netlify variables are set, the pricing page shows the plans with the button
 * switched off. That beats a button that opens a broken checkout.
 *
 * The client token (`live_…` / `test_…`) is designed to be public. Paddle
 * issues it for use in browsers. It is NOT the API key or the webhook secret,
 * and neither of those should ever get a VITE_ prefix.
 */
export function readPaddleConfig(env: BillingEnv): PaddleConfig | null {
  const token = env.VITE_PADDLE_CLIENT_TOKEN?.trim();
  const monthly = env.VITE_PADDLE_PRICE_MONTHLY?.trim();
  const annual = env.VITE_PADDLE_PRICE_ANNUAL?.trim();
  if (!token || !monthly || !annual) return null;

  // A sandbox token against production (or the other way round) fails inside
  // Paddle's overlay with an error the customer cannot act on. Catch it here.
  const environment = env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox';
  const tokenIsLive = token.startsWith('live_');
  if (tokenIsLive !== (environment === 'production')) return null;

  return { environment, token, prices: { monthly, annual } };
}

export interface CheckoutRequest {
  items: { priceId: string; quantity: number }[];
  customer?: { email: string };
  customData: {
    uid: string;
    coolingOffWaived: boolean;
    consentAt: string;
    consentVersion: string;
  };
  settings: {
    displayMode: 'overlay';
    theme: 'light';
    locale: 'en';
    successUrl: string;
  };
}

export interface BuildCheckoutInput {
  config: PaddleConfig;
  plan: PlanId;
  uid: string;
  email: string | null;
  /** True if the waiver box was ticked; false if the student chose the delayed start. */
  coolingOffWaived: boolean;
  origin: string;
  now?: Date;
}

export function buildCheckoutRequest({
  config, plan, uid, email, coolingOffWaived, origin, now = new Date(),
}: BuildCheckoutInput): CheckoutRequest {
  return {
    items: [{ priceId: config.prices[plan], quantity: 1 }],
    // Filled in beforehand so the receipt goes to the address on the account.
    // The student can still change it in the overlay.
    ...(email ? { customer: { email } } : {}),
    customData: {
      uid,
      coolingOffWaived,
      consentAt: now.toISOString(),
      consentVersion: CONSENT_WORDING_VERSION,
    },
    settings: {
      displayMode: 'overlay',
      theme: 'light',
      locale: 'en',
      successUrl: `${origin}/pricing?checkout=done`,
    },
  };
}
