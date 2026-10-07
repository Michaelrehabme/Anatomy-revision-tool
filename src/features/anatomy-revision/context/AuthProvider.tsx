import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { LinkInput } from '../data/firebase';
import { BUNDLED_CONTENT } from '../data/content/bundledContent';
import { clearConfirmationRecord, markConfirmationRequired, recordConfirmationSent } from '../lib/emailVerification';

/** Account UI only makes sense once there's a real Firebase project to sign into — local dev stays a plain anonymous id with no dead buttons. */
export const AUTH_ENABLED = (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  /**
   * A guest: the anonymous sign-in every visitor gets, or an account whose
   * only sign-in has been taken off again (data/firebase.ts isGuestUser).
   */
  isAnonymous: boolean;
  /**
   * The account's email address is confirmed: it signed in with Google, or
   * followed the link it was emailed. The free area needs it
   * (lib/emailVerification.ts). Always true where there are no accounts.
   */
  emailVerified: boolean;
}

export interface AuthActionResult {
  /** True when signing up/in recovered an existing account instead of linking — this device's anonymous progress could not be merged. */
  recoveredExistingAccount: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  linkAnonymousAccount: (input: LinkInput) => Promise<AuthActionResult>;
  /**
   * Emails the signed-in account the link that confirms its address. Rejects
   * with Firebase's own error when it cannot (offline, or Firebase's limit on
   * emails to one address).
   */
  sendConfirmationEmail: () => Promise<void>;
  /**
   * Asks whether the address has been confirmed since this page last heard,
   * and tells every screen if it has. Resolves true when it is confirmed.
   */
  checkEmailConfirmed: () => Promise<boolean>;
  /**
   * "Use a different email": takes the unconfirmed sign-in off the account,
   * leaving a guest with the same uid and everything stored under it, so the
   * account can be made again with another address.
   */
  removeUnconfirmedEmail: () => Promise<void>;
}

const NOT_AVAILABLE_LOCALLY = async (): Promise<never> => {
  throw new Error(
    'Real sign-in requires a configured Firebase project (VITE_PERSISTENCE=firestore) — see .env.example.',
  );
};

/** Local dev mode never touches Firebase, so these actions are unreachable no-ops/errors — the UI gates on persistence mode instead of calling them. */
const LOCAL_ACTIONS: Omit<AuthContextValue, keyof AuthState> = {
  signInWithGoogle: NOT_AVAILABLE_LOCALLY,
  signInWithEmail: NOT_AVAILABLE_LOCALLY,
  signUpWithEmail: NOT_AVAILABLE_LOCALLY,
  linkAnonymousAccount: NOT_AVAILABLE_LOCALLY,
  signOut: async () => {},
  sendConfirmationEmail: NOT_AVAILABLE_LOCALLY,
  checkEmailConfirmed: async () => true,
  removeUnconfirmedEmail: NOT_AVAILABLE_LOCALLY,
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  ...LOCAL_ACTIONS,
});

const LOCAL_USER_ID_KEY = 'anatomy-revision:v1:local-user-id';

function getOrCreateLocalUserId(): string {
  const existing = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (existing) return existing;
  const generated = `local-${crypto.randomUUID()}`;
  localStorage.setItem(LOCAL_USER_ID_KEY, generated);
  return generated;
}

/** `isGuestUser` without importing data/firebase statically: this file must not pull the SDK into a build with no accounts. */
function isGuest(user: User): boolean {
  return user.isAnonymous || (Array.isArray(user.providerData) && user.providerData.length === 0);
}

function toAuthUser(user: User): AuthUser {
  const guest = isGuest(user);
  return {
    uid: user.uid,
    displayName: user.displayName,
    // An account that has taken its sign-in off again has no address either,
    // whatever Firebase still remembers of the old one.
    email: guest ? null : user.email,
    isAnonymous: guest,
    emailVerified: !guest && user.emailVerified === true,
  };
}

/**
 * WHO IS TOLD WHEN A GUEST BECOMES AN ACCOUNT.
 *
 * "Create account" from a guest LINKS the new sign-in to the guest's
 * session: the uid is kept, which is what carries their progress over. And
 * because the uid is kept, Firebase does not count it as a change of user:
 * `onAuthStateChanged` — the one thing this provider listened to — fires for
 * sign-in and sign-out and says nothing about a link. So the account was
 * made, and every screen went on being told `isAnonymous: true` until the
 * page was reloaded: Account kept "this device only, until you create an
 * account", the sidebar kept offering "Create account", and the profile
 * document kept `isAnonymous: true` and no email for an educator to see.
 *
 * Each action below therefore hands the user it ended with to whichever
 * provider is mounted, which takes it up when it is the SAME account seen
 * differently (see `adopt` in AuthProvider). A different account arrives by
 * the listener as it always did.
 *
 * CONFIRMING AN EMAIL ADDRESS is the same kind of change and is told the same
 * way: the uid is kept, Firebase's listener says nothing, and the screen that
 * is waiting for it ("Check your inbox") must be told by whoever found out.
 */
const linkedUserListeners = new Set<(user: User) => void>();

function announce<T extends { user: User }>(result: T): T {
  for (const listener of linkedUserListeners) listener(result.user);
  return result;
}

const FIRESTORE_ACTIONS: Omit<AuthContextValue, keyof AuthState> = {
  signInWithGoogle: async () => {
    const { signInWithGoogle } = await import('../data/firebase');
    const result = announce(await signInWithGoogle());
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signInWithEmail: async (email, password) => {
    const { signInWithEmail } = await import('../data/firebase');
    const result = announce(await signInWithEmail(email, password));
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signUpWithEmail: async (email, password) => {
    const { signUpWithEmail } = await import('../data/firebase');
    const result = await signUpWithEmail(email, password);
    // A NEW account, made here: it confirms its address before its free area
    // (lib/emailVerification.ts), and the link is on its way before the
    // screen that asks for it is even drawn. Noted BEFORE the screens are
    // told there is an account, so the first thing they see is the truth.
    // If the email cannot be sent the account still exists: the screen that
    // asks for the confirmation says it was not sent and offers to send it.
    if (!result.recoveredExistingAccount && !result.user.emailVerified) {
      markConfirmationRequired(result.user.uid, result.user.email);
      try {
        const { sendConfirmationEmail } = await import('../data/emailConfirmation');
        await sendConfirmationEmail();
        recordConfirmationSent(result.user.uid, result.user.email);
      } catch (error) {
        console.warn('The confirmation email was not sent:', error);
      }
    }
    announce(result);
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signOut: async () => {
    const { signOutUser } = await import('../data/firebase');
    // The areas saved on this device were granted to the account that is
    // leaving, and the next person to open this browser is not that account.
    // Deleted BEFORE signing out, so a failure to sign out cannot leave them
    // behind; the loader also drops any other account's copies on the next
    // load, which covers a sign-out that never reached this line. Only a
    // build that fetches facts has anything saved (data/contentCache.ts).
    await BUNDLED_CONTENT.loader?.purgeAll();
    await signOutUser();
  },
  linkAnonymousAccount: async (input) => {
    const { linkAnonymousAccount } = await import('../data/firebase');
    const result = announce(await linkAnonymousAccount(input));
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  sendConfirmationEmail: async () => {
    const { sendConfirmationEmail } = await import('../data/emailConfirmation');
    const { uid, email } = await sendConfirmationEmail();
    recordConfirmationSent(uid, email);
  },
  checkEmailConfirmed: async () => {
    const { reloadSignedInUser } = await import('../data/emailConfirmation');
    const user = await reloadSignedInUser();
    if (!user) return false;
    announce({ user });
    return user.emailVerified;
  },
  removeUnconfirmedEmail: async () => {
    const { removeEmailSignIn } = await import('../data/emailConfirmation');
    const user = await removeEmailSignIn();
    if (!user) return;
    clearConfirmationRecord(user.uid);
    announce({ user });
  },
};

/**
 * Resolves the current user and exposes real sign-in/sign-up/link actions.
 *
 * - VITE_PERSISTENCE=firestore: auto-signs in anonymously on first load
 *   (zero friction), then reacts to Firebase auth state — including the
 *   transition when an anonymous session gets linked to a real account, in
 *   which case the uid is unchanged so users/{uid}/** data carries over
 *   automatically. Every non-null auth state also touches the users/{uid}
 *   profile doc (create on first sight, refresh lastActiveAt after).
 * - VITE_PERSISTENCE=local (default): a locally-generated synthetic user —
 *   no Firebase project needs to exist for local dev. Sign-in/link actions
 *   throw; the UI is expected to hide those entry points in this mode
 *   rather than surface a broken button.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  // What the screens were last told, for `adopt` to compare with: read when
  // an action finishes, which is not when this component renders.
  const told = useRef<AuthUser | null>(null);
  told.current = state.user;

  useEffect(() => {
    let cancelled = false;
    const mode = import.meta.env.VITE_PERSISTENCE ?? 'local';

    if (mode !== 'firestore') {
      setState({
        // No accounts in this build, so nothing to confirm: see lib/emailVerification.ts.
        user: { uid: getOrCreateLocalUserId(), displayName: null, email: null, isAnonymous: true, emailVerified: true },
        loading: false,
      });
      return;
    }

    let unsubscribe: (() => void) | undefined;

    /**
     * Takes up the user an action ended with — but only when it is the
     * account the screens already have, now seen differently: a guest that
     * has just been linked. A DIFFERENT uid is a sign-in, the listener below
     * is about to report it, and taking it here as well would write the
     * profile twice. The same account unchanged is nothing to do.
     */
    const adopt = (user: User) => {
      const before = told.current;
      if (cancelled || !before || before.uid !== user.uid) return;
      const after = toAuthUser(user);
      if (
        before.isAnonymous === after.isAnonymous
        && before.email === after.email
        && before.displayName === after.displayName
        && before.emailVerified === after.emailVerified
      ) return;
      // Confirmed: there is nothing left for this device to remember about
      // the email that asked for it.
      if (after.emailVerified) clearConfirmationRecord(after.uid);
      told.current = after;
      setState({ user: after, loading: false });
      // The profile says who this is to an educator and to the account
      // scripts. A reload would have refreshed it; so must this.
      import('../data/firebase')
        .then(({ touchUserProfile }) => touchUserProfile(user))
        .catch((error) => console.error('Failed to write user profile:', error));
    };
    linkedUserListeners.add(adopt);

    import('../data/firebase').then(({ subscribeToAuthState, ensureAnonymousUser, touchUserProfile }) => {
      if (cancelled) return;
      // Which report from Firebase is the latest: settling a confirmed
      // address takes a moment, and an older report must not land on top of
      // a newer one.
      let latest = 0;
      unsubscribe = subscribeToAuthState((user) => {
        if (cancelled) return;
        const mine = ++latest;
        if (user) {
          touchUserProfile(user).catch((error) => console.error('Failed to write user profile:', error));
          // A confirmed address is only reported once the token the database
          // reads says so too (data/firebase.ts confirmedForRules): the first
          // thing a confirmed account does may be to choose its free area.
          const tell = () => {
            if (cancelled || mine !== latest) return;
            const next = toAuthUser(user);
            if (next.emailVerified) clearConfirmationRecord(next.uid);
            setState({ user: next, loading: false });
          };
          if (user.emailVerified) {
            import('../data/emailConfirmation').then(({ confirmedForRules }) => confirmedForRules(user)).then(tell, tell);
          } else tell();
        } else {
          setState({ user: null, loading: true });
          ensureAnonymousUser().catch((error) => {
            console.error('Anonymous sign-in failed:', error);
            if (!cancelled) setState({ user: null, loading: false });
          });
        }
      });
    });

    return () => {
      cancelled = true;
      linkedUserListeners.delete(adopt);
      unsubscribe?.();
    };
  }, []);

  const mode = import.meta.env.VITE_PERSISTENCE ?? 'local';
  const actions = mode === 'firestore' ? FIRESTORE_ACTIONS : LOCAL_ACTIONS;

  return <AuthContext.Provider value={{ ...state, ...actions }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
