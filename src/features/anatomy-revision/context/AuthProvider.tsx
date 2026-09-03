import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { LinkInput } from '../data/firebase';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
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
}

/** Account UI only makes sense once there's a real Firebase project to sign into — local dev stays a plain anonymous id with no dead buttons. */
export const AUTH_ENABLED = (import.meta.env.VITE_PERSISTENCE ?? 'local') === 'firestore';

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

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, displayName: user.displayName, email: user.email, isAnonymous: user.isAnonymous };
}

const FIRESTORE_ACTIONS: Omit<AuthContextValue, keyof AuthState> = {
  signInWithGoogle: async () => {
    const { signInWithGoogle } = await import('../data/firebase');
    const result = await signInWithGoogle();
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signInWithEmail: async (email, password) => {
    const { signInWithEmail } = await import('../data/firebase');
    const result = await signInWithEmail(email, password);
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signUpWithEmail: async (email, password) => {
    const { signUpWithEmail } = await import('../data/firebase');
    const result = await signUpWithEmail(email, password);
    return { recoveredExistingAccount: result.recoveredExistingAccount };
  },
  signOut: async () => {
    const { signOutUser } = await import('../data/firebase');
    await signOutUser();
  },
  linkAnonymousAccount: async (input) => {
    const { linkAnonymousAccount } = await import('../data/firebase');
    const result = await linkAnonymousAccount(input);
    return { recoveredExistingAccount: result.recoveredExistingAccount };
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

  useEffect(() => {
    let cancelled = false;
    const mode = import.meta.env.VITE_PERSISTENCE ?? 'local';

    if (mode !== 'firestore') {
      setState({
        user: { uid: getOrCreateLocalUserId(), displayName: null, email: null, isAnonymous: true },
        loading: false,
      });
      return;
    }

    let unsubscribe: (() => void) | undefined;

    import('../data/firebase').then(({ subscribeToAuthState, ensureAnonymousUser, touchUserProfile }) => {
      if (cancelled) return;
      unsubscribe = subscribeToAuthState((user) => {
        if (cancelled) return;
        if (user) {
          touchUserProfile(user).catch((error) => console.error('Failed to write user profile:', error));
          setState({ user: toAuthUser(user), loading: false });
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
