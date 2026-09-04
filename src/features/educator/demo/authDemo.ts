import { useAuth as realUseAuth } from '../../anatomy-revision/context/AuthProvider.tsx';

/**
 * Demo-mode stand-in for context/AuthProvider (README "Educator demo mode").
 *
 * Local mode sets AUTH_ENABLED false, which correctly hides everything needing
 * a real Firebase project — including the account screen's Classes section,
 * the one thing demo mode exists to show. So the flag is forced on.
 *
 * Forcing it on alone was worse than leaving it off: local mode's synthetic
 * user is anonymous, so every screen offered "Create account" and opened a
 * sign-in form whose actions throw in local mode. The demo therefore presents
 * as a settled, signed-in account — the state someone reviewing the class UI
 * is actually in — rather than as a half-signed-in one that invites a click
 * into a dead end.
 *
 * The provider itself is the real one, and the uid stays the real local uid,
 * so anything written during a demo session still belongs to the same person.
 * The explicit .tsx extension is what stops the alias in vite.config.ts from
 * rewriting these imports back to this file.
 */
export { AuthProvider } from '../../anatomy-revision/context/AuthProvider.tsx';
export type { AuthUser } from '../../anatomy-revision/context/AuthProvider.tsx';

export const AUTH_ENABLED = true;

export function useAuth(): ReturnType<typeof realUseAuth> {
  const real = realUseAuth();

  return {
    ...real,
    user: real.user ? { ...real.user, displayName: 'Rory Neary', email: 'nearyomichael@gmail.com', isAnonymous: false } : null,
    // Local mode's signOut is already a no-op; named here so it is obvious that
    // the demo's Sign out button cannot strand someone with no way back in.
    signOut: async () => {},
  };
}
