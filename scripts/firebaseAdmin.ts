import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { readFileSync } from 'node:fs';

/**
 * Shared Admin SDK bootstrap for the one-off scripts in this directory
 * (setAdmin.ts, seedChangeRequests.ts). These scripts run outside Vite, so
 * they read GOOGLE_APPLICATION_CREDENTIALS directly rather than via
 * import.meta.env — see the README's "Admin scripts" section for how to get
 * a service account key.
 */
export function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at a Firebase service account key JSON file ' +
        '(Firebase console -> Project settings -> Service accounts -> Generate new private key) — see the README.',
    );
  }

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
  return initializeApp({ credential: cert(serviceAccount) });
}
