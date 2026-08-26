import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';

/**
 * Drives which of the two full render trees (desktop/mobile) App.tsx
 * mounts. CSS-only (hidden lg:block / lg:hidden) would mount both trees
 * regardless of viewport, double-firing every screen's data-fetching
 * effects — this hook lets App.tsx render exactly one.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
