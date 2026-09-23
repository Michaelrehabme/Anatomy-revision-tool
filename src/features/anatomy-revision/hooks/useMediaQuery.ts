import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, kept live.
 *
 * useSyncExternalStore rather than the useState+useEffect shape of
 * useIsDesktop: matchMedia is an external store, and the effect form has a
 * window between first render and the first effect in which a change is
 * missed. That matters here because the OS appearance can change while the
 * app is open, which is exactly the case this exists to handle.
 *
 * useIsDesktop is deliberately left alone — it decides which of the two render
 * trees mounts, and changing it is a separate, independently revertable thing.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    // No window (never reached in this SPA, but the signature requires it).
    () => false,
  );
}
