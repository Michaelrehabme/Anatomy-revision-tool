/**
 * Every path LegalRoutes owns — the gate list in App.tsx AND the source of
 * truth for the route table beside this file.
 *
 * It lives in its own module because a legal page needs BOTH: a path missing
 * from the gate is redirected away by the onboarding check before the router
 * ever sees it, so the page is unreachable from a cold link while looking
 * perfectly correct in LegalRoutes.tsx. Both stores and UK GDPR require these
 * reachable by someone with no account, and a notice nobody can reach is not
 * a published notice.
 *
 * App.tsx imports THIS module and never LegalRoutes, which is lazy: seven
 * strings cost the entry chunk nothing, the legal bundle would cost it plenty.
 * legalRoutes.test.tsx asserts every path here resolves to a real route.
 */
export const LEGAL_PATHS = [
  '/privacy',
  '/terms',
  '/attributions',
  '/accessibility',
  '/refunds',
  '/sources',
] as const;
