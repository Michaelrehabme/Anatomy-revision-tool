import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AnonymousUserState {
  userId: string | null;
  loading: boolean;
}

const AnonymousUserContext = createContext<AnonymousUserState>({ userId: null, loading: true });

const LOCAL_USER_ID_KEY = 'anatomy-revision:v1:local-user-id';

function getOrCreateLocalUserId(): string {
  const existing = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (existing) return existing;
  const generated = `local-${crypto.randomUUID()}`;
  localStorage.setItem(LOCAL_USER_ID_KEY, generated);
  return generated;
}

/**
 * Resolves a stable per-visitor user id with zero login UI.
 *
 * - VITE_PERSISTENCE=firestore: signs in via Firebase Anonymous Auth
 *   (data/firebase.ts) so Firestore security rules can trust request.auth.uid.
 * - VITE_PERSISTENCE=local (default): a locally-generated id persisted in
 *   localStorage — no Firebase project needs to exist for local dev.
 *
 * Swapping to real (non-anonymous) auth later is a 1:1 replacement of the
 * uid source here; no repository interface change needed.
 */
export function AnonymousUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnonymousUserState>({ userId: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const mode = import.meta.env.VITE_PERSISTENCE ?? 'local';

    if (mode === 'firestore') {
      import('../data/firebase').then(({ ensureAnonymousUser }) => {
        ensureAnonymousUser()
          .then((user) => {
            if (!cancelled) setState({ userId: user.uid, loading: false });
          })
          .catch((error) => {
            console.error('Anonymous sign-in failed:', error);
            if (!cancelled) setState({ userId: null, loading: false });
          });
      });
    } else {
      setState({ userId: getOrCreateLocalUserId(), loading: false });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return <AnonymousUserContext.Provider value={state}>{children}</AnonymousUserContext.Provider>;
}

export function useAnonymousUser(): AnonymousUserState {
  return useContext(AnonymousUserContext);
}
