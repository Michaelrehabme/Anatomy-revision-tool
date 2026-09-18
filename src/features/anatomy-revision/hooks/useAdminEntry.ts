import { useCurrentRole } from '../../roles/useCurrentRole';

/**
 * Whether to offer a way into /admin from the student shell.
 *
 * Until this existed the admin section had no entrance at all: every route
 * under /admin worked, and nothing in the app linked to one, so reaching the
 * Change Register meant typing the URL. That is fine on a laptop and useless
 * on a phone.
 *
 * TWO CONDITIONS, AND THE SECOND IS NOT OPTIONAL.
 *
 * `isAdmin` is the obvious one. The other is the public demo, where
 * `useCurrentRole` is ALIASED to the demo stand-in and returns
 * `{ isAdmin: true }` for every visitor — see educator/demo/adminDemo.tsx. At
 * the same time App.tsx sets `AdminApp = PUBLIC_DEMO ? null : lazy(...)`, so
 * the demo build has no /admin route to arrive at. Gating on `isAdmin` alone
 * would therefore put an Admin tab in front of every course leader trying the
 * demo, and send them to a blank screen.
 *
 * The flag is read here rather than passed in so that the two facts that have
 * to agree — "the route exists" and "the entrance is shown" — sit next to each
 * other and next to this comment.
 *
 * This decides what renders, nothing more. firestore.rules is the boundary: a
 * student who forces this true gets admin screens whose every read fails.
 *
 * WHY THIS FILE IS NOT IN features/roles/. It was, and that shipped the whole
 * Firebase SDK into the public demo. vite.config.ts aliases useCurrentRole to
 * the demo stand-in on a pattern ending `/roles/useCurrentRole`, matched
 * against the import specifier AS WRITTEN. So `../../roles/useCurrentRole` is
 * rewritten, and `./useCurrentRole` -- the natural spelling from inside that
 * directory -- silently is not, pulling in the real module and the SDK behind
 * it. Living here makes the only available spelling the one that matches. The
 * guard is in educator/demo/__tests__/demoIsolation.test.ts.
 */
export function useAdminEntry(): boolean {
  const { isAdmin, loading } = useCurrentRole();
  const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === '1';

  // Hidden while the role is still resolving: an entrance that appears a beat
  // after the page settles reads as a glitch, and admin is one person on their
  // own device, who loses nothing by waiting for the auth round trip.
  return isAdmin && !loading && !publicDemo;
}
