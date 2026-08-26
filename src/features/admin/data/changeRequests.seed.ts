import type { ChangeRequest } from '../types/changeRequest';

/**
 * Version-controlled backlog for the /admin/changes screen. This file is the
 * source of truth for the project's change requests — the Firestore
 * `changeRequests` collection is just a mirror of it, populated by
 * `scripts/seedChangeRequests.ts` (idempotent: only creates docs whose `ref`
 * doesn't already exist there, so re-running after editing this file never
 * clobbers status/notes an admin has since changed in the live app).
 *
 * CR-001 and CR-003's `prompt` fields are reconstructed from this project's
 * README/commit history, not the literal original prompt text (the Change
 * Register didn't exist yet when they were done) — see each entry's `notes`.
 */
export const CHANGE_REQUESTS_SEED: ChangeRequest[] = [
  {
    ref: 'CR-001',
    title: 'Real Firebase auth (Google + email/password)',
    category: 'auth',
    priority: 'p0',
    effort: 'm',
    status: 'completed',
    description:
      'Replace the anonymous-only local-storage identity with real Firebase Authentication: silent anonymous sign-in on first visit, ' +
      'plus Google and email/password sign-up that link the anonymous session (preserving uid, and therefore every users/{uid}/** doc) ' +
      'rather than starting a fresh account.',
    prompt:
      'Add real Firebase Authentication to this app. Requirements:\n' +
      '- New visitors are silently signed in via Anonymous Auth, no login wall.\n' +
      '- Add Google sign-in and email/password sign-up/sign-in, reachable from the sidebar account section.\n' +
      '- When a signed-in-anonymously user signs up, link the credential to the existing anonymous account ' +
      '(linkWithPopup/linkWithCredential) so their uid — and every users/{uid}/** Firestore doc — carries over untouched, ' +
      'instead of starting a new empty account.\n' +
      '- Handle auth/credential-already-in-use: sign into the existing account instead, and tell the user this device\'s ' +
      'progress could not be merged.\n' +
      '- Write/refresh a users/{uid} profile doc (displayName, email, isAnonymous, createdAt, lastActiveAt) on every sign-in.\n' +
      '- Update firestore.rules so users/{uid} and its subcollections are owner-only.\n' +
      'This only needs to run when VITE_PERSISTENCE=firestore — local dev mode should stay Firebase-free.',
    dependsOn: [],
    createdAt: '2026-08-18T09:00:00.000Z',
    startedAt: '2026-08-18T09:15:00.000Z',
    completedAt: '2026-08-20T17:30:00.000Z',
    notes: 'Prompt text reconstructed from the README\'s "Persistence" section — the Change Register did not exist yet when this shipped.',
  },
  {
    ref: 'CR-003',
    title: 'Client-side routing for every top-level screen',
    category: 'infrastructure',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'Introduce react-router-dom and give every top-level screen (Today, Study, Atlas, Progress) and the structure detail card ' +
      'a real, linkable URL, superseding the original v1 decision to keep all view state in memory with no router.',
    prompt:
      'Add react-router-dom to this app and give every top-level screen its own route: "/" (Today), "/study" (region picker), ' +
      '"/study/setup", "/atlas", "/progress", and "/structure/:id" for the muscle/bone detail card (with an optional contextIds ' +
      'array carried via router state for the atlas\'s prev/next navigation). Keep the in-session state machine ' +
      '(setup -> in-progress -> results) driving its own full-screen takeover on top of the router rather than folding it into ' +
      'route params. A structure loaded from a direct URL (no router state) should fall back to the Atlas as its "back" target.',
    dependsOn: [],
    createdAt: '2026-08-21T09:00:00.000Z',
    startedAt: '2026-08-21T10:00:00.000Z',
    completedAt: '2026-08-24T16:00:00.000Z',
    notes: 'Prompt text reconstructed from App.tsx\'s own file comment on the routing decision — see StructureRoute\'s doc comment there.',
  },
  {
    ref: 'CR-004',
    title: 'Admin section: Change Register, Users, Analytics placeholder',
    category: 'infrastructure',
    priority: 'p1',
    effort: 'l',
    status: 'inProgress',
    description:
      'Build an /admin/* section behind a custom-claim auth guard: a Change Register (this backlog, browsable and editable in the ' +
      'app instead of only in git), a Users table with per-user drill-down, and a placeholder for the future Analytics screen (CR-005).',
    prompt:
      'Build an admin section for this Vite + React 19 + Firebase 11 app.\n\n' +
      'CURRENT STATE\n' +
      '- react-router-dom is installed with routes for /, /study, /atlas, /progress,\n' +
      '  /structure/:id (CR-003 complete).\n' +
      '- Real Firebase auth with Google + email/password exists (CR-001 complete).\n' +
      '- Tailwind 4 with CSS custom properties (--ink2, --ink3, --pg and others) defined in\n' +
      '  src/index.css and used throughout the components.\n\n' +
      'WHAT TO BUILD\n' +
      '1. ADMIN AUTH\n' +
      '   - Create scripts/setAdmin.ts: a one-off Node script using firebase-admin that sets a\n' +
      '     custom claim { admin: true } on a uid passed as a CLI argument. Document its use in\n' +
      '     the README.\n' +
      '   - Client-side: an <RequireAdmin> route wrapper that reads the ID token result and\n' +
      '     checks token.claims.admin, redirecting to / otherwise.\n' +
      '   - IMPORTANT: the client guard only hides UI. Real enforcement lives in\n' +
      '     firestore.rules — every admin-only collection must require\n' +
      '     request.auth.token.admin == true. Do not rely on the route guard for security.\n' +
      '   - Do NOT use a role field on a Firestore user document for this. That makes rules read\n' +
      '     a document to authorise a document read, which is circular and slow. Custom claims\n' +
      '     are checked from the token with no read.\n\n' +
      '2. ADMIN SHELL at /admin/* with its own sidebar: Change Register, Users, Analytics.\n' +
      '   Reuse the existing design tokens and component patterns — read src/index.css and the\n' +
      '   shared components under components/shared/ first. This should look like part of the\n' +
      '   same product, not a bolted-on dashboard.\n\n' +
      '3. CHANGE REGISTER at /admin/changes.\n' +
      "   Firestore collection `changeRequests`, documents shaped:\n" +
      "     ref        string   'CR-001'\n" +
      '     title      string\n' +
      "     category   'auth' | 'analytics' | 'content' | 'gamification' | 'infrastructure' | 'clinical'\n" +
      "     priority   'p0' | 'p1' | 'p2'\n" +
      "     effort     's' | 'm' | 'l'\n" +
      "     status     'new' | 'inProgress' | 'completed'\n" +
      '     description string\n' +
      '     prompt     string   the full Claude Code prompt, verbatim\n' +
      '     dependsOn  string[] of refs\n' +
      '     createdAt / startedAt / completedAt  timestamp | null\n' +
      '     notes      string\n\n' +
      '   - Table view: ref, title, category, priority, effort, status. Filter by status,\n' +
      '     category and priority. Sort by ref.\n' +
      '   - Row click opens a detail panel with the description and the prompt rendered in a\n' +
      '     monospace block with a copy-to-clipboard button. This is the primary use of the\n' +
      '     screen — make copying the prompt one obvious click.\n' +
      '   - Status editable inline. Moving to inProgress stamps startedAt; moving to completed\n' +
      '     stamps completedAt. Show a warning if an item is set to inProgress while anything in\n' +
      '     dependsOn is not completed — warn, do not block.\n' +
      '   - A "new change request" form covering every field.\n' +
      '   - Seed the collection from a version-controlled file at\n' +
      '     src/features/admin/data/changeRequests.seed.ts, run via an idempotent script that\n' +
      '     only creates documents whose ref does not already exist. The backlog should live in\n' +
      '     git, not only in a database.\n\n' +
      '4. USERS at /admin/users.\n' +
      '   - Table from the users collection: display name, email, total attempts, overall\n' +
      '     accuracy, current streak, last active. Sortable on every column.\n' +
      "   - /admin/users/:uid shows that user's per-region accuracy and ten weakest structures.\n" +
      '   - Leave /admin/analytics as a placeholder — that is CR-005.\n\n' +
      'CONSTRAINTS\n' +
      '- Code-split the admin bundle with React.lazy so students never download it.\n' +
      '- Add Vitest coverage for the status-transition timestamp logic.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.\n' +
      '- A non-admin hitting /admin is redirected, AND a non-admin calling the Firestore\n' +
      '  changeRequests collection directly from the console is denied by rules.',
    dependsOn: ['CR-001', 'CR-003'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-26T08:05:00.000Z',
    completedAt: null,
    notes: '',
  },
  {
    ref: 'CR-005',
    title: 'Analytics dashboard',
    category: 'analytics',
    priority: 'p2',
    effort: 'l',
    status: 'new',
    description:
      'Replace the /admin/analytics placeholder with a real cross-user analytics dashboard: engagement over time, accuracy trends ' +
      'by region/category, and drop-off points in the revision flow.',
    prompt:
      'Not yet drafted — scope out the specific charts/metrics wanted before writing the implementation prompt. Candidates: ' +
      'daily/weekly active users, accuracy trend by region and category over time, question-type performance breakdown, and where ' +
      'students most often abandon a session.',
    dependsOn: ['CR-004'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes: 'Placeholder backlog entry so the Analytics screen\'s "see CR-005" pointer resolves to something real.',
  },
];
