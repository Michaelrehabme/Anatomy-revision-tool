import type { Paddle } from '@paddle/paddle-js';
import type { CheckoutRequest, PaddleConfig } from './checkout';

/**
 * Loads Paddle.js once and opens its checkout overlay.
 *
 * The package is imported dynamically, so the script is only fetched when a
 * student actually clicks to buy. Paddle.js loads from Paddle's CDN at runtime,
 * and there is no reason for every student answering a question to fetch it.
 */

let instance: Promise<Paddle | undefined> | null = null;

function loadPaddle(config: PaddleConfig): Promise<Paddle | undefined> {
  if (!instance) {
    instance = import('@paddle/paddle-js')
      .then(({ initializePaddle }) => initializePaddle({ environment: config.environment, token: config.token }))
      .catch((error: unknown) => {
        // Forget the failure so the next click tries again. A blocked script
        // (an ad blocker, or a flaky connection) should not need a page reload.
        instance = null;
        throw error;
      });
  }
  return instance;
}

export async function openCheckout(config: PaddleConfig, request: CheckoutRequest): Promise<void> {
  const paddle = await loadPaddle(config);
  if (!paddle) throw new Error('Paddle did not initialise');
  paddle.Checkout.open(request);
}
