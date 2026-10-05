import { isLoopback } from './firebaseAdmin';

/**
 * Who is calling: a Firebase ID token, checked with Google.
 *
 * WHY A TOKEN AND NOT A UID. A uid in a request proves nothing — anyone who
 * learned another student's could ask for that person's billing portal, or
 * for the areas that person paid for. A signed token from Firebase does.
 *
 * WHY IT IS CHECKED OVER HTTP rather than with firebase-admin/auth. That
 * module pulls in jwks-rsa, which `require()`s the ESM-only `jose`, and the
 * two cannot load together in the bundled function runtime — it fails at
 * import with ERR_REQUIRE_ESM, so every request 502s. Google's identity
 * toolkit answers the same question over a plain fetch with no dependency at
 * all: hand it the token, get back the account, or get back an error. The web
 * API key it takes is the public one the browser already ships.
 *
 * A token for an account that has since been DELETED fails here too: the
 * lookup is of the account, not of the signature, so there is nothing to find.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   VITE_FIREBASE_API_KEY     the web API key (public), for the token check
 *
 * Shared by paddle-portal and content-area. See firebaseAdmin.ts for why this
 * directory is not itself published as a function.
 */

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com';

/** The token from an `Authorization: Bearer …` header, or null. */
export function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  return token || null;
}

/**
 * Where to ask. Google, unless this process has been pointed at the Auth
 * emulator ON THIS MACHINE — the same variable the Admin SDK itself honours —
 * which is how the functions are run against emulators and never against real
 * accounts. Loopback only, for the reason given in firebaseAdmin.ts.
 */
function lookupUrl(apiKey: string): string {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = isLoopback(emulator) ? `http://${emulator}/identitytoolkit.googleapis.com` : IDENTITY_TOOLKIT;
  return `${base}/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;
}

/**
 * The account a Firebase ID token belongs to, or null if the token is not
 * valid — expired, tampered with, from another project, or for an account
 * that no longer exists. Google does the verifying; a bad token comes back as
 * an error, never as an account.
 *
 * `caller` names the function in the log line, so a missing key is traceable.
 */
export async function uidForToken(idToken: string, caller: string): Promise<string | null> {
  const emulated = isLoopback(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  // `||`, not `??`: a variable set to nothing (an .env template) is not a key.
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || (emulated ? 'emulator' : '');
  if (!apiKey) {
    console.error(`${caller}: no Firebase web API key to verify tokens with`);
    return null;
  }

  const response = await fetch(lookupUrl(apiKey), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { users?: { localId?: string }[] };
  return body.users?.[0]?.localId ?? null;
}
