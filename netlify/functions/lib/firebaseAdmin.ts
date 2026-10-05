import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * The Admin SDK app every function shares.
 *
 * It was written out three times — in the webhook, the billing portal and
 * the renewal reminders — and a fourth function was about to make it four.
 * One copy, so that "which credentials does server code run with" has one
 * answer and one place to change it.
 *
 * NOT A FUNCTION ITSELF. Netlify publishes a subdirectory of
 * netlify/functions as an endpoint only when it holds an index file or a file
 * named after the directory; this directory holds neither, on purpose, and
 * must never gain a `lib.ts` or an `index.ts`.
 *
 * REQUIRED ENVIRONMENT (set in Netlify, never committed):
 *   FIREBASE_SERVICE_ACCOUNT  the service account key JSON, as one string
 *
 * Missing, and this throws: every caller fails closed rather than acting
 * without being able to read or write what it is acting on.
 */

/** True when a host:port names this machine. An emulator anywhere else is not an emulator we started. */
export function isLoopback(host: string | undefined): host is string {
  if (!host) return false;
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

/**
 * Whether this process is pointed at the Firestore emulator on this machine.
 *
 * For `netlify dev` against `firebase emulators:start`, which is how the
 * content function is exercised end to end without touching the real
 * database (docs/CONTENT-SERVER-STATUS.md). The emulator needs a project id
 * and no credentials, so a missing service account is not an error there.
 * Loopback only: a deployed function cannot reach one, so a stray variable in
 * the Netlify dashboard can do no more than make requests fail.
 */
export function usingFirestoreEmulator(): boolean {
  return isLoopback(process.env.FIRESTORE_EMULATOR_HOST);
}

export function adminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    if (usingFirestoreEmulator()) {
      return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-locusmsk' });
    }
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  }
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

/** Firestore through the Admin SDK, which bypasses firestore.rules: everything it writes is the server's word. */
export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
