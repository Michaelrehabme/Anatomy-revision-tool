import { EmailAuthProvider, sendEmailVerification, unlink, type User } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

/**
 * Confirming an email address (lib/emailVerification.ts says why): what the
 * app asks of Firebase for the "Check your inbox" step.
 *
 * ITS OWN FILE, LOADED WHEN IT IS NEEDED (context/AuthProvider imports it
 * dynamically). data/firebase.ts is part of the chunk every visitor
 * downloads first, and that chunk is within a few per cent of the size the
 * offline precache allows; nobody who is already confirmed, and no guest,
 * ever runs a line of this.
 */


/**
 * Where the link in the email leads once Firebase has confirmed the address:
 * back to this app, on whatever origin it is being used from. Firebase's own
 * page does the confirming (no handler of ours to keep in step with theirs)
 * and then offers "Continue" to this address — which must be on a domain the
 * Firebase project lists under Authentication > Settings > Authorised
 * domains (docs/CONTENT-SERVER-STATUS.md, "Before you deploy").
 */
export function confirmationContinueUrl(): string {
  return `${location.origin}/onboarding?emailConfirmed=1`;
}

/**
 * Emails the signed-in account a link that confirms its address.
 *
 * ONE REQUEST, AND NO LINK BACK TO THE APP. This used to ask for the email
 * with a "Continue" address on this origin and, if Firebase refused that
 * address, ask again at once without it. On the real service that second
 * request can never succeed: Firebase limits how often one account may ask,
 * a refused request counts, and the retry a few milliseconds later answers
 * TOO_MANY_ATTEMPTS_TRY_LATER. Every sign-up from an origin Firebase did not
 * list — which on 8 Oct 2026 included locusmsk.co.uk itself — ended on "Too
 * many emails have been sent to this address" with no email sent at all. The
 * Auth emulator has no such limit, so every test passed.
 *
 * So the email is asked for plainly. Firebase's own page confirms the
 * address, and the screen that is waiting notices when the student comes back
 * to it (it re-reads the account when the tab regains focus), which is all
 * the "Continue" link ever added. `confirmationContinueUrl` is kept for the
 * address a later version may send once the project's authorised domains are
 * known to be right; App.tsx still understands that address if it arrives.
 *
 * Rejects with Firebase's error — `auth/too-many-requests` when its own limit
 * has really been reached, which the screen says in words.
 */
export async function sendConfirmationEmail(): Promise<{ uid: string; email: string | null }> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Nobody is signed in.');
  await sendEmailVerification(user);
  return { uid: user.uid, email: user.email };
}

/**
 * Whether the account's address is confirmed AS THE DATABASE WILL SEE IT.
 *
 * Two things say "confirmed": the account (`user.emailVerified`, refreshed
 * when the user is reloaded) and the ID token Firestore sends with every
 * request (`email_verified`, fixed when the token was minted, up to an hour
 * ago). firestore.rules reads the token. So a student who has just followed
 * the link is confirmed on the account and not yet on the token, and a free
 * area written in that hour would be refused. When the two disagree the
 * token is replaced before anything is told it is safe to write.
 */
export async function confirmedForRules(user: User): Promise<boolean> {
  if (!user.emailVerified) return false;
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.email_verified !== true) await user.getIdToken(true);
  } catch {
    // Offline. The token is replaced by itself within the hour, and nothing
    // can be written to the account until there is a connection anyway.
  }
  return true;
}

/**
 * Asks Firebase whether the signed-in account's address has been confirmed
 * since this page last heard — the link is usually followed in another tab,
 * or on another device — and, if it has, replaces the token so the rules see
 * it too. Resolves with the user either way; rejects when it cannot ask.
 */
export async function reloadSignedInUser(): Promise<User | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user;
}

/**
 * "Use a different email": takes the email-and-password sign-in OFF the
 * account, leaving the same uid with everything stored under it and no way
 * of signing in — a guest again (isGuestUser). The form that made the
 * account is then shown again, and creating one LINKS the new address to the
 * same uid exactly as the first one was.
 *
 * WHY NOT CHANGE THE ADDRESS IN PLACE. Firebase will only change an address
 * by emailing the new one (`verifyBeforeUpdateEmail`), and following that
 * link signs the account out everywhere: the student would be thrown back to
 * a sign-in screen in the middle of creating their account. Taking the
 * sign-in off and putting another on keeps them signed in throughout.
 *
 * Only ever offered to an account that has not confirmed its address, so
 * there is no confirmed sign-in to lose.
 */
export async function removeEmailSignIn(): Promise<User | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  if (user.providerData.some((provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID)) {
    await unlink(user, EmailAuthProvider.PROVIDER_ID);
  }
  // So that the address it no longer has is not what the screens are told.
  await user.reload().catch(() => {});
  return user;
}
