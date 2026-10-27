/**
 * The email the owner gets for each new sign-up (owner, 25 Oct 2026: "will be
 * good for my own reference"). Sent by netlify/functions/signup-emails.ts;
 * built here, with no network, so the wording is tested.
 *
 * A sign-up is an account with a sign-in method: a guest has none, and a guest
 * who signs up later keeps their uid and gains one, so they count when they
 * do. Plain text, as the report emails are.
 */

export const ADMIN_USERS_URL = 'https://locusmsk.co.uk/admin/users';

export interface SignupAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** Firebase provider ids, e.g. 'google.com', 'password'. Empty for a guest. */
  providers: string[];
  emailVerified: boolean;
  /** When the uid was created, which for a guest who signed up later is when they first came as a guest. */
  createdAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  'google.com': 'Google',
  password: 'Email and password',
  'apple.com': 'Apple',
};

export function isSignedUp(account: Pick<SignupAccount, 'providers'>): boolean {
  return account.providers.length > 0;
}

export function signupEmail(account: SignupAccount, total: number): { subject: string; text: string } {
  const who = account.email ?? account.displayName ?? account.uid;
  const method = account.providers.map((p) => PROVIDER_LABELS[p] ?? p).join(', ');
  const subject = `New sign-up: ${who}`;
  const text = [
    `${who} signed up.`,
    '',
    `Name: ${account.displayName ?? '—'}`,
    `Email: ${account.email ?? '—'}`,
    `Signed up with: ${method}`,
    ...(account.providers.includes('password') ? [`Email confirmed: ${account.emailVerified ? 'yes' : 'not yet'}`] : []),
    `Account created: ${account.createdAt}`,
    `Signed-up accounts in all: ${total}`,
    '',
    `See them: ${ADMIN_USERS_URL}/${account.uid}`,
  ].join('\n');
  return { subject, text };
}
