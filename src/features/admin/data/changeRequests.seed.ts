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
 * CR-006 and CR-014 to CR-016 are likewise reconstructed: they were tracked in
 * a separate BACKLOG-IMAGES.md document rather than here, so the register
 * disagreed with what had actually been built. Nothing references CR-002.
 *
 * CR-005's `prompt` is reconstructed too: it shipped in the same pass as
 * CR-004 rather than as separately scoped work, so no discrete prompt for it
 * ever existed — see its `notes`.
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
    status: 'completed',
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
    completedAt: '2026-08-26T19:32:55.000Z',
    notes:
      'Analytics was NOT left as a CR-005 placeholder as the prompt specified — it was built out fully in this same pass ' +
      '(structure weakness, distractor analysis, question health, cohort overview), along with the questionReviews/attemptEvents ' +
      'collections and rules it needed. Everything else matches the prompt as scoped: custom-claim auth (scripts/setAdmin.ts, ' +
      'RequireAdmin, firestore.rules), the admin shell, Change Register, and Users + per-user drill-down. Register updated on ' +
      '2026-08-31 after an audit found the code already complete and 135/135 tests + build passing — see CR-005\'s notes for why ' +
      'its entry was rewritten rather than left as an undrafted placeholder.',
  },
  {
    ref: 'CR-005',
    title: 'Analytics dashboard',
    category: 'analytics',
    priority: 'p2',
    effort: 'l',
    status: 'completed',
    description:
      'Cross-user analytics dashboard at /admin/analytics with four views: structure weakness ranking, distractor analysis ' +
      '(including confusion pairs), question health flags, and a cohort overview (active users by day, retention, session metrics).',
    prompt:
      'Not yet drafted at the time CR-004 was scoped — see notes. Reconstructed scope: structure weakness ranking, distractor/' +
      'confusion-pair analysis, question health flagging, and a cohort overview (daily/weekly active users, retention, session ' +
      'metrics), all computed client-side from existing attempt/session data with an explicit migration note for moving to ' +
      'server-side rollups at scale.',
    dependsOn: ['CR-004'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-26T08:05:00.000Z',
    completedAt: '2026-08-26T19:32:55.000Z',
    notes:
      'Originally logged as an undrafted placeholder ("see CR-005") so CR-004\'s pointer resolved to something. It shipped for real ' +
      'in the same commit as CR-004 rather than staying deferred — an audit on 2026-08-31 found the dashboard, its aggregation ' +
      'logic (analyticsAggregation.ts, 20 passing tests), and its supporting Firestore collections/rules already complete, so this ' +
      'entry was rewritten from "new"/undrafted to "completed" to match. See CR-004\'s notes for the same correction on that entry.',
  },
  {
    ref: 'CR-006',
    title: 'Objective correctness scheduling',
    category: 'content',
    priority: 'p2',
    effort: 'm',
    status: 'new',
    description:
      'Drive question scheduling from measured correctness per structure rather than the current fixed rotation, so weak structures ' +
      'resurface sooner and well-known ones stop consuming session time.',
    prompt:
      'Replace the fixed question rotation with scheduling driven by per-structure correctness.\n\n'
      + 'Attempt history already lands in Firestore under users/{uid}/**; use it to weight which structures a session picks, so a\n'
      + 'structure answered wrong recently comes back sooner and one answered right repeatedly comes back later.\n'
      + 'Keep the generator deterministic under a seed (see lib/rng.ts and the generateSet tests) so sessions stay reproducible.',
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Carried over from BACKLOG-IMAGES.md, which tracked CR-006 and CR-014 to CR-016 outside this register. The only one of '
      + 'those four still outstanding.',
  },
  {
    ref: 'CR-014',
    title: 'Locate-the-structure hotspots from the Z-Anatomy renders',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'completed',
    description:
      'The app generated zero locate-the-structure questions: every image shipped with `hotspots: []` and all 122 muscles had '
      + '`eligibility.locate: false`, and buildLocateQuestions needs both. Build a converter from the Blender per-muscle render masks '
      + 'to normalised hotspot polygons, plus a dev-only authoring tool for structures that have no mask.',
    prompt:
      'The app generates no locate-the-structure questions. Two independent causes: every image in images.seed.ts has\n'
      + 'hotspots: [], and all 122 muscles are eligibility.locate: false. Fixing either alone still yields zero.\n\n'
      + 'Build a converter from the untracked Blender per-muscle masks to normalised 0-1 hotspot polygons, and a dev-only\n'
      + 'authoring tool at /dev/hotspots for bones and landmarks, which have no masks.\n\n'
      + 'The masks are SOLO silhouettes, so a deep muscle\'s mask covers ground a superficial one hides in the real image.\n'
      + 'hitTest resolves overlaps smallest-area-wins, so importing raw silhouettes attributes a correct trapezius tap to\n'
      + 'rhomboid minor. Depth-ordered subtraction before tracing is the core of this, not the tracing.\n\n'
      + 'Constraints: do not modify pointInPolygon.ts, normalizeCoordinates.ts, or the existing hotspot.test.ts cases; never\n'
      + 'hand-maintain imageIds; keep images.seed.ts as typed TS; the dev tool must not reach a production build.',
    dependsOn: [],
    createdAt: '2026-08-31T09:00:00.000Z',
    startedAt: '2026-08-31T09:10:00.000Z',
    completedAt: '2026-08-31T15:30:00.000Z',
    notes:
      'Prompt reconstructed from BACKLOG-IMAGES.md and the session that implemented it; that document referenced commit eef8161, '
      + 'which does not exist in this repo, and omitted the eligibility.locate blocker entirely. Shipped 107 polygons over 74 '
      + 'muscles across 15 views. Scope grew twice on evidence: the renders were re-done to include the skeleton (see the '
      + 'README\'s "Image and hotspot status"), because without bone occlusion a student could tap a visibly bony area and be '
      + 'graded as hitting the muscle behind it. 48 muscles remain unreachable without a layered render pass.',
  },
  {
    ref: 'CR-015',
    title: 'Image optimisation',
    category: 'content',
    priority: 'p2',
    effort: 's',
    status: 'completed',
    description:
      'public/anatomy was 26MB, dominated by 14 atlas slides stored as ~1.6MB PNGs, and the 21 muscle panels were 255px and '
      + 'visibly soft on a modern phone.',
    prompt:
      'public/anatomy is 26MB and ships on every visit. The 14 atlas slides are ~1.6MB PNGs each, and the 21 single-muscle\n'
      + 'panel crops are 255px square and visibly soft on a phone. Reduce the payload and fix the softness.',
    dependsOn: ['CR-014'],
    createdAt: '2026-08-31T09:00:00.000Z',
    startedAt: '2026-08-31T15:35:00.000Z',
    completedAt: '2026-08-31T16:10:00.000Z',
    notes:
      'public/anatomy 26MB -> 4.6MB. Atlas slides to webp at quality 90 (labels stay crisp) for 22.2MB -> 1.9MB. The panels were '
      + 'NOT swapped for the 1400px Z-Anatomy isolated renders as originally proposed: those float the muscle alone against white, '
      + 'losing the skeleton context the 255px crops had, which matters more than sharpness for learning where a muscle sits. They '
      + 'were re-rendered in place on the skeleton instead, reusing CR-014\'s pipeline. Also fixed an unanchored .gitignore rule '
      + 'that was silently ignoring public/anatomy/atlas/.',
  },
  {
    ref: 'CR-016',
    title: 'Z-Anatomy render pilot',
    category: 'content',
    priority: 'p2',
    effort: 'm',
    status: 'completed',
    description:
      'Establish whether the Z-Anatomy 3D atlas could be rendered into app imagery, and on what licence terms, before committing '
      + 'to it as the project\'s image source.',
    prompt:
      'Assess whether we can render our own anatomy imagery from the Z-Anatomy Blender model rather than commissioning or\n'
      + 'generating illustrations. Confirm the licence terms and what they oblige us to do, and produce a pilot render.',
    dependsOn: [],
    createdAt: '2026-08-31T09:00:00.000Z',
    startedAt: '2026-08-31T09:10:00.000Z',
    completedAt: '2026-08-31T16:10:00.000Z',
    notes:
      'Answered in the course of CR-014/CR-015 rather than as separate work. Licence is CC BY-SA 4.0, and share-alike reaches the '
      + 'traced polygons as well as the images — see the README\'s "Licensing" section. The pipeline is committed under '
      + 'src/scripts/blender/ and now produces all 15 regional renders and all 21 muscle panels, so this is past pilot stage.',
  },
];
