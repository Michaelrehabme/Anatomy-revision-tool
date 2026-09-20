import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
 * WHY THE TOKEN IS CHECKED OVER HTTP rather than with firebase-admin/auth.
 * That module pulls in jwks-rsa, which `require()`s the ESM-only `jose`, and
 * the two cannot load together in the bundled function runtime — it fails at
 * import with ERR_REQUIRE_ESM, so every request 502s. Google's identity
 * toolkit answers the same question over a plain fetch with no dependency at
 * all: hand it the token, get back the account, or get back an error. The web
 * API key it takes is the public one the browser already ships.
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

function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

/**
 * The account a Firebase ID token belongs to, or null if the token is not
 * valid — expired, tampered with, or from another project. Google does the
 * verifying; a bad token comes back as an error, never as an account.
 */
async function uidForToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('paddle-portal: no Firebase web API key to verify tokens with');
    return null;
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { users?: { localId?: string }[] };
  return body.users?.[0]?.localId ?? null;
}

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

  const authorization = req.headers.get('authorization') ?? '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  const uid = await uidForToken(idToken);
  if (!uid) {
    console.warn('paddle-portal: rejected an unverifiable ID token');
    return new Response('Unauthorized', { status: 401 });
  }

  const snapshot = await getFirestore(adminApp()).doc(`users/${uid}`).get();
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
