import { adminApp } from './firebaseAdmin';

/**
 * Reading Firebase accounts from a function, over HTTP.
 *
 * NEVER firebase-admin/auth. It pulls in jwks-rsa, which `require()`s the
 * ESM-only `jose`, and the function fails at import with ERR_REQUIRE_ESM
 * (see lib/idToken.ts). Twice a function has been deployed with it and
 * silently stopped: signup-emails on 25 Oct 2026, and report-emails after its
 * redesign, which sent no report emails at all until this. A test
 * (functionsImports.test.ts) now fails if any function imports it.
 *
 * Google's identity toolkit answers the same questions over a plain fetch,
 * authorised by the service account's own access token.
 *
 * REQUIRED ENVIRONMENT: FIREBASE_SERVICE_ACCOUNT, as for firebaseAdmin.ts.
 */

/** One account as the identity toolkit returns it; only the fields read here. */
export interface ToolkitUser {
  localId: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
  /** Millisecond timestamp, as a string. */
  createdAt?: string;
  /** The ways the account can sign in. Empty for a guest. */
  providerUserInfo?: { providerId: string }[];
}

async function toolkit(path: string, init: RequestInit = {}): Promise<unknown> {
  const app = adminApp();
  const credential = app.options.credential;
  const projectId = app.options.projectId ?? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}').project_id;
  if (!credential || !projectId) throw new Error('accounts: no service account credential to read accounts with');
  const { access_token } = await credential.getAccessToken();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`accounts: ${path.split('?')[0]} failed, ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

/** Every account, guests included. */
export async function listAccounts(): Promise<ToolkitUser[]> {
  const out: ToolkitUser[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ maxResults: '1000' });
    if (pageToken) query.set('nextPageToken', pageToken);
    const page = (await toolkit(`accounts:batchGet?${query}`)) as { users?: ToolkitUser[]; nextPageToken?: string };
    out.push(...(page.users ?? []));
    pageToken = page.users?.length ? page.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

/** One account by uid, or null if there is none. */
export async function accountByUid(uid: string): Promise<ToolkitUser | null> {
  const found = (await toolkit('accounts:lookup', { method: 'POST', body: JSON.stringify({ localId: [uid] }) })) as {
    users?: ToolkitUser[];
  };
  return found.users?.[0] ?? null;
}
