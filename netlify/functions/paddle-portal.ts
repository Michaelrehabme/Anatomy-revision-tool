import { adminDb } from './lib/firebaseAdmin';
import { bearerToken, uidForToken } from './lib/idToken';

/**
 * POST /.netlify/functions/paddle-portal
 *
 * Hands back a one-time link to Paddle's customer portal, where a subscriber
 * cancels, changes their card, or downloads an invoice.
 *
 * WHY IT IS SERVER-SIDE. Creating a portal session needs the Paddle API key,
 * which is a full-access credential and must never reach a browser. And the
 * customer id it needs lives inside the entitlement map, which clients cannot
 * write but can read — so the check that matters is that the caller really is
 * the account they claim to be.
 *
 * WHY IT VERIFIES A FIREBASE ID TOKEN. Without it, anyone who learned another
 * student's uid could open that person's billing portal: their card details,
 * their invoices, their subscription to cancel. The uid in a request body
 * proves nothing; a signed token from Firebase does.
 *
 * How the token is checked, and why over HTTP rather than with
 * firebase-admin/auth, is lib/idToken.ts — shared with the content function.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   PADDLE_API_KEY            live or sandbox API key, matching the site
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 *
 * Either missing and every request is refused, for the same reason the webhook
 * fails closed: a billing endpoint that cannot verify must not act.
 */

const PADDLE_API = {
  production: 'https://api.paddle.com',
  sandbox: 'https://sandbox-api.paddle.com',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.error('paddle-portal: PADDLE_API_KEY is not set');
    return new Response('Not configured', { status: 503 });
  }

  // A live key starts with pdl_live_; anything else is treated as sandbox, the
  // same fail-safe direction readPaddleConfig takes in the browser.
  const base = apiKey.startsWith('pdl_live_') ? PADDLE_API.production : PADDLE_API.sandbox;

  const idToken = bearerToken(req);
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  const uid = await uidForToken(idToken, 'paddle-portal');
  if (!uid) {
    console.warn('paddle-portal: rejected an unverifiable ID token');
    return new Response('Unauthorized', { status: 401 });
  }

  const snapshot = await adminDb().doc(`users/${uid}`).get();
  const entitlement = snapshot.data()?.entitlement as Record<string, unknown> | undefined;
  const customerId = typeof entitlement?.customerId === 'string' ? entitlement.customerId : null;
  if (!customerId) {
    // Nothing bought through Paddle: a licensed student, a comped account, or
    // somebody who subscribed before customerId was recorded.
    return new Response(JSON.stringify({ url: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const response = await fetch(`${base}/customers/${customerId}/portal-sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    console.error(`paddle-portal: Paddle returned ${response.status} for ${customerId}`);
    return new Response('Upstream error', { status: 502 });
  }

  const body = (await response.json()) as {
    data?: { urls?: { general?: { overview?: string } } };
  };
  const url = body.data?.urls?.general?.overview ?? null;
  if (!url) {
    console.error('paddle-portal: Paddle returned no overview url');
    return new Response('Upstream error', { status: 502 });
  }

  // The link is short-lived and single-use by design, so it is never stored —
  // the account screen asks for a fresh one each time it is clicked.
  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
