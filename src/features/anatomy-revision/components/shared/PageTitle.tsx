import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRouteFocus } from './useRouteFocus';

const APP_NAME = 'LocusMSK';

/**
 * What each route is called in the browser tab and in a screen reader's list
 * of windows (WCAG 2.4.2). Every page used to be "LocusMSK", so nobody could
 * tell two open tabs apart or hear where a navigation had taken them.
 *
 * A structure card is not named here: it knows the structure, and sets
 * "Deltoid · LocusMSK" itself (MuscleCard, MobileMuscleCard).
 */
const TITLES: [prefix: string, title: string][] = [
  ['/onboarding', 'Welcome'],
  ['/study/setup', 'Set up a session'],
  ['/study', 'Study'],
  ['/session/results', 'Session results'],
  ['/session', 'Session'],
  ['/atlas', 'Atlas'],
  ['/progress', 'Progress'],
  ['/account', 'Account'],
  ['/pricing', 'Plans and pricing'],
  ['/diagnostic', 'Diagnostic'],
  ['/achievements', 'Achievements'],
  ['/admin', 'Admin'],
  ['/educator', 'Class dashboard'],
  ['/privacy', 'Privacy policy'],
  ['/terms', 'Terms'],
  ['/attributions', 'Attributions'],
  ['/accessibility', 'Accessibility'],
  ['/refunds', 'Cancellation and refunds'],
  ['/sources', 'Sources'],
];

/** "Atlas · LocusMSK"; the home page, and anything unlisted, is just the name. Null for a structure card. */
export function titleForPath(pathname: string): string | null {
  if (pathname.startsWith('/structure/')) return null;
  const match = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? `${match[1]} · ${APP_NAME}` : APP_NAME;
}

export function structureTitle(name: string): string {
  return `${name} · ${APP_NAME}`;
}

/** Mounted once, beside App, so it covers the legal pages App hands off too. */
export function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = titleForPath(pathname);
    if (title) document.title = title;
  }, [pathname]);
  // The other half of announcing a new page: somewhere for focus to be.
  useRouteFocus(pathname);
  return null;
}
