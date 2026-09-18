import type { ChangeRequest } from '../types/changeRequest';

/**
 * Version-controlled backlog for the /admin/changes screen. This file is the
 * source of truth for the project's change requests — the Firestore
 * `changeRequests` collection is just a mirror of it, populated by
 * `scripts/seedChangeRequests.ts` (idempotent: only creates docs whose `ref`
 * doesn't already exist there, so re-running after editing this file never
 * clobbers status/notes an admin has since changed in the live app).
 *
 * CR-001, CR-002, CR-003 and CR-005's `prompt` fields are reconstructed from
 * this project's README/commit history and a prior audit's backlog document,
 * not the literal prompt text used when the work was actually done (the
 * Change Register didn't exist yet when they shipped) — see each entry's
 * `notes`.
 *
 * CR-018 through CR-021 are reconstructed the same way: they were tracked in
 * a separate BACKLOG-IMAGES.md document and in commit messages on a long-lived
 * feature branch rather than here, so this register only picked them up once
 * that branch was merged.
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
    ref: 'CR-002',
    title: 'Analytics event stream + capture selected answer',
    category: 'analytics',
    priority: 'p0',
    effort: 'm',
    status: 'completed',
    description:
      'Move attempts from a per-user Firestore subcollection (unqueryable across users) to a top-level attemptEvents collection, ' +
      'and record which wrong answer a student picked — not just whether they were right — so distractor analysis becomes possible.',
    prompt:
      'Restructure attempt recording in this Vite + React 19 + Firebase 11 app so that\n' +
      'cross-user analytics becomes possible, and capture which wrong answer was chosen.\n\n' +
      'CURRENT STATE\n' +
      '- src/features/anatomy-revision/types/attempt.ts defines UserAttempt with: id, userId,\n' +
      '  sessionId, questionId, questionType, structureId, promptKind, region, category,\n' +
      '  correct, confidence?, hitDistance?, timestamp, durationMs?.\n' +
      '- src/features/anatomy-revision/hooks/useRevisionSession.ts builds and persists the\n' +
      '  attempt in submitAnswer().\n' +
      '- firestoreRepository.ts writes to users/{uid}/attempts/{attemptId}, which cannot be\n' +
      '  queried across users — Firestore has no cross-subcollection query.\n\n' +
      'WHAT TO BUILD\n' +
      '1. Extend UserAttempt with:\n' +
      '   - selectedAnswer?: string   // the literal choice text for MCQ, the typed string for\n' +
      '                               // fill-blank and identify-typed. Never store an index —\n' +
      '                               // choices are shuffled per session, so an index is\n' +
      '                               // meaningless after the fact.\n' +
      '   - correctAnswer?: string    // denormalised so analytics needs no question lookup\n' +
      '   - attemptNumber: number     // 1 = first time this user has ever seen this questionId\n' +
      '   Populate all three in useRevisionSession.submitAnswer(). Thread the selected value up\n' +
      '   from MCQSession, FillBlankSession and IdentifyTypedSession, which currently only\n' +
      '   report correctness.\n\n' +
      '2. attemptNumber requires knowing prior exposure. Add a `seenQuestionIds` count to the\n' +
      '   mastery record or a lightweight users/{uid}/questionExposure/{questionId} counter —\n' +
      '   pick whichever you judge cheaper given the existing repository shape, and document\n' +
      '   the choice in a comment. This field is what later separates "never learned it" from\n' +
      '   "keeps forgetting it"; without it the two blur together.\n\n' +
      '3. Move attempts from the per-user subcollection to a TOP-LEVEL `attemptEvents`\n' +
      '   collection, with `userId` as a queryable field. Update AnatomyRepository:\n' +
      '   - recordAttempt stays the same signature.\n' +
      '   - Add listAttempts(filter: { userId?, structureId?, questionId?, since?, limit? }).\n' +
      '   Update all three implementations (firestore, local, memory). Mastery and session\n' +
      '   summaries STAY where they are — only attempts move.\n\n' +
      '4. Firestore rules for attemptEvents:\n' +
      '   - create: request.auth != null && request.data.userId == request.auth.uid\n' +
      '   - read: resource.data.userId == request.auth.uid || request.auth.token.admin == true\n' +
      '   - update, delete: never\n' +
      '   Attempts are an append-only event log. Nothing should ever edit one.\n\n' +
      '5. Add composite indexes (firestore.indexes.json) for the query shapes listAttempts\n' +
      '   supports: (userId ASC, timestamp DESC) and (structureId ASC, timestamp DESC).\n\n' +
      'CONSTRAINTS\n' +
      '- Anatomy content stays in the static seed modules.\n' +
      '- Existing Vitest coverage must keep passing; add cases for attemptNumber increment and\n' +
      '  for selectedAnswer being captured on a wrong MCQ answer.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test passes, npm run build passes.\n' +
      '- A wrong MCQ answer persists the exact distractor text the student clicked.',
    dependsOn: [],
    createdAt: '2026-08-19T09:00:00.000Z',
    startedAt: '2026-08-19T09:30:00.000Z',
    completedAt: '2026-08-21T12:00:00.000Z',
    notes: 'Prompt text reconstructed from a prior audit\'s backlog document — the Change Register did not exist yet when this shipped. ' +
      'Had no entry here at all until this reconciliation pass, despite the attemptEvents collection and selectedAnswer/attemptNumber ' +
      'fields already being live in code.',
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
    completedAt: '2026-08-26T18:00:00.000Z',
    notes: 'Was left marked inProgress with no completedAt after shipping — corrected during the 2026-08-26 register reconciliation pass ' +
      '(admin shell, change register and users pages all exist and work).',
  },
  {
    ref: 'CR-005',
    title: 'Admin: cohort weakness analytics',
    category: 'analytics',
    priority: 'p0',
    effort: 'l',
    status: 'completed',
    description:
      'Replace the /admin/analytics placeholder with a real cohort weakness dashboard: a structure weakness table (first-attempt vs ' +
      'overall accuracy), distractor analysis with ranked confusion pairs, question-health flagging, and a cohort overview screen — ' +
      'the module that turns raw attempt data into an actual content roadmap.',
    prompt:
      'Build a cohort weakness analytics dashboard in the admin section of this Vite + React 19\n' +
      '+ Firebase 11 app.\n\n' +
      'CURRENT STATE\n' +
      '- Admin shell exists at /admin/* gated by a Firebase custom claim (CR-004 complete),\n' +
      '  with /admin/analytics currently a placeholder.\n' +
      '- Attempts live in a top-level `attemptEvents` collection (CR-002 complete), each\n' +
      '  carrying: userId, sessionId, questionId, questionType, structureId, promptKind, region,\n' +
      '  category, correct, selectedAnswer?, correctAnswer?, attemptNumber, confidence?,\n' +
      '  hitDistance?, timestamp, durationMs?.\n' +
      '- Anatomy content is in static seed modules (ALL_STRUCTURES, ALL_IMAGES) from\n' +
      '  src/features/anatomy-revision/data/seed/index.ts — join against these in memory rather\n' +
      '  than denormalising structure names into Firestore.\n\n' +
      'WHAT TO BUILD\n' +
      '1. An AnalyticsSource interface with one implementation, ClientAggregatedAnalytics, that\n' +
      '   queries attemptEvents (capped, most recent N, configurable, default 20000) and\n' +
      '   aggregates in memory. Isolate ALL aggregation behind this interface so it can later be\n' +
      '   swapped for a Cloud Functions pre-aggregated version without touching any UI. Write a\n' +
      '   comment at the top of the file stating that migration path and the volume at which it\n' +
      '   becomes necessary.\n\n' +
      '2. STRUCTURE WEAKNESS TABLE — every structure, worst first:\n' +
      '   - total attempts, accuracy\n' +
      '   - first-attempt accuracy (attemptNumber === 1) vs overall accuracy, side by side.\n' +
      '     A structure with low first-attempt but high overall accuracy is being learned. One\n' +
      '     with high first-attempt but low overall is being forgotten. These need completely\n' +
      '     different teaching responses and the dashboard should make the difference visible\n' +
      '     at a glance.\n' +
      '   - distinct users who attempted it\n' +
      '   - mean answer time\n' +
      '   Filter by region, category and question type. Exclude structures below a configurable\n' +
      '   minimum attempt threshold (default 5) so noise does not dominate the top of the table.\n\n' +
      '3. DISTRACTOR ANALYSIS — the highest-value screen here.\n' +
      '   For each question with wrong answers, group selectedAnswer values by frequency and\n' +
      '   render the top wrong answers with counts. Then surface a CONFUSION PAIRS view across\n' +
      '   the whole dataset: ranked pairs of (correctAnswer, selectedAnswer) sorted by\n' +
      '   frequency. That list is a direct content roadmap — each frequent pair is a\n' +
      '   distinction students are not making, and a question worth writing.\n\n' +
      '4. QUESTION HEALTH — flag questions where the statistics suggest the question is the\n' +
      '   problem rather than the student:\n' +
      '   - accuracy below 25% with 10+ attempts (likely ambiguous or wrong)\n' +
      '   - accuracy above 98% with 20+ attempts (no discriminatory value)\n' +
      '   - mean answer time in the top decile despite high accuracy (unclear wording)\n' +
      '   Each flagged question gets a "mark reviewed" action writing to a questionReviews\n' +
      '   collection so the same items do not resurface indefinitely.\n\n' +
      '5. COHORT OVERVIEW — active users over time, mean session length, completion rate,\n' +
      '   accuracy by region as a bar chart, retention (share of users returning after 1, 7 and\n' +
      '   30 days).\n\n' +
      'CONSTRAINTS\n' +
      '- Admin-only Firestore rules on every collection touched here.\n' +
      '- Show a clear loading state; these queries are not instant.\n' +
      '- Cache aggregation results in memory for the session — do not re-query on every tab\n' +
      '  switch.\n' +
      '- Add Vitest coverage for the aggregation functions using synthetic attempt arrays.\n' +
      '  These are pure functions and belong in lib/ alongside the existing tested code.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.\n' +
      '- The confusion-pairs view correctly ranks a synthetic dataset where supraspinatus is\n' +
      '  wrongly answered as infraspinatus 38 times.',
    dependsOn: ['CR-002', 'CR-004'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-26T08:10:00.000Z',
    completedAt: '2026-08-26T19:00:00.000Z',
    notes: 'Entry previously carried a placeholder "not yet drafted" prompt and status "new" despite the real dashboard already being ' +
      'built (StructureWeaknessScreen, DistractorAnalysisScreen, ConfusionPairsList, QuestionHealthPanel, CohortOverviewScreen all exist) ' +
      '— corrected during the 2026-08-26 register reconciliation pass, including bumping priority from the placeholder p2 to the ' +
      'backlog doc\'s actual p0 and adding the CR-002 dependency.',
  },
  {
    ref: 'CR-006',
    title: 'Objective correctness drives review scheduling',
    category: 'content',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'Make MCQ/fill-blank/identify-typed/locate answers — not just self-rated flashcards — drive the spaced-repetition schedule, ' +
      'by deriving an implicit confidence from correctness and answer speed when no explicit rating is given. Also adds a lapse ' +
      'counter and leech flagging, and fixes an N+1 Firestore read in the answer path.',
    prompt:
      'Make objective question correctness drive the spaced-repetition schedule in this\n' +
      'Vite + React 19 app.\n\n' +
      'CURRENT STATE\n' +
      '- src/features/anatomy-revision/lib/mastery.ts implements SM-2-lite. computeNextReview\n' +
      "  takes a Confidence ('easy' | 'medium' | 'hard') and adjusts intervalDays and\n" +
      '  easeFactor. updateMasteryAfterAttempt returns early WITHOUT touching intervalDays or\n' +
      '  easeFactor when params.confidence is undefined.\n' +
      '- useRevisionSession.submitAnswer only calls upsertMastery inside `if (record.confidence)`.\n' +
      '- Consequence: MCQ, fill-blank, locate and identify-typed answers update attempt counts\n' +
      '  but never the review schedule. Only flashcards, which are self-rated, schedule anything.\n' +
      '- lib/__tests__/mastery.test.ts has 4 existing tests that must keep passing.\n\n' +
      'WHAT TO BUILD\n' +
      '1. Derive a quality signal from objective answers where no confidence rating exists:\n' +
      "   - correct and fast (durationMs below the structure's rolling median) -> treat as 'easy'\n" +
      "   - correct and slow -> treat as 'medium'\n" +
      "   - incorrect -> treat as 'hard'\n" +
      '   Hesitation is real evidence. A student who takes eleven seconds to get it right does\n' +
      '   not know it as well as one who answers in two, and the schedule should reflect that.\n\n' +
      '2. Where an explicit confidence rating IS given (flashcards), that still wins. Self-report\n' +
      '   plus objective evidence beats objective evidence alone.\n\n' +
      '3. Remove the `if (record.confidence)` guard in useRevisionSession.submitAnswer so mastery\n' +
      '   updates on every answer.\n\n' +
      '4. PERFORMANCE — submitAnswer currently calls repository.getMastery(userId), which fetches\n' +
      '   the ENTIRE mastery subcollection, on every single answer. On Firestore that is one full\n' +
      '   collection read per question. Add getMasteryForStructure(userId, structureId) to\n' +
      '   AnatomyRepository and use it here. Implement across firestore, local and memory\n' +
      '   repositories.\n\n' +
      '5. Add a `lapses` counter to StructureMastery, incremented whenever a structure that had\n' +
      '   reached an interval of 7+ days is answered incorrectly. Repeated lapses are the signal\n' +
      '   for the leech handling in point 6.\n\n' +
      '6. Leech handling: a structure with 4+ lapses should be flagged `isLeech: true`, surfaced\n' +
      '   distinctly on the Progress screen, and its interval capped rather than allowed to grow.\n' +
      '   A structure a student keeps forgetting needs different treatment from one they are\n' +
      '   steadily learning, and the current algorithm cannot tell them apart.\n\n' +
      'CONSTRAINTS\n' +
      '- Keep mastery.ts a pure function module with no React or Firebase imports. It is the\n' +
      '  most valuable tested code in the repo — preserve that property.\n' +
      '- All 4 existing mastery tests must still pass. Add coverage for the derived-quality\n' +
      '  path, the lapse counter and leech flagging.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.\n' +
      '- Answering an MCQ incorrectly demonstrably shortens the next review interval.',
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-26T20:00:00.000Z',
    completedAt: '2026-08-27T09:00:00.000Z',
    notes: '',
  },
  {
    ref: 'CR-007',
    title: 'Hotspot authoring tool — locate questions live',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'completed',
    description:
      'Build an in-repo, dev-only hotspot authoring tool so locate-the-structure questions can finally be generated — all 45 images ' +
      'currently have hotspots: [], so the locate question type generates zero of the 1,846 total questions.',
    prompt:
      'Build an in-repo hotspot authoring tool for this Vite + React 19 app so that\n' +
      'locate-the-structure questions can be generated.\n\n' +
      'CURRENT STATE\n' +
      '- 45 images in src/features/anatomy-revision/data/seed/images.seed.ts, every one with\n' +
      '  hotspots: [] — there is not a single polygon in the codebase.\n' +
      '- Consequently lib/questionGenerators/locate.ts generates zero questions.\n' +
      "- Hotspot coordinates are normalised 0-1 against the image's own natural width/height,\n" +
      '  NOT screen pixels. See HotspotPolygon in types/image.ts.\n' +
      '- lib/hotspot/pointInPolygon.ts already implements hit-testing, and when polygons overlap\n' +
      '  the smallest-area structure wins the click — deliberate, so a precise tap on deltoid\n' +
      '  over supraspinatus selects the smaller structure underneath. Tested in\n' +
      '  lib/__tests__/hotspot.test.ts (7 tests).\n' +
      '- components/LocateStructureSession/HotspotOverlay.tsx already renders polygons.\n' +
      '- src/scripts/importHotspots.ts validates an external hotspots.json and prints\n' +
      '  paste-ready TS, cross-referencing structure and image ids.\n' +
      '- Images: 24 multi-panel atlas slides in /public/anatomy/atlas/, 21 single-muscle panels\n' +
      '  in /public/anatomy/panels/.\n\n' +
      'WHAT TO BUILD\n' +
      'A dev-only route at /dev/hotspots, gated behind import.meta.env.DEV so it can never\n' +
      'reach production:\n\n' +
      '1. Image picker listing all images from images.seed.ts, showing hotspot count for each so\n' +
      '   progress is visible at a glance.\n\n' +
      '2. Canvas editor:\n' +
      '   - Click to place polygon vertices; drag existing vertices to adjust; right-click or\n' +
      '     backspace to remove the last one.\n' +
      '   - Assign the polygon to a structure via a searchable dropdown of ALL_STRUCTURES,\n' +
      "     filtered by the image's region by default with an option to show all.\n" +
      '   - Live preview through the existing HotspotOverlay component — reuse it, do not write\n' +
      '     a second renderer that could drift from production behaviour.\n' +
      '   - Show existing polygons on the image, selectable and editable.\n' +
      '   - Zoom and pan, because precise tracing on a 1600px image inside a browser window is\n' +
      '     otherwise painful.\n\n' +
      "3. Coordinates must be normalised against the image's naturalWidth/naturalHeight, never\n" +
      '   the rendered element size. This is the single easiest thing to get wrong here and it\n' +
      '   fails silently — the polygons look correct in the editor and are misaligned in the app.\n' +
      '   Add a test for the conversion.\n\n' +
      '4. Export: a "copy JSON" button producing the exact shape src/scripts/importHotspots.ts\n' +
      '   expects, so the existing import path is reused unchanged.\n\n' +
      '5. A validation pass warning on: self-intersecting polygons, polygons with fewer than 3\n' +
      '   vertices, coordinates outside 0-1, and structures already having a polygon on the same\n' +
      '   image.\n\n' +
      'FIRST CONTENT TARGET\n' +
      'Once the tool works, author hotspots for the 21 single-muscle panel images in\n' +
      '/public/anatomy/panels/ first. They are single-structure and quick, they cover the\n' +
      'clinically important shoulder and hip muscles, and they will produce working locate\n' +
      'questions immediately. The 24 multi-panel atlas slides are a larger job — do them after.\n\n' +
      'CONSTRAINTS\n' +
      '- Dev-only. It must not appear in the production bundle.\n' +
      '- Do not modify pointInPolygon.ts or the existing hotspot tests.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.\n' +
      '- After authoring polygons for the panel images, generateRevisionSet with\n' +
      "  types: ['locate'] returns a non-zero count.",
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T10:00:00.000Z',
    completedAt: '2026-08-27T13:00:00.000Z',
    notes:
      'Tool built at /dev/hotspots (dev-only route). eligibility.locate flipped true for all muscles to match the bones ' +
      "convention — locate.ts already gates per-image on hotspots.length, so this was safe. Authored 4 of 21 single-muscle " +
      'panels (deltoid, trapezius, biceps-brachii, gluteus-maximus) as rough proof-of-concept polygons; remaining 17 panels ' +
      'and all 24 atlas slides still need real authoring via the tool.',
  },
  {
    ref: 'CR-008',
    title: 'XP, levels and achievements',
    category: 'gamification',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'Add a gamification layer built on XP as a shared currency: levels, two tiers of achievements (personal records and ' +
      'milestones), and streak-freeze protection — deliberately no leaderboards. Reworks RevisionResults to show the payoff at the ' +
      'moment attention is highest.',
    prompt:
      'Add a gamification layer to this Vite + React 19 + Firebase 11 anatomy revision app.\n\n' +
      'CURRENT STATE\n' +
      '- lib/streak.ts computes a consecutive-day streak from session summaries. It is the only\n' +
      '  gamification mechanic present, and it is well-tested (7 tests) — do not break it.\n' +
      '- Session results render through components/RevisionResults/RevisionResults.tsx.\n' +
      '- Real user accounts exist (CR-001 complete).\n\n' +
      'WHAT TO BUILD\n' +
      '1. XP as the shared currency tying everything together:\n' +
      '   - base XP per correct answer, scaled by question type (typed recall is worth more than\n' +
      '     recognition — identify-typed and fill-blank should pay more than MCQ, which pays more\n' +
      '     than a self-rated flashcard)\n' +
      '   - a bonus for a first-time-correct answer on a structure\n' +
      '   - a session completion bonus\n' +
      '   - a streak multiplier that grows and caps\n' +
      '   Put all tuning constants in one exported config object so they can be adjusted without\n' +
      '   hunting through the code.\n\n' +
      '2. Levels derived from cumulative XP on a curve that slows down — quick early wins,\n' +
      '   meaningful later ones. Show progress toward the next level in the NavSidebar.\n\n' +
      '3. Achievements, split into two groups so different users have something to chase:\n' +
      '   - Personal records: longest streak, most XP in a day, fastest correct answer, most\n' +
      '     structures mastered in a week\n' +
      '   - Milestones: first region completed, all 122 muscles attempted, 50 structures at\n' +
      '     mastery, 30-day streak, every question type used\n' +
      '   Store as users/{uid}/achievements/{achievementId} with earnedAt. Render an\n' +
      '   achievements screen and show an unobtrusive toast on earning one.\n\n' +
      '4. Streak protection: a streak freeze that automatically consumes on a missed day, earned\n' +
      '   at a rate of one per N consecutive days up to a cap of 2 held. Losing a 40-day streak\n' +
      '   to one placement shift makes students quit — the freeze exists to prevent exactly that.\n\n' +
      '5. Rework RevisionResults to show XP earned, level progress, streak status and any newly\n' +
      '   earned achievements. This is the moment attention is highest and it is currently\n' +
      '   underused.\n\n' +
      'DELIBERATELY NOT IN SCOPE\n' +
      'No leaderboards or leagues. With a small early user base a leaderboard is demotivating\n' +
      'rather than competitive, and public ranking of anatomy performance among coursemates\n' +
      'raises real issues. Revisit only at meaningful scale, and opt-in if at all.\n\n' +
      'CONSTRAINTS\n' +
      '- Keep XP and level calculation as pure functions in lib/ with Vitest coverage, matching\n' +
      '  the existing pattern in mastery.ts and streak.ts.\n' +
      '- Gamification must never alter which questions are asked. Keep it strictly separate\n' +
      '  from the scheduling logic in mastery.ts.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass, existing streak tests unchanged.',
    dependsOn: ['CR-001'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T18:05:00.000Z',
    completedAt: '2026-08-27T19:10:00.000Z',
    notes:
      'XP/level/streak-freeze/achievement logic lives in lib/xp.ts, lib/levels.ts, lib/streakFreeze.ts, lib/achievements.ts — ' +
      'all pure and unit-tested, matching mastery.ts/streak.ts\'s existing pattern. streak.ts kept behavior-identical (its 7 tests ' +
      'untouched); a new computeStreakFromDayKeys export was factored out for streakFreeze.ts to reuse. Wired into ' +
      'useRevisionSession.finish(). Achievements screen reached via a "View achievements" link from Progress (desktop + mobile), ' +
      'not a 5th persistent nav tab — kept NavSidebar/MobileTabBar\'s existing 4-item shape untouched. Level progress shows in ' +
      'NavSidebar via a self-contained component (fetches its own repository/auth context, like AccountSection already does) ' +
      'rather than threading xpTotal through the 7 screens that render NavSidebar.',
  },
  {
    ref: 'CR-009',
    title: 'Adaptive difficulty + study/exam mode split',
    category: 'content',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'Add an adaptive session mode that weights structure selection by due-date, accuracy, leech status and recency, escalates ' +
      'question type (MCQ -> fill-blank -> identify-typed) as mastery grows, and makes study vs exam mode a real, meaningful choice ' +
      'rather than just a set-construction difference.',
    prompt:
      'Add adaptive difficulty and a proper study/exam mode distinction to this Vite + React 19\n' +
      'anatomy revision app.\n\n' +
      'CURRENT STATE\n' +
      "- generateRevisionSet in lib/questionGenerators/generateSet.ts accepts\n" +
      "  mode: 'practice' | 'assessment'. Practice returns every eligible question shuffled;\n" +
      '  assessment returns a random sample of `count`. Beyond set construction the two modes\n' +
      '  behave identically in the UI.\n' +
      '- A Difficulty field exists on structures and is filterable, but nothing adapts it.\n' +
      '- Mastery data (accuracy, intervalDays, easeFactor, lapses) is available per structure\n' +
      '  per user after CR-006.\n' +
      '- 11 existing tests in lib/__tests__/generateSet.test.ts must keep passing.\n\n' +
      'WHAT TO BUILD\n' +
      "1. ADAPTIVE SELECTION — a new mode: 'adaptive'. Weight structure selection by:\n" +
      '   - due date from the mastery record (overdue weighted heaviest)\n' +
      '   - accuracy (weakest weighted heavier)\n' +
      '   - leech status from CR-006 (surface these more, at capped intervals)\n' +
      '   - recency (avoid repeating a structure answered minutes ago)\n' +
      '   Blend in a proportion of well-known structures too — a session that is only weaknesses\n' +
      '   is demoralising and gives no sense of progress. Roughly 70/30 weak to known, tunable\n' +
      '   in one place.\n\n' +
      '2. ADAPTIVE QUESTION TYPE — escalate the retrieval demand as mastery grows for a given\n' +
      '   structure: recognition first (MCQ), then cued recall (fill-blank), then free recall\n' +
      '   (identify-typed). A student who reliably picks the right MCQ option should be made to\n' +
      '   type the name. This is where the real learning gain is, and it is nearly free given\n' +
      '   you already generate all three types.\n\n' +
      '3. MODE SPLIT, made meaningful in the UI:\n' +
      '   - STUDY: immediate feedback with explanation, retry allowed, confidence rating shown,\n' +
      '     schedule updated, no timer.\n' +
      '   - EXAM: no feedback until the end, no retries, optional timer, a scored report at the\n' +
      '     finish with per-region breakdown. Attempts still recorded and still feed the\n' +
      '     schedule, but silently during the session.\n' +
      '   Surface these as a clear choice at setup, not a buried config flag.\n\n' +
      'CONSTRAINTS\n' +
      '- generateRevisionSet must remain deterministic when given a seed — the existing tests\n' +
      '  depend on this and it is what makes the generator testable.\n' +
      '- Adaptive selection needs mastery data, so it must accept it as a parameter rather than\n' +
      '  fetching. Keep generateSet.ts free of repository imports.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass, all 11 generateSet tests unchanged.',
    dependsOn: ['CR-006'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T20:15:00.000Z',
    completedAt: '2026-08-27T21:40:00.000Z',
    notes:
      'lib/adaptiveSelection.ts holds the weighting/blend/escalation logic, pure and tested; generateSet.ts gained a 3rd ' +
      "mode branch, all 11 existing tests unchanged (verified). Study/exam is a real UI split now, not just set construction: " +
      'a shared ExamAnswerFooter component replaces the colour reveal + explanation + confidence-rating flow across ' +
      'MCQ/locate/fill-blank/identify-typed (both desktop and mobile) when in exam mode — flashcards deliberately stay ' +
      'self-rated always, since the flip-and-rate IS the mechanic, not feedback about correctness. Exam adds an optional ' +
      'countdown timer (auto-finishes at zero) and hides the running correct/wrong tally and the immediate "retry missed" ' +
      'shortcut, reusing the existing per-region breakdown in RevisionResults/MobileResults as the scored report.',
  },
  {
    ref: 'CR-010',
    title: 'Clinical layer (dermatomes, myotomes, special tests, palpation)',
    category: 'clinical',
    priority: 'p2',
    effort: 'l',
    status: 'completed',
    description:
      'Add a clinical reasoning layer aimed at physiotherapy/sports therapy students: myotomes, palpation notes, common injuries, ' +
      'special tests and functional context on structures, new clinical question types exploiting the existing byAction/byNerve ' +
      'reverse indexes, and a multi-select question type. Shoulder-arm region first as a complete vertical slice.',
    prompt:
      'Add a clinical reasoning layer to this Vite + React 19 musculoskeletal anatomy app,\n' +
      'aimed at physiotherapy and sports therapy students rather than medical students.\n\n' +
      'CURRENT STATE\n' +
      '- 285 structures: 122 muscles, 29 bones, 134 landmarks, across 5 regions.\n' +
      '- Muscle data comes from data/source/muscles.raw.json (schemaVersion\'d, with precomputed\n' +
      '  byAction and byNerve reverse indexes) transformed into structures.muscles.seed.ts.\n' +
      '  DO NOT hand-edit the muscles seed file — it is a transform. Extend the raw JSON and the\n' +
      '  transform.\n' +
      '- Bones and landmarks ARE hand-authored in their own seed files.\n' +
      '- PromptKind in types/question.ts currently: identify | origin | insertion | nerve |\n' +
      '  action | attachment | articulation | group-membership.\n' +
      '- Two structures carry needsReview: true (rhomboid-major, internal-intercostals).\n\n' +
      'WHAT TO BUILD\n' +
      '1. Extend the structure types with optional clinical fields:\n' +
      "   - myotome?: string[]        e.g. ['C5','C6']\n" +
      '   - dermatomeRelation?: string\n' +
      '   - palpationNotes?: string   how to actually find it on a person\n' +
      '   - commonInjuries?: { name, mechanism, presentation }[]\n' +
      '   - specialTests?: { name, description, positiveFinding }[]\n' +
      '   - referredPainPattern?: string\n' +
      '   - functionalContext?: string   which everyday or sporting movements load it\n' +
      '   All optional. Existing content must remain valid without them.\n\n' +
      "2. New PromptKind values and matching generators: 'myotome', 'palpation',\n" +
      "   'special-test', 'injury-mechanism', 'functional'.\n\n" +
      '3. New question shapes that exploit the existing reverse indexes:\n' +
      '   - "Select ALL muscles innervated by the ulnar nerve" (multi-select, from byNerve)\n' +
      '   - "Which of these does NOT contribute to shoulder abduction" (from byAction)\n' +
      '   - "A patient cannot resist elbow flexion with the forearm pronated. Which muscle is\n' +
      '     most likely involved?" (clinical vignette to structure)\n' +
      '   - "Which special test assesses supraspinatus integrity?"\n' +
      '   The multi-select type is new — add it to QuestionType, build a session component\n' +
      '   matching the existing ones, and score it partially rather than all-or-nothing.\n\n' +
      '4. Content authoring: start with the shoulder-arm region (38 structures) as a complete\n' +
      '   vertical slice, so one region is fully clinical before spreading thin across five.\n\n' +
      '5. Resolve the two outstanding needsReview flags while working through the data.\n\n' +
      'CONSTRAINTS\n' +
      '- Muscle content changes go into data/source/muscles.raw.json and its transform, never\n' +
      '  into structures.muscles.seed.ts directly.\n' +
      '- Run npm run validate-content after content changes.\n' +
      "- Clinical content must be accurate. Where a special test's sensitivity or specificity is\n" +
      '  disputed in the literature, say so in the content rather than presenting one figure as\n' +
      '  settled — students will carry this into practice.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build and npm run validate-content all pass.',
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T22:15:00.000Z',
    completedAt: '2026-08-27T23:20:00.000Z',
    notes:
      'All seven clinical fields (myotome, dermatomeRelation, palpationNotes, commonInjuries, specialTests, referredPainPattern, ' +
      'functionalContext) added as optional on the shared AnatomyStructureBase. Five new PromptKinds (myotome, palpation, ' +
      'special-test, injury-mechanism, functional) plus a new multi-select QuestionType, each with its own generator gated on ' +
      'the structure actually having that field authored — no invented content to force coverage. Multi-select reuses the ' +
      'existing byNerve/byAction reverse indexes and pickStructureDistractors rather than new indexing, and is scored with ' +
      'partial credit ((correct-incorrect)/total, clamped 0-1) shown in the UI, while the correct/incorrect flag fed to ' +
      'mastery/XP scheduling stays a binary "selected exactly the right set" — a deliberate scope limit rather than threading ' +
      'fractional scores through UserAttempt/RevisionSessionSummary, which only support boolean correctness. MultiSelectSession ' +
      '/ MobileMultiSelectSession follow the existing session-component pattern exactly, including exam-mode support (CR-009) ' +
      "via the shared ExamAnswerFooter, and are wired into StudySession/MobileStudySession and RevisionSetup/MobileRevisionSetup's " +
      'format pickers. Content authored as a hand-curated CLINICAL_CONTENT lookup in structures.muscles.seed.ts, following the ' +
      'EXTRA_ALIASES/PHONETIC_SPELLINGS precedent (never edited into muscles.raw.json). Scoped to 9 shoulder-arm muscles with ' +
      'genuinely well-established content rather than all 38 shoulder-arm structures: deltoid, the 4 rotator cuff muscles ' +
      '(supraspinatus, infraspinatus, teres minor, subscapularis), biceps brachii, triceps brachii, latissimus dorsi, and ' +
      'pectoralis major — bones/landmarks in the region were left out since commonInjuries/specialTests are a muscle-testing ' +
      "concept, not a bone one. myotome is intentionally restricted to the ~3 muscles genuinely used in the standard bedside " +
      'myotome exam (deltoid=C5, biceps=C5/C6, triceps=C7) — the rotator cuff muscles have real C5-C6 nerve root contributions ' +
      'but are NOT part of that specific clinical convention, so they deliberately have no myotome field, per the prompt\'s own ' +
      '"clinical content must be accurate" constraint. referredPainPattern only added for supraspinatus/infraspinatus, where a ' +
      'trigger-point referral pattern is genuinely textbook (Travell & Simons), not invented for every muscle. The two ' +
      'outstanding needsReview flags (rhomboid-major, internal-intercostals) mentioned in this CR\'s own "current state" were ' +
      'already resolved earlier, during CR-013 — nothing further needed there. npm run test (239 passed), npm run build, ' +
      'npm run lint, and npm run validate-content (285 structures, 0 errors/warnings) all pass.',
  },
  {
    ref: 'CR-011',
    title: 'Audio pronunciation',
    category: 'content',
    priority: 'p2',
    effort: 's',
    status: 'completed',
    description:
      'Add a pronunciation button using the Web Speech API by default, an optional audioUrl override field for later hand-recorded ' +
      'audio, and phonetic respellings for all 122 muscles.',
    prompt:
      'Add audio pronunciation to this Vite + React 19 anatomy app.\n\n' +
      'CURRENT STATE\n' +
      '- 285 structures with `name` and `aliases` fields in the seed data.\n' +
      '- MuscleCard.tsx renders the structure detail view; StructureFactsPanel.tsx shows facts.\n\n' +
      'WHAT TO BUILD\n' +
      '1. A pronunciation button on MuscleCard and StructureFactsPanel.\n' +
      '2. Use the Web Speech API (SpeechSynthesisUtterance) as the default — zero assets, zero\n' +
      '   cost, works offline, available everywhere. Accept that it mangles some Latin terms.\n' +
      '3. Add an optional audioUrl field to the structure type so hand-recorded audio can\n' +
      '   override synthesis per structure later, starting with the terms synthesis handles\n' +
      '   worst. Do not record anything now.\n' +
      '4. Add a phonetic respelling field (e.g. "flexor hallucis longus" ->\n' +
      '   "FLEK-sor ha-LOO-sis LONG-us") displayed alongside the name. For many students this is\n' +
      '   more useful than the audio itself, since it survives being read silently. Author these\n' +
      '   for the 122 muscles.\n' +
      '5. Handle the API being unavailable gracefully — hide the button rather than erroring.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.',
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T21:45:00.000Z',
    completedAt: '2026-08-27T22:10:00.000Z',
    notes:
      'phoneticSpelling?/audioUrl? added to the shared AnatomyStructureBase (bones/landmarks leave it undefined, same as ' +
      'latin?/clinical?). Phonetics authored as a PHONETIC_SPELLINGS lookup in structures.muscles.seed.ts, following the ' +
      "EXTRA_ALIASES precedent already in that file, rather than editing muscles.raw.json (that file is a verbatim, " +
      'regenerable copy — see its own header comment). All 122 muscles covered, verified by script. lib/pronunciation.ts ' +
      'wraps the Web Speech API, prefers audioUrl when present, falls back to speech if a recorded clip 404s, and the ' +
      'shared PronounceButton renders nothing when neither is available. Wired into MuscleCard, MobileMuscleCard, and ' +
      'StructureFactsPanel per the prompt — note StructureFactsPanel itself has no current callers anywhere in the app ' +
      '(dead code predating this CR), flagged to the user rather than silently left as-is or newly wired up elsewhere.',
  },
  {
    ref: 'CR-012',
    title: 'Educator/cohort mode',
    category: 'infrastructure',
    priority: 'p2',
    effort: 'l',
    status: 'completed',
    description:
      'Add a third role (educator, via custom claim, scoped to named cohorts) and a cohort dashboard reusing CR-005\'s aggregation ' +
      'functions: structure weakness and confusion pairs scoped to a cohort, per-student drill-down, and join/leave-code cohort ' +
      'membership. Educators see aggregated performance only, never raw session logs.',
    prompt:
      'Add educator/cohort functionality to this Vite + React 19 + Firebase 11 anatomy app.\n\n' +
      'CURRENT STATE\n' +
      '- users/{uid} profile documents already carry a `cohort` field, currently always null\n' +
      '  (added in CR-001 as a placeholder for this).\n' +
      '- Admin analytics with cross-user aggregation exists (CR-005 complete) — reuse those\n' +
      '  aggregation functions rather than writing parallel ones.\n' +
      '- Admin access is gated by a Firebase custom claim { admin: true }.\n\n' +
      'WHAT TO BUILD\n' +
      '1. A THIRD ROLE. There are currently two (student, admin). Add educator via a custom\n' +
      '   claim { educator: true, cohorts: string[] } — an educator sees their own cohorts only,\n' +
      '   never the whole platform and never the change register.\n\n' +
      '2. Cohorts collection: { id, name, institution, ownerUid, joinCode, createdAt,\n' +
      '   archivedAt }. Students join via a code entered in their account settings, which sets\n' +
      '   users/{uid}.cohort. Joining must be explicit and revocable by the student.\n\n' +
      '3. EDUCATOR DASHBOARD at /educator:\n' +
      '   - cohort overview: active students, mean accuracy, engagement over time\n' +
      '   - the structure weakness table from CR-005, scoped to the cohort — this is the thing\n' +
      '     educators actually want, because it tells them what to reteach before the exam\n' +
      '   - the confusion-pairs view, scoped to the cohort\n' +
      '   - per-student view: accuracy, streak, weakest structures, last active\n' +
      '   - assignments: set a region and deadline, track completion\n\n' +
      '4. PRIVACY. Students must be told plainly, at the point of joining a cohort and in\n' +
      '   settings, exactly what their educator can see. Make leaving a cohort straightforward.\n' +
      '   Educators should see performance data, never raw answer-by-answer logs of an\n' +
      "   individual's session — aggregate and summarise at the student level. The difference\n" +
      '   between "this student is struggling with the rotator cuff" and a keystroke-level\n' +
      "   record of their revision matters, both ethically and for whether students trust the\n" +
      '   product enough to use it honestly.\n\n' +
      '5. Educators must not see students outside their own cohorts. Enforce in Firestore rules\n' +
      '   against the cohorts array in the claim, not just in the UI.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test and npm run build pass.\n' +
      '- An educator claim scoped to cohort A cannot read cohort B data directly from Firestore.',
    dependsOn: ['CR-005'],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T23:25:00.000Z',
    completedAt: '2026-08-28T01:10:00.000Z',
    notes:
      'Educator role added as a custom claim { educator: true, cohorts: string[] } via a new scripts/setEducator.ts, mirroring ' +
      'setAdmin.ts exactly (same GOOGLE_APPLICATION_CREDENTIALS requirement, same sign-out/in caveat). No Cloud Functions exist ' +
      'in this project, which shapes two deliberate scope decisions: (1) a cohort Firestore doc (name/institution/joinCode) is ' +
      'created via a new admin-only /admin/cohorts screen, but granting an educator read access to that cohort\'s student data ' +
      'is a SEPARATE step (the set-claim script) — there is no way for a client to safely mint its own claim-worthy resource, ' +
      'so cohort creation and claim-granting are two explicit admin actions, not one; (2) join-code lookups and cohort-name ' +
      'display are readable by any signed-in user (same trust model as an invite code) rather than trying to lock down a ' +
      'collection scan Firestore rules can\'t meaningfully restrict anyway — the actual privacy boundary is student DATA, never ' +
      'cohort metadata. firestore.rules extended: users/{uid} (+ subcollections) and attemptEvents gain an educator-claim read ' +
      'clause alongside the existing admin one, checking the target user\'s cohort against request.auth.token.cohorts via an ' +
      'explicit get() (Firestore rules can\'t see the parent doc\'s fields from a subcollection match without one) — an ' +
      'educator\'s claim is therefore the sole input to what they can read, so a claim scoped to cohort A cannot reach cohort B ' +
      'through any client-side trick, satisfying this CR\'s acceptance criterion directly at the rules level. New cohorts/{id} ' +
      '(+ assignments subcollection) rules added alongside. Dashboard at /educator reuses CR-005\'s pure aggregation functions ' +
      '(aggregateStructureWeakness, aggregateConfusionPairs, aggregateAccuracyByRegion, aggregateActiveUsersByDay, ' +
      'computeRetention, computeSessionMetrics) completely unchanged, fed a cohort-scoped attempt/session-summary fetch instead ' +
      'of the platform-wide one (one listAttempts/listSessionSummaries call per student — a bounded N+1, the same accepted ' +
      'pattern analyticsSource.ts already documents for its own cohort overview) — and goes further than the prompt\'s literal ' +
      '"reuse the aggregation functions" by reusing the presentational pieces too (StructureWeaknessTable, ConfusionPairsList, ' +
      'StatTile, AccuracyByRegionChart, ActiveUsersChart), since all five are pure/presentational with no admin-only coupling. ' +
      'Per-student drill-down shows accuracy, current streak (lib/streak.ts\'s computeStreak, unchanged), and weakest structures ' +
      '(same aggregateStructureWeakness at minAttempts=1) — deliberately never a session-by-session or answer-by-answer log, ' +
      'per the prompt\'s privacy requirement. Assignments (region + due date) are tracked against a pragmatic completion ' +
      'definition — "has attempted the assigned region since assigning" plus accuracy-since-then, not a stricter pass/fail bar ' +
      '— documented in lib/assignmentCompletion.ts as a deliberate scope limit: a firmer definition would need a session/topic ' +
      'construct this app does not have. Student-side join/leave-by-code UI added to both NavSidebar\'s AccountSection (desktop) ' +
      'and MobileAccountSection, with the same plain-language privacy line shown before and after joining, and leaving is a ' +
      'single button with no confirmation step, per the prompt\'s "make leaving straightforward" ask. One real bug caught by ' +
      'the build step before landing: the new CohortMembership component initially statically imported cohortsRepository.ts ' +
      '(which imports firebase.ts) from NavSidebar/MobileAccountSection — both always-eager, not lazy — which pulled the whole ' +
      'Firebase SDK (~490KB) into the main bundle regardless of persistence mode, nearly doubling it. Fixed by switching to ' +
      "dynamic import() inside the component's effect/handlers, matching AuthProvider.tsx's own established pattern for " +
      'exactly this reason; confirmed fixed by checking the bundle output returned to its pre-change size with firebase.ts ' +
      'back in its own separate chunk. npm run test (248 passed), npm run build, npm run lint, and npm run validate-content ' +
      'all pass. README was not updated — consistent with CR-008/009/010/011 also not touching it this session, so the change ' +
      'register stays the single source of truth for what shipped rather than half the CRs updating docs and half not.',
  },
  {
    ref: 'CR-013',
    title: 'Quick wins bundle',
    category: 'infrastructure',
    priority: 'p1',
    effort: 's',
    status: 'completed',
    description:
      'Five small, independent fixes: the mastery N+1 read (already done by CR-006), nine unlinked structures, ' +
      'two needsReview flags, colliding attempt IDs, and missing loading/error states on async paths.',
    prompt:
      'Address a set of small issues in this Vite + React 19 + Firebase 11 anatomy app.\n\n' +
      '1. N+1 READ IN THE ANSWER PATH\n' +
      '   useRevisionSession.submitAnswer calls repository.getMastery(userId), which fetches the\n' +
      '   ENTIRE mastery subcollection, on every single answer. On Firestore that is a full\n' +
      '   collection read per question. Add getMasteryForStructure(userId, structureId) to the\n' +
      '   AnatomyRepository interface, implement it in the firestore, local and memory\n' +
      '   repositories, and use it here.\n' +
      '   (If CR-006 has already been done, this is complete — check first.)\n\n' +
      '2. NINE UNLINKED STRUCTURES\n' +
      '   9 of 285 structures have no linked images. Identify them by running through\n' +
      '   ALL_STRUCTURES checking imageIds.length === 0. For each, either add an alias matching\n' +
      "   an existing image's panelStructureNames (see how lib/linkImages.ts matches), or record\n" +
      '   in a comment which image still needs to be produced. Do not hand-edit imageIds —\n' +
      '   linking is automatic via name and alias matching.\n\n' +
      '3. TWO needsReview FLAGS\n' +
      '   rhomboid-major and internal-intercostals are flagged needsReview: true because their\n' +
      '   data was inferred from standard anatomy rather than taken from the source slides.\n' +
      '   Verify against a reliable anatomical reference, correct if needed, and clear the flag.\n' +
      '   These live in data/source/muscles.raw.json, not the muscles seed file.\n\n' +
      '4. DETERMINISTIC ATTEMPT IDS\n' +
      '   Attempt ids are `attempt-${sessionId}-${currentIndex}`. If a session is ever resumed or\n' +
      '   a question re-answered, this collides and silently overwrites. Include a timestamp or\n' +
      '   random suffix.\n\n' +
      '5. LOADING AND ERROR STATES\n' +
      '   Several async paths (repository loading, session persistence) have no error handling —\n' +
      '   a failed Firestore write currently fails silently and the student loses the answer with\n' +
      '   no indication. Add visible error states and a retry where sensible.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build and npm run validate-content all pass.',
    dependsOn: [],
    createdAt: '2026-08-26T08:00:00.000Z',
    startedAt: '2026-08-27T09:00:00.000Z',
    completedAt: '2026-08-27T10:00:00.000Z',
    notes: '',
  },
  {
    ref: 'CR-014',
    title: 'Joints as a first-class structure category',
    category: 'clinical',
    priority: 'p2',
    effort: 'l',
    status: 'completed',
    description:
      'Add Category: \'joint\' alongside muscle/bone/landmark — joint type classification, articulating bones, ' +
      'possible movements, and stabilizing structures — reusing CR-010\'s clinical fields (specialTests, ' +
      'commonInjuries, palpationNotes) rather than inventing new ones. Piloted on the shoulder-arm complex.',
    prompt:
      'Following up on a user question about content coverage: bones and bony landmarks already have real ' +
      'question coverage (flashcard/MCQ/locate/fill-blank), but joints only existed as a free-text ' +
      '`articulations` field on bones/landmarks, with no dedicated structure, card, or clinical content of ' +
      'their own. The user asked to introduce joints properly.\n\n' +
      'Two decisions were confirmed with the user before implementation, since both carry real effort/scope ' +
      'tradeoffs: (1) model joints as a genuine new Category (\'joint\'), not a flag bolted onto landmarks, ' +
      'since it is the more honest representation and lets joints carry the same clinical fields CR-010 ' +
      "already added to AnatomyStructureBase; (2) pilot on the shoulder-arm complex only (5 joints), " +
      "mirroring CR-010's own single-region vertical slice, rather than authoring all 5 regions' major " +
      'synovial joints at once.\n\n' +
      'WHAT WAS BUILT\n' +
      "1. Category extended to 'muscle' | 'bone' | 'landmark' | 'joint'; new JointType union (the six " +
      'standard synovial joint classifications) and JointStructure (jointType, articulatingStructureIds, ' +
      'movements, stabilizers) added to types/structure.ts, plus an isJoint guard.\n' +
      '2. Two new PromptKinds: joint-type (MCQ classification question) and joint-movement (multi-select ' +
      'exclusion question).\n' +
      '3. 5 shoulder-arm joints authored in a new structures.joints.seed.ts, hand-authored like ' +
      'structures.bones.seed.ts (no source-of-truth file exists for joints either): glenohumeral, ' +
      'acromioclavicular, sternoclavicular, humeroulnar, proximal radioulnar — covering all 6 joint ' +
      'classification types except condyloid, which has no shoulder-arm representative.\n' +
      '4. Question generation wired through every existing generator rather than a parallel joint-only path: ' +
      'mcq.ts gets a JOINT_KINDS list (identify + joint-type); flashcards.ts needed zero changes since its ' +
      'generic identify card already calls the shared summarizeStructure/facts.ts, which now has a joint ' +
      'branch; multiSelect.ts gets a new buildJointMovementQuestions generator ("which of these movements is ' +
      'NOT possible at the humeroulnar joint"), mirroring the existing action-exclusion shape exactly; ' +
      "clinical.ts's buildInjuryMechanismQuestions was widened from muscle-only to any category with " +
      'commonInjuries authored, since a joint dislocation is an equally valid vignette — this was the one ' +
      'genuine behavior change to existing (not new) code, and is backward-compatible since only muscles had ' +
      'commonInjuries before this CR.\n' +
      '5. UI: RevisionSetup\'s category picker and the admin analytics category filter both gained a "Joints" ' +
      'option. validateContent.ts gained an articulatingStructureIds FK check, mirroring the existing ' +
      'parentBoneId check for landmarks.\n\n' +
      'DELIBERATELY OUT OF SCOPE\n' +
      "- Locate questions: eligibility.locate is false on every joint entry, honestly, since no atlas-slide " +
      'hotspot pinpoints a joint space specifically (as opposed to the bones forming it) — forcing ' +
      'locate: true with no hotspot data would just silently generate zero questions forever.\n' +
      '- Fill-blank: joints\' `movements`/`stabilizers` are tag-like lists, not the free-text sentence ' +
      'statements blankParser.ts expects (unlike bones\' attachments/articulations) — inventing sentence-' +
      'shaped content just to force fill-blank coverage would be worse than not having it.\n' +
      "- The 4 other regions' joints: left for a future pass once this pilot's model is validated in use.\n\n" +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build, npm run lint and npm run validate-content all pass.',
    dependsOn: ['CR-010'],
    createdAt: '2026-08-28T09:00:00.000Z',
    startedAt: '2026-08-28T09:05:00.000Z',
    completedAt: '2026-08-28T10:40:00.000Z',
    notes:
      'One test-writing bug caught by the suite itself: the first draft of buildJointMovementQuestions required ' +
      'a joint to have >= 3 movements before generating a question, which silently excluded every hinge/pivot ' +
      'joint (exactly 2 movements each — humeroulnar and proximal radioulnar, 2 of the 5 piloted joints). ' +
      'Lowered the floor to >= 2 movements once a test asserted a question should exist for the humeroulnar ' +
      'joint and got undefined back. New tests: mcq.test.ts (new file — mcq.ts had no dedicated unit tests ' +
      'before this CR, only the full-seed-dataset integration test in generateSet.test.ts) covers the ' +
      'joint-type question and confirms joints get the text-clue identify variant that bones deliberately ' +
      'skip; multiSelect.test.ts extended with 2 joint-movement tests; clinical.test.ts extended with a joint ' +
      'fixture proving the widened injury-mechanism gate. 290 structures now validate cleanly (285 + 5 ' +
      'joints), 254 tests pass (up from 248).\n\n' +
      'ADDENDUM (found testing this CR locally): the user hit a "Name the structure:" text-only identify MCQ ' +
      'with a completely blank clue (Back & Core region, costovertebral-joint). Root cause was in ' +
      "lib/facts.ts's buildIdentifyClue — it only ever read a landmark's `attachments` field, but 42 " +
      'landmarks across the seed data (unrelated to this CR\'s new joints) have `attachments: []` and only ' +
      '`articulations` authored. Fixed with a proper fallback chain (attachments -> articulations -> ' +
      'description, never blank) and a matching describeStructure fix so the same structures don\'t show an ' +
      'empty "Attachments:" line on their detail card either. New facts.test.ts (first-ever test file for ' +
      'facts.ts) locks this in, including a dataset-wide check that every real structure produces a non-empty ' +
      'clue. 258 tests pass.',
  },
  {
    ref: 'CR-015',
    title: 'Fix locate-question image/hotspot misalignment',
    category: 'content',
    priority: 'p0',
    effort: 's',
    status: 'completed',
    description:
      'Every one of the 45 image assets was missing width/height, so HotspotImage.tsx could never lock its ' +
      'aspect ratio and object-cover silently cropped to whatever shape the surrounding layout produced — a ' +
      'correct click on the visually obvious muscle could register as wrong. Populated real pixel dimensions ' +
      '(verified via pngjs) for every image and added a validateContent.ts guard against it recurring.',
    prompt:
      'User-reported bug, found via two screenshots: a "Tap the Gluteus Maximus" and a "Tap the Deltoid" ' +
      'locate question where the post-answer reveal overlay (the correct hotspot polygon, shown in green) was ' +
      'positioned nowhere near the actual blue-highlighted muscle visible in the underlying illustration — the ' +
      'user asked to check the hotspot "render zone" for both images.\n\n' +
      'ROOT CAUSE: HotspotImage.tsx sizes its click-target wrapper via CSS `aspect-ratio`, derived from ' +
      'AnatomyImageAsset.width/height — its own code comment says this is "what keeps normalizePointerEvent\'s ' +
      'coordinates correct" versus object-fit: contain letterboxing corrupting them. But none of the 45 image ' +
      'entries in images.seed.ts had width/height set (`grep -c "width:"` returned 0), so that lock never ' +
      'engaged for a single image in the app — the wrapper fell back to whatever the surrounding layout ' +
      'produced, and the `<img>` inside (object-cover) cropped/stretched to fill that arbitrary shape. Click ' +
      'coordinates are normalized against the wrapper\'s rendered box, so once that box\'s shape stopped ' +
      'matching the real image, both the click-hit-testing AND the reveal overlay drifted from the coordinate ' +
      'space the hotspot polygons were actually authored against — this affected every locate question using ' +
      'every image in the app, not just the two the user happened to screenshot.\n\n' +
      'FIX: wrote a one-off script using pngjs (added as a devDependency) to read the real pixel dimensions of ' +
      'all 45 PNGs on disk, then populated width/height on every AnatomyImageAsset entry: all 21 single-muscle ' +
      'panel crops share 255x259 (fixed in the single shared factory function that generates them), all 24 ' +
      'atlas-slide images are 1122x1402 except the 4 spine-atlas-* ones, which are 1254x1254 (fixed via a ' +
      'file-wide replace on the shared trailing line, then 4 targeted corrections for the square ones). Added ' +
      'a validateContent.ts warning for any future image with hotspot data but no width/height, so this exact ' +
      'bug class cannot silently reappear.\n\n' +
      'NOT FIXED HERE (flagged, not silently ignored): the 4 hand-traced hotspot polygons (deltoid, ' +
      'gluteus-maximus, biceps-brachii, trapezius) were already documented in their own code comment as ' +
      '"rough...not pixel-perfect" CR-007 proof-of-concept placeholders. This CR fixes the container/coordinate ' +
      'system they\'re interpreted against, which was the dominant, severe source of misalignment — but the ' +
      'hand-typed polygon shapes themselves may still be imprecise relative to the actual muscle silhouette in ' +
      'each image and could benefit from re-tracing with the /dev/hotspots tool now that the display is ' +
      'correctly aligned. Separately, the user raised that the source illustrations show the target muscle ' +
      'pre-highlighted in a distinct colour from the rest of the figure, which makes locate questions easier ' +
      'than a true blind spatial-recognition test — that is an asset-design question for the user\'s own ' +
      'AI-generated illustrations, not something fixable in code, and is left for them to decide on.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build, npm run lint and npm run validate-content all pass.',
    dependsOn: [],
    createdAt: '2026-08-28T11:00:00.000Z',
    startedAt: '2026-08-28T11:05:00.000Z',
    completedAt: '2026-08-28T11:35:00.000Z',
    notes: '',
  },
  {
    ref: 'CR-016',
    title: 'Drop locate questions from pre-highlighted single-muscle panels',
    category: 'content',
    priority: 'p1',
    effort: 's',
    status: 'completed',
    description:
      'Removed the 4 hand-traced hotspot polygons (deltoid, gluteus-maximus, biceps-brachii, trapezius) that ' +
      'CR-007 added as a proof-of-concept — the underlying panel images already highlight the target muscle in ' +
      'a distinct colour, which suits "which structure is shown?" MCQ/typed identify questions, but makes a ' +
      '"tap the muscle" locate question trivial-or-nothing rather than a real spatial-recognition test.',
    prompt:
      'Follow-up to CR-015: after that fix, the user asked to change how these questions are asked entirely — ' +
      'not a "click on this muscle" locate question, but an identify question (typed or multiple choice) ' +
      'instead.\n\n' +
      'Investigated whether that already works: yes. The image-based MCQ "identify" variant and ' +
      'identifyTyped.ts both match single-structure images via imageDepicts(), which only checks ' +
      'image.structureId === structure.id — no dependency on hotspot data at all. So deltoid/gluteus-maximus/' +
      'biceps-brachii/trapezius already generate "Which structure is shown?" MCQ and identify-typed questions ' +
      'against these exact images, unaffected by anything below.\n\n' +
      'The only content-side fix needed was to stop generating the locate variant for them, which is simply a ' +
      'matter of removing their hotspot data — locate.ts already skips any image with no hotspots. Removed ' +
      "the HOTSPOT_OVERRIDES lookup entirely from images.seed.ts (all 21 single-muscle panel crops now " +
      'consistently have hotspots: []) and documented why directly in the panel-generation comment, so a ' +
      'future contributor does not just re-add hand-traced polygons for the same images and reintroduce the ' +
      "same problem.\n\n" +
      'CONSEQUENCE WORTH FLAGGING: these 4 were the only locate content anywhere in the dataset — every other ' +
      'image already had empty hotspots. So the Locate question type currently generates zero questions ' +
      "across the entire app, not just for these 4 muscles. Locate isn't broken as a mechanic (its generator, " +
      'hit-testing, and CR-015\'s aspect-ratio fix are all still correct and tested) — there is simply no ' +
      'image in the dataset suited to it right now, since a fair locate question needs a genuinely neutral ' +
      '(non-pre-highlighted) diagram, which none of the current AI-generated panels are. Flagged to the user ' +
      'rather than silently left as a confusing "pick Locate, get an empty session" trap — a separate decision ' +
      'on next steps (hide the option, author new neutral diagrams, or leave as-is) is theirs to make.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build, npm run lint and npm run validate-content all pass.',
    dependsOn: ['CR-015'],
    createdAt: '2026-08-29T09:00:00.000Z',
    startedAt: '2026-08-29T09:05:00.000Z',
    completedAt: '2026-08-29T09:30:00.000Z',
    notes:
      'generateSet.test.ts\'s "generates locate questions for images with authored hotspots" test previously ' +
      'depended on this exact real seed data — rewrote it to use a synthetic single-structure image/hotspot ' +
      'fixture instead (proving the generateSet -> locate.ts wiring itself still works, independent of ' +
      'whatever content happens to exist today), and added a new explicit test asserting the real seed dataset ' +
      'currently produces zero locate questions — turning a stale implicit assumption into a documented, ' +
      'intentional fact that will fail loudly (not silently) once real locate-suited content is authored. 259 ' +
      'tests pass.\n\n' +
      'FOLLOW-UP (same conversation): asked the user how to handle Locate being selectable-but-empty in the ' +
      'Study setup screens; they chose to hide it rather than leave it visible or pursue new neutral diagrams ' +
      'right now. Removed the "Locate" chip from both RevisionSetup.tsx (desktop) and MobileRevisionSetup.tsx ' +
      '(mobile) format pickers, dropped it from both screens\' default-selected types, and deleted the mobile ' +
      'screen\'s now-meaningless "Locate questions need hotspot data..." hint paragraph (its only other branch, ' +
      '"Image questions are off — this session is text only", was already inaccurate anyway, since MCQ/' +
      'identify-typed use images too whenever a match exists). generateRevisionSet itself, locate.ts, and ' +
      'hit-testing are untouched — Locate still works correctly end-to-end for any future image that does get ' +
      'real hotspot data; it\'s just not offered as a dead-end choice in the meantime.',
  },
  {
    ref: 'CR-017',
    title: 'Areas replace Regions as the study axis; full joint coverage',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'completed',
    description:
      'Replace the 5 anatomical Regions with the 7 major Areas (shoulder, elbow, wrist & hand, hip, knee, ' +
      'ankle/foot, back & core) as the axis the whole app is studied and filtered by, for every category of ' +
      'structure — and author joints for every area instead of the shoulder-arm complex alone.',
    prompt:
      'The user asked to change the joint specification, stating the major joints should be shoulder, elbow, ' +
      'wrist & hand, hip, knee, ankle/foot, and back & core/trunk. Two separate problems sat behind that.\n\n' +
      'First, the organising axis was wrong. Joints inherited Region (5 anatomical regions) and SubRegion ' +
      '(9 values), and neither expresses how joints are actually taught: Region splits the knee across ' +
      'hip-thigh and lower-leg-foot, while SubRegion splits the trunk into spine/torso/neck. Second, coverage ' +
      "was a fifth of what it should be — CR-014 deliberately piloted on shoulder-arm only, and its own notes " +
      "deferred 'the 4 other regions\\' joints' to a later pass.\n\n" +
      'Three decisions were confirmed with the user before implementation: (1) do both the taxonomy change ' +
      'and the content expansion, not just one; (2) apply the spine/torso/neck merge to joints ONLY — bones ' +
      'and landmarks keep the finer SubRegion split, since 66 entries use it and distractors.ts relies on it ' +
      'for distractor plausibility; (3) author the new joints at core depth (description, jointType, ' +
      'articulatingStructureIds, movements, stabilizers) with the CR-010 clinical layer deferred.\n\n' +
      'WHAT WAS BUILT\n' +
      '1. New JointGroup type (7 values) + JOINT_GROUPS/JOINT_GROUP_LABELS in types/region.ts. Region and ' +
      'SubRegion are unchanged. JointStructure gains a required `jointGroup`, hand-declared rather than ' +
      'derived from region/subregion because the interesting cases disagree with both: sacroiliac-joint is ' +
      "subregion 'spine' but revises with the hip, and proximal-tibiofibular-joint is region 'lower-leg-foot' " +
      'but revises with the knee. A derivation would have silently mis-grouped exactly those.\n' +
      "2. JointType extended with 'symphysis' and 'syndesmosis'. The union was the six synovial " +
      'classifications only, but three joints the spec requires are not synovial — the intervertebral discs, ' +
      'the pubic symphysis, the distal tibiofibular syndesmosis. Keeping the union tidy would have cost the ' +
      "back & core group its headline joint. Both formatting call sites string-mangled the raw value " +
      '(`t.replace(/-/g, \' \') + \' joint\'`), which yields "symphysis joint" — replaced with a shared ' +
      'JOINT_TYPE_LABELS map used by mcq.ts and facts.ts alike. This also fixes the pre-existing ' +
      '"ball and socket joint" (the correct form is hyphenated).\n' +
      '3. Six joints were modelled as `category: \'landmark\'` tagged `groups: [..., \'joint\']`, so no joint ' +
      'generator ever saw them: sacroiliac, facet, costovertebral, distal radioulnar, carpometacarpal of ' +
      'thumb, proximal tibiofibular. Migrated to real JointStructures with ids and names preserved byte-for-' +
      'byte, since user progress records are keyed on structureId and linkImages() matches on name/alias. All ' +
      'six already had eligibility.locate: false, so no locate coverage was lost.\n' +
      '4. 18 new joints authored, bringing the dataset to 29 joints across all 7 groups (308 structures ' +
      'total). radiocarpal finally supplies the condyloid representative CR-014 noted the shoulder-arm pilot ' +
      'could not provide; all 8 joint types are now represented.\n' +
      '5. UI: RevisionSetup shows a 7-chip joint-group row when the Joints category is selected, reusing the ' +
      'existing chipStyle/aria-pressed pattern. `jointGroups` threaded through StructureFilter, ' +
      'RevisionSetConfig and RevisionSetupParams the same way `subregion` already was. facts.ts leads joints ' +
      'with "Joint group: Wrist & Hand" instead of "Region: Forearm & Hand (Wrist & Hand)".\n\n' +
      'THE REAL RISK, AND WHAT IT COST\n' +
      'buildJointMovementQuestions builds "which movement is NOT possible here" by taking movement strings ' +
      'from other joints and filtering with a literal `!joint.movements.includes(m)`. Safe with 5 joints; ' +
      'actively dangerous with 29, because it will confidently assert a falsehood if the strings disagree. ' +
      'Three separate ways that bites, all now closed:\n' +
      '- Spelling drift. `movements` is now typed `JointMovement[]` against a closed canonical union rather ' +
      'than `string[]`, so a one-off "Medial rotation" is a compile error instead of a wrong question. This ' +
      'caught a live bug already in the data: acromioclavicular-joint listed ' +
      "'Rotation (accessory, during scapular movement)' while sternoclavicular-joint listed 'Rotation', so " +
      'the generator could already claim rotation was impossible at the AC joint. The nuance moved into the ' +
      'description where it belongs.\n' +
      '- Accessory movements. Gliding occurs at essentially every synovial joint, so it can never be a ' +
      'truthful odd-one-out even when a joint only bothers to list flexion/extension.\n' +
      '- Regional synonyms. Wrist radial deviation IS abduction, so offering "Abduction" against the ' +
      'radiocarpal joint (which lists \'Radial deviation\') asserts something false. Handled by ' +
      'EQUIVALENT_MOVEMENT_GROUPS.\n' +
      'Separately, the odd-one-out is now drawn from the joint\'s own group first (falling back to the whole ' +
      'dataset when the group cannot supply one). Drawing from all 29 made the question trivial — "which ' +
      'movement is NOT possible at the atlantoaxial joint? Plantarflexion" tests nothing.\n\n' +
      'DELIBERATELY OUT OF SCOPE\n' +
      '- The CR-010 clinical layer (specialTests, commonInjuries, palpationNotes, functionalContext) on the ' +
      '24 non-pilot joints. Authoring that at once would have meant inventing content to fill a shape rather ' +
      'than recording established teaching. The 5 original shoulder-arm joints keep theirs, and `clinical` is ' +
      'authored on new joints where there is a single well-established point worth making. Depth is therefore ' +
      'uneven by design, and the seed file header says so.\n' +
      '- Locate questions: still false on every joint, for CR-014\'s unchanged reason (no atlas hotspot ' +
      'pinpoints a joint space as opposed to the bones forming it).\n' +
      '- SubRegion itself is untouched; bones and landmarks keep spine/torso/neck.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build, npm run lint and npm run validate-content all pass.',
    dependsOn: ['CR-014'],
    createdAt: '2026-08-31T11:00:00.000Z',
    startedAt: '2026-08-31T11:10:00.000Z',
    completedAt: '2026-08-31T12:30:00.000Z',
    notes:
      'One assumption made while planning turned out to be wrong, and the test suite is what caught it. The ' +
      'planned seed-integrity assertion was "no landmark has \'joint\' in its groups" — but 11 landmarks ' +
      'legitimately do, because they are articular surfaces that FORM joints rather than joints themselves ' +
      '(glenoid cavity, acetabulum, trochlear notch, femoral head, ankle mortise, the costal facets, talus). ' +
      'The assertion was rewritten to key on the name instead: nothing named "<Something> Joint" may be a ' +
      'landmark, which is the property actually intended.\n\n' +
      'validateContent.ts gained two joint checks: a hard error if any of the 7 groups is empty (an empty ' +
      'group is a dead end in the UI — the chip renders, the user picks it, the session generates nothing), ' +
      'and a warning when a trunk-subregion joint is grouped anywhere but back-core, with sacroiliac-joint ' +
      'named as the one deliberate exception. The canonical-movement check the plan called for turned out to ' +
      'be unnecessary at runtime: typing `movements` as JointMovement[] enforces it at compile time, which ' +
      'is strictly stronger.\n\n' +
      'New tests: joints.seed.test.ts (new file) covers group coverage, the migration\'s id stability, joint-' +
      'type coverage including the two non-synovial additions, and that every joint has at least one ' +
      'movement. multiSelect.test.ts gained a 4-test block sweeping 25 rng seeds — a single seed only ' +
      'exercises a fraction of the candidate pool, so it would not reliably catch a bad odd-one-out. ' +
      'mcq.test.ts gained a non-synovial formatting test and had its "ball and socket joint" expectation ' +
      'corrected to the hyphenated form. 308 structures validate with 0 errors and 0 warnings.\n\n' +
      'FOUND WHILE REVIEWING THE RUNNING APP, not by any test: filtering to the Knee group and starting a ' +
      'session produced a question header reading "IDENTIFY · LOWER LEG & FOOT" — all five session components ' +
      'rendered REGION_LABELS[question.region], which contradicts the very chip the user just picked and ' +
      'reintroduces the exact confusion this CR exists to remove. Fixed by carrying an optional `jointGroup` ' +
      'on RevisionQuestionBase (set in every generator\'s baseFields) plus a shared questionLocationLabel() ' +
      'helper that the desktop and mobile MCQ, identify-typed and multi-select headers all call. The whole ' +
      'suite passed both before and after this fix — a wiring mismatch between two individually correct ' +
      'halves is exactly the class of bug only running the real app catches.\n\n' +
      'STILL OPEN (pre-existing, not introduced here): summarizeStructure joins its fact lines with a newline, ' +
      'but the MCQ explanation panel does not preserve whitespace, so they render run-together as "...below ' +
      'the knee. Joint group: Knee Type: plane joint Movements: Gliding". This predates the CR (it ran ' +
      '"Region: ... Type: ..." together the same way before) and affects every category, so it is left for a ' +
      'separate presentation fix rather than widened into this one.\n\n' +
      'SCOPE WIDENED MID-CR, AFTER THE USER REVIEWED IT LOCALLY. The first implementation scoped the seven ' +
      'groups to the Joints category only and left the top-level picker on the old five Regions. The user ' +
      'tried it and said the filtering had not really changed, "whether it\'s muscles or joints" — correctly. ' +
      'That narrow scope came from misreading an earlier clarification: asked whether the spine/torso/neck ' +
      'merge should apply to everything or joints only, they answered joints only, which was about the DATA ' +
      'MODEL. It was taken as "groups are a joints-only concept", which was never said.\n\n' +
      'Worse, the reason given for not widening it was wrong on the facts. The claim was that muscles carry ' +
      'no subregion, so filtering them by joint group would need 122 muscles re-authored. That came from ' +
      'grepping structures.muscles.seed.ts, which has no literal subregion lines because muscles are ' +
      'generated from muscles.raw.json. Checking the built dataset instead: all 308 structures have a ' +
      'subregion (muscle 122/122, bone 29/29, landmark 128/128, joint 29/29). The widening therefore needed ' +
      'no content authoring whatsoever. Lesson: check the built data, not the source file, before declaring ' +
      'something infeasible.\n\n' +
      'WHAT THE WIDENING CHANGED\n' +
      "1. JointGroup became Area — the same seven values, now a property of every structure, not just joints. " +
      'Derived from `subregion` via AREA_BY_SUBREGION rather than hand-declared, with an optional `area` ' +
      'override on AnatomyStructureBase for the one case the derivation gets wrong (sacroiliac-joint, ' +
      "subregion 'spine' but examined with the hip). That deleted 28 of the 29 hand-written jointGroup lines.\n" +
      '2. Region is no longer the study filter. It survives in the data model and still drives the Atlas, ' +
      'Progress mastery shading and admin analytics — it was too coarse to revise by, but it is not wrong.\n' +
      '3. Both region pickers became area pickers (desktop + mobile), as did the session setup screens. The ' +
      'joints-only chip row added earlier in this CR was deleted as redundant once the picker itself is areas.\n' +
      '4. BodyFigure became generic over its band key, so the pickers band the silhouette by Area (the arm ' +
      'and leg bands subdivide: shoulder/elbow, and hip/knee/ankle-foot) while Progress keeps banding by ' +
      'Region for mastery shading. Both callers keep full type safety instead of sharing a stringly-typed prop.\n' +
      '5. The picker counts every category, not just muscles. They were muscles-only to match the original ' +
      'mockup\'s "122 muscles", which under-reported an area by up to 5x — the shoulder shows "15 muscles · 3 ' +
      'bones · 14 landmarks · 3 joints" now, where it used to claim 15. Reported by the user in the same pass.\n\n' +
      'Structures per area after the change: Shoulder 35, Elbow 17, Wrist & Hand 54, Hip 39, Knee 29, ' +
      'Ankle & Foot 50, Back & Core 85. validateContent now fails if any structure resolves to no area (it ' +
      'would be unreachable from the picker) or if any area is empty (a dead-end selection).\n\n' +
      'C7 WAS MISSING — found by the user reading the new picker counts. They asked how Back & Core could ' +
      'have only 9 bones when there are 33 vertebrae. Most of the answer is that the bone entries are ' +
      'deliberately grouped (structures.bones.seed.ts documents this: "Thoracic Vertebrae (T1-T12)" is one ' +
      'study item, as is "Ribs" for all 24), so 9 was a count of entries and not of bones. But the question ' +
      'surfaced a real gap underneath it: C1, C2 and a "typical cervical vertebra" entry scoped C3-C6 ' +
      'accounted for only 6 of the 7 cervical vertebrae. C7 had no bone entry at all — the one vertebra that ' +
      'least deserved to be dropped, since it is atypical (long non-bifid spinous process, transverse ' +
      'foramen small or absent) and is the standard surface landmark for counting spinal levels.\n\n' +
      'Two related defects came with it: c7-spinous-process carried parentBoneId \'cervical-vertebrae\', a ' +
      'parent whose own name and description explicitly exclude C7; and that same C3-C6 entry carried the ' +
      "alias 'Cervical Region (C1-C7)', which linkImages() matches on, so a whole-cervical-spine image was " +
      'linking to an entry covering neither end of the range. Added a c7-vertebra bone alongside atlas and ' +
      'axis, repointed the landmark at it, and dropped the contradictory alias. Back & Core bones 9 -> 10, ' +
      'dataset 308 -> 309 structures.\n\n' +
      'The picker now makes the grouping legible rather than leaving the count to be re-litigated: each ' +
      'category count is hover-underlined and lists the entries behind it, whose names already carry their ' +
      'ranges. Hovering "10 bones" spells out Sternum / Ribs / Cervical Vertebrae (C3-C6) / Atlas (C1) / ' +
      'Axis (C2) / C7 Vertebra / Thoracic (T1-T12) / Lumbar (L1-L5) / Sacrum / Coccyx, which reconciles the ' +
      'number with the 33 vertebrae a reader is counting in their head.\n\n' +
      'MOBILE HAD NO CATEGORY FILTER AT ALL, asked about by the user just before committing. Desktop has ' +
      'had one since CR-014 (all / muscles / bones / landmarks / joints); MobileRevisionSetup was ' +
      "hardcoded to category: 'muscle', so 187 of the 309 structures — every bone, bony landmark and " +
      'joint — were unreachable on a phone. Pre-existing, but this CR made it actively inconsistent: ' +
      'widening the mobile area picker to count all structures meant it promised "17 structures" for the ' +
      'elbow while the session behind it still served only the 5 muscles. Added the same category chip ' +
      'row to mobile and removed the hardcode.',
  },
  {
    ref: 'CR-018',
    title: 'Automated Z-Anatomy hotspot pipeline',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'completed',
    description:
      'CR-007\'s dev-only authoring tool made hand-tracing hotspots possible but nobody had actually traced any — locate ' +
      'questions still generated zero. Render the Z-Anatomy 3D model per-region and per-muscle, derive hotspot polygons from the ' +
      'per-muscle masks automatically, and retire the 10 AI-generated muscle atlas slides in favour of the real renders.',
    prompt:
      'Not a single discrete prompt — reconstructed from BACKLOG-IMAGES.md and the commit history of a long-lived ' +
      'feature branch. The work, in the order it happened:\n\n' +
      '1. Render 5 regions x 3 views (anterior/lateral/posterior) from the Z-Anatomy Blender model, plus a solo silhouette ' +
      'mask per muscle for occlusion ordering.\n' +
      '2. Convert each mask to a normalised 0-1 hotspot polygon (src/scripts/masksToHotspots.ts), subtracting whatever a ' +
      'shallower structure occludes so a correct tap is never stolen by a deeper muscle the student cannot see ' +
      '(src/scripts/data/occlusionOrder.ts) — verified with a dev-only overlay renderer, not just by eye on the final crop.\n' +
      '3. Re-render the 21 single-muscle Muscle Card panels from the same model, replacing the softer AI crops, composited ' +
      'in-context on the skeleton rather than floated alone against white.\n' +
      '4. Convert every atlas/panel/region image to webp.\n\n' +
      'Licence: Z-Anatomy is CC BY-SA 4.0 (based on BodyParts3D) — share-alike reaches the traced polygons as well as the ' +
      'renders themselves, credited via AttributionBadge.',
    dependsOn: ['CR-007'],
    createdAt: '2026-08-31T13:00:00.000Z',
    startedAt: '2026-08-31T13:00:00.000Z',
    completedAt: '2026-08-31T19:36:00.000Z',
    notes:
      'The real seed dataset generates at least 25 locate questions post-merge, up from zero — see ' +
      'generateSet.test.ts. CR-007\'s manual authoring tool and src/scripts/importHotspots.ts stay in the tree as a ' +
      'fallback path for structures with no mask (bones, landmarks), which this pipeline does not cover.',
  },
  {
    ref: 'CR-019',
    title: 'Correctness-weighted ordering for practice and assessment sessions',
    category: 'content',
    priority: 'p2',
    effort: 's',
    status: 'completed',
    description:
      'CR-006 weights structure selection in adaptive mode only. Extend the same idea — a structure answered wrong ' +
      'resurfaces sooner, a well-known one later — to the ordering of practice and assessment sessions, which previously ' +
      'shuffled uniformly regardless of recorded performance.',
    prompt:
      'Reconstructed from a long-lived feature branch\'s commit history. lib/scheduling.ts is the read side of the ' +
      'mastery data lib/mastery.ts already wrote but nothing outside adaptive mode consumed for ordering: a structure\'s ' +
      'weight combines Laplace-smoothed accuracy — so one lucky or unlucky early answer does not over-correct — with the ' +
      'existing SM-2-lite schedule, measured against the structure\'s own interval. Nothing is ever weighted to zero, so a ' +
      'long-running account never permanently retires most of the dataset.',
    dependsOn: ['CR-006'],
    createdAt: '2026-08-31T19:55:00.000Z',
    startedAt: '2026-08-31T19:55:00.000Z',
    completedAt: '2026-09-03T15:00:00.000Z',
    notes:
      'Landed alongside CR-018\'s merge, not as its own commit — the branch this was reconstructed from also carried its ' +
      'own competing due-queue fix, superseded by CR-020, and its own CR-006 register entry, superseded by the one already ' +
      'shipped on this line of history.',
  },
  {
    ref: 'CR-020',
    title: 'Due queue prioritised, not restricted',
    category: 'content',
    priority: 'p1',
    effort: 's',
    status: 'completed',
    description:
      'Today, MobileToday and both revision setup screens passed the due review queue to the question generator as a hard ' +
      'restriction. Since answering a due structure reschedules it, the queue refilled itself faster than it drained: ' +
      'simulating seven days of daily use, a student met 19 of 285 structures and none at all after day one.',
    prompt:
      'No discrete prompt — found while starting CR-006 and fixed directly. Cap the due queue at a share of the session ' +
      '(REVIEW_SHARE) instead of restricting the pool to it, with either side topping up when the other runs short so the ' +
      'session always reaches its requested count.',
    dependsOn: [],
    createdAt: '2026-09-03T13:00:00.000Z',
    startedAt: '2026-09-03T13:00:00.000Z',
    completedAt: '2026-09-03T13:40:00.000Z',
    notes:
      'Shipped directly to main ahead of CR-018 — see generateSet.ts\'s priorityStructureIds/reviewShare and the four call ' +
      'sites that pass the due queue that way instead of as structureIds. Verified against a seeded account on the live ' +
      'project: a 20-question session split 12 due / 5 new / 3 seen-but-not-due, where the old path gave all 20 to the due ' +
      'queue.',
  },
  {
    ref: 'CR-021',
    title: 'Mobile sign-in entry point',
    category: 'auth',
    priority: 'p2',
    effort: 's',
    status: 'completed',
    description:
      'The mobile shell had no sign-in entry point at all — CR-001\'s auth (Google + email/password, anonymous-account ' +
      'linking) was reachable on desktop only.',
    prompt:
      'No discrete prompt — reconstructed from commit history. Add a mobile-equivalent account button (sign-in / real ' +
      'name + sign-out) to MobileShell, hidden entirely when VITE_PERSISTENCE=local, matching desktop\'s no-dead-buttons ' +
      'convention.',
    dependsOn: ['CR-001'],
    createdAt: '2026-09-03T13:44:00.000Z',
    startedAt: '2026-09-03T13:44:00.000Z',
    completedAt: '2026-09-03T13:44:00.000Z',
    notes: 'Small, self-contained: MobileAccountButton.tsx plus a few lines each in MobileShell.tsx, NavSidebar.tsx and AuthProvider.tsx.',
  },
  {
    ref: 'CR-022',
    title: 'OINA Cards: per-fact muscle drilling, and flashcards demoted to pure learning',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'completed',
    description:
      'Ask about origin, insertion, nerve supply and action one authored value at a time, as select-all ' +
      'questions that escalate to typed recall per (muscle, fact) as the student improves — and stop ' +
      'flashcards being answerable, so they are the teaching step rather than a self-graded question.',
    prompt:
      'The user asked for a question style aimed squarely at origins and insertions, which students find ' +
      'hardest, studiable from within the Atlas and scoped to a specific muscle group. Multiple choice to ' +
      'begin with, switching to typed answers over time to push the individual further. One answer box per ' +
      'value, so a two-headed muscle like biceps femoris gets two. For the multiple-choice phase, several ' +
      'options can be correct and ALL of them must be selected — possibly every option.\n\n' +
      'Mid-implementation the user added two things: in the early stages a flashcard should precede the ' +
      'question, and the answering facility should come off flashcards entirely — they should purely be ' +
      'for learning.\n\n' +
      'Four decisions were confirmed before implementation: (1) one field = one question, not a composite ' +
      'card screen; (2) the MCQ phase is a per-field select-all, all-or-nothing; (3) escalation is tracked ' +
      'per (muscle, fact), not per muscle; (4) the name is OINA Cards. Two more for the flashcard change: ' +
      'both the typed box and the Easy/Medium/Hard rating go, and a revealed card keeps its 5 XP. The ' +
      "learn-card rule was the user's: the first 3 attempts at a fact, and any time the last one was wrong.\n\n" +
      'THE STARTING POINT WAS NOT NOTHING\n' +
      'mcq.ts already emitted origin/insertion/nerve/action MCQs. They were unanswerable in a specific ' +
      "way: field.join('; ') collapsed a whole field into one choice, so \"What is the origin of biceps " +
      'femoris?" offered "Long head: ischial tuberosity; Short head: linea aspera of the femur" against ' +
      'three other blobs. That tests blob-shape recognition, not anatomy. Those MCQs are untouched; OINA ' +
      'is the per-item counterpart.\n\n' +
      'WHAT WAS BUILT\n' +
      "1. ONE QuestionType 'oina', with select/typed as a nested `format` discriminant — not two members. " +
      'Two would have silently broken adaptive mode: pickAdaptiveQuestionType is a flat QuestionType[] ' +
      'ladder, so neither member appears in any tier and every adaptive session falls through to ' +
      'requestedTypes[0], pinning every student to select format regardless of mastery. It also costs ' +
      '~10 integration sites per member for a distinction the user never makes.\n' +
      '2. lib/oinaValues.ts — head-prefix stripping, nerve-name canonicalisation, action-tag equivalence, ' +
      'and a conflictsWith predicate rejecting any distractor that names the same site as the answer in ' +
      'different words. lib/oinaAnswer.ts — the typed grader. lib/factMastery.ts — the escalation ladder ' +
      '(promote after 3 consecutive correct AND >=70% accuracy; demote after 2 typed misses).\n' +
      '3. FactMastery, a new per-(structure, promptKind) record beside StructureMastery, in all three ' +
      'repositories. firestore.rules and firestore.indexes.json were checked and deliberately NOT changed: ' +
      'the existing users/{uid} document wildcard already covers the new subcollection for owner write, ' +
      'admin read and cohort-scoped educator read, and it is read whole with no where/orderBy so there is ' +
      'no composite index to add. Recorded here so a later reader does not assume it was forgotten.\n' +
      '4. Learn cards are inserted AFTER the shuffle/sample/slice in generateRevisionSet, so the pairing ' +
      'survives shuffling and cards do not eat the question budget — count: 20 means 20 questions to ' +
      'answer plus however many cards are needed to teach them. Exam sessions get none; they test rather ' +
      'than teach.\n' +
      '5. Flashcards: reveal and move on. AnswerRecord/UserAttempt gained `graded?: boolean`, false for a ' +
      'card. Ungraded exposures are still recorded and still pay 5 XP, but are excluded from the session ' +
      'score, from SM-2 scheduling, and from every accuracy figure in admin and educator analytics.\n' +
      '6. Launch surfaces: an OINA Cards chip plus a facts row and muscle-group picker on both setup ' +
      'screens; "Drill these facts" on the Atlas, scoped to the current filter; OINA added to the Today ' +
      'default mix and to the Progress untouched/leech drills; MUSCLE_GROUP_LABELS authored for the ~28 ' +
      'groups worth offering, on the JOINT_TYPE_LABELS precedent.\n' +
      '7. On review the user asked for the number of teaching repeats to be settable, saying once would ' +
      'suit them but not necessarily others — so it is a per-device preference (Never / Once / 3 times / ' +
      '5 times) on both setup screens, persisted in localStorage beside the onboarding flag rather than ' +
      'in Firestore, since it describes how one person likes to study and a session should not have to ' +
      'wait on a read to start. The default stays 3: a student who already knows the material finds ' +
      'repeats tedious, but one who does not cannot recall an attachment they have been shown once. 0 ' +
      'turns teaching off entirely, including the re-teach after a wrong answer — someone who asks for no ' +
      'cards means it.\n' +
      '8. Also on review, the user asked for the alternatives to be drawn from the same muscle group as the ' +
      'question. They were right that they were not: nerve and action distractors were sampled from the ' +
      'reverse indexes globally, and only ~18% of that key pool sits in any given muscle\'s own group or ' +
      'region — so roughly four in five alternatives could be eliminated without knowing the anatomy, on ' +
      'the grounds that the median nerve belongs to the arm. Added a shared-group tier to tieredPool and a ' +
      'pickTieredKeyDistractors that walks the same tiers, with the global index kept only as a top-up for ' +
      'muscles whose neighbours all share their nerve (every hamstring is tibial, so every group-mate\'s ' +
      'key is rejected as a true answer). Measured after: 0% unrelated across all four facts, with 86% of ' +
      'origin and 78% of insertion alternatives now coming from the same group. Pinned as a test.\n' +
      '9. MobileAtlas, so the Atlas is not desktop-only. MobileTabBar\'s own comment noted its "Atlas" tab ' +
      'pointed at the area picker because no browsable muscle list existed on mobile — which meant the ' +
      'premise of the feature, studying a muscle\'s facts from the atlas, was unreachable on a phone. The ' +
      'tab now goes where its label says; the area picker keeps its place as the first step of starting a ' +
      'session, reached from Today, and loses its tab bar the way Setup already had.\n' +
      '10. Finally, the user asked for OINA to drop the session-length picker and simply cover every card ' +
      'for the muscles in scope. "Do the hamstrings" is the unit a student thinks in, and a 20-question ' +
      'cap leaves a group half-learned with no indication of which half. Selecting OINA now replaces the ' +
      'Length control with the count it will actually generate — muscles in scope x facts chosen, which is ' +
      'exact rather than an estimate because validateContent asserts every muscle yields all four — and ' +
      'passes no `count`, which practice mode already treats as "every eligible question". The Atlas ' +
      'drill lost its cap of 20 for the same reason.\n\n' +
      'ACCEPTANCE\n' +
      '- npm run test, npm run build, npm run lint and npm run validate-content all pass.',
    dependsOn: ['CR-017', 'CR-020'],
    createdAt: '2026-09-03T09:00:00.000Z',
    startedAt: '2026-09-03T09:10:00.000Z',
    completedAt: '2026-09-03T13:40:00.000Z',
    notes:
      'THE CONTENT WAS THE REAL WORK. Per-item questions make a closed-world claim the data did not ' +
      'support, and every wording inconsistency that used to hide inside a joined string became a choice ' +
      'a student could not fairly answer.\n\n' +
      'actions[] disagreed with actionText on 7 muscles. adductor-longus and adductor-brevis were tagged ' +
      'hip-adduction only while their own actionText said "assists hip flexion" — a student ticking Hip ' +
      'flexion would have been marked wrong by a screen that then told them they were right. The four ' +
      'deep external rotators said "and stabilisation of the hip joint" with no stabilisation tag; ' +
      'gluteus medius lacked hip-internal-rotation while gluteus minimus had it, on near-identical prose. ' +
      'Fixed in the raw JSON (new hip-stabilisation tag), plus EQUIVALENT_ACTION_GROUPS for the four ' +
      'stabilisation synonyms and for inspiration/accessory-inspiration, which a student cannot choose ' +
      'between.\n\n' +
      'Nerve names needed five rules, not one. Head/part qualifiers strip ("Tibial nerve (long head)"); ' +
      'mid-string synonyms are not trailing, so a $-anchored regex silently no-ops ("Deep fibular ' +
      '(peroneal) nerve", which the other four muscles it supplies already author as "Deep fibular ' +
      'nerve"); compounds split by explicit allowlist, never a generic "&" rule, which would also shred ' +
      '"Superior angle & medial border of scapula"; dorsal and posterior rami fold onto one name. Two ' +
      'classes are excluded from the correct set rather than normalised: the accessory obturator nerve on ' +
      'pectineus, authored "(sometimes)" and present in roughly 10-15% of people, which select-ALL would ' +
      'have made mandatory; and the bare root designations ("C3-C4 (sensory)" on trapezius, ' +
      'sternocleidomastoid and levator scapulae), which are not answers to "what nerve innervates this".\n\n' +
      "THE 28 FALSE ACCEPTS THAT KILLED THE OBVIOUS GRADER. isAnswerMatch's fixed edit distance of 1 is " +
      'far too strict for an attachment phrase, and the obvious fix — scaling tolerance by string length ' +
      '— is worse than the problem: it hands out the most slack exactly where the discriminating ' +
      'difference is one character. Swept against every pair of authored values it accepted "anterior ' +
      'inferior iliac spine" for "anterior superior", "base of 2nd metacarpal" for "3rd", "spinous ' +
      'processes C7-T12" for "C7-T1", and "supraspinous fossa" for "infraspinous". Replaced with ' +
      'token-set matching: identifier tokens (digits, vertebral levels, laterality) must match exactly, ' +
      "ordinary words tolerate one typo, and 85% of the answer's words must appear. That threshold was " +
      'not guessed — it was swept over all 234 distinct attachment values, and 0.85 is the lowest that ' +
      'still rejects "Lesser" for "Greater trochanter of the femur" (2 of 3 words shared) and flexor ' +
      'digitorum "profundus" for "longus" (3 of 4). oinaAnswer.test.ts pins the invariant against every ' +
      'pair in the dataset, with the five remaining accepts listed by name — each is the same site worded ' +
      'two ways, so accepting them is correct behaviour, and a regression shows up as a new entry rather ' +
      'than a larger number.\n\n' +
      'FOUND ONLY BY RUNNING THE GENERATOR OVER ALL 122 MUSCLES: triceps brachii is the one muscle whose ' +
      'values collapse. Its three heads strip to two distinct origins, because the lateral and medial ' +
      'heads both read "Posterior humerus". Left alone that is two identical choice buttons and, with the ' +
      'key={choice} pattern MultiSelectSession uses, a duplicate React key desyncing the reveal state. ' +
      'Deduped, keyed by index as well as text, and asserted in validateContent so the content cannot ' +
      'drift back.\n\n' +
      'ONE SUBTLE XP BUG, caught while wiring the ungraded path: a learn card sits immediately before its ' +
      'question and both name the same structure, so without excluding ungraded records from ' +
      'seenCorrectStructures the card would take the 10 XP first-correct bonus off the question it exists ' +
      'to teach. Same class of problem for fastestCorrectAnswerMs — revealing a card is instantaneous and ' +
      'would have taken that record off every real answer.\n\n' +
      'FOUR BUGS THAT ONLY A REAL SESSION FOUND. The unit tests were green and the build was clean before ' +
      'any of these surfaced; all four came out of driving the app over CDP.\n' +
      '(1) Every learn card failed to save, with the persist-error banner up from the very first card. ' +
      'This environment runs VITE_PERSISTENCE=firestore, and Firestore rejects any document holding an ' +
      'undefined field: taking the rating off flashcards left `confidence: undefined` on every card ' +
      'attempt. Fixed by stripping undefined keys in firestoreRepository before every setDoc, which also ' +
      'covers exam-mode answers and unscheduled mastery rows — both of which had the same latent problem.\n' +
      '(2) The session sidebar read "1 correct" the moment a card was revealed, because it counted every ' +
      'answer rather than the graded ones. (3) The counter read "1 / 31" on a session the setup screen had ' +
      'promised 20 questions for, because the total included learn cards. Both now count questions only, ' +
      'matching the results screen, with a fallback for a flashcard-only session that has no graded ' +
      'questions at all.\n' +
      '(4) The distractor retiering shifted the RNG stream and broke an existing MCQ test — which turned ' +
      'out to be a pre-existing bug in mcq.ts, not a regression: infraspinatus and teres minor have ' +
      'byte-identical actionText, and the action MCQ sampled a flat un-deduped list, so it could render ' +
      'the same string as two separate choices. It had simply never landed on seed 5 before. Deduped.\n\n' +
      'STILL OPEN. Select-all is degenerate for most muscles: 104 of 122 insertions and 74 of 122 origins ' +
      'have exactly one value, so most questions have a single correct answer. The count is shown up ' +
      'front ("2 correct answers") to stop all-or-nothing scoring punishing doubt about whether one was ' +
      'missed; if that reads as too generous it is one line in OinaSelectSession. The muscle-group axis ' +
      'is still imperfect as authored — quadriceps and knee-extensors are byte-identical four-muscle ' +
      'sets, so only one is offered. Component behaviour is covered by a smoke test, a deliberate ' +
      "deviation from this repo's pure-lib testing convention, because these are the first components " +
      'with real grading logic inside them.\n\n' +
      'VERIFIED IN THE APP, not just in tests: an OINA-only hamstrings session answered through four ' +
      'rounds against the real Firestore backend, watching origin escalate from select to typed on the ' +
      'fourth (and its learn card correctly stop appearing once the fact had three attempts behind it); ' +
      'the mobile Atlas searched down to two muscles and drilled exactly those eight facts; and no ' +
      'persist error in either.',
  },
  {
    ref: 'CR-023',
    title: 'PWA foundation and offline revision',
    category: 'infrastructure',
    priority: 'p0',
    effort: 'l',
    status: 'inProgress',
    description:
      'Convert the Vite SPA into an installable, offline-capable PWA: self-hosted fonts, web app manifest, service worker, ' +
      'Firestore offline persistence and per-area image downloads. Offline is the feature, not just the store requirement — ' +
      'students revise on placement, on public transport and in hospital basements with no signal.',
    prompt:
      'Convert this Vite 6 + React 19 + TypeScript app into an installable, offline-capable PWA.\n\n' +
      '1. SELF-HOST THE FONTS. Download Newsreader, IBM Plex Sans and IBM Plex Mono, serve from public/fonts/, remove the\n' +
      '   Google Fonts <link>. The CDN request fails offline and blocks first paint, and passing user IP addresses to Google\n' +
      '   has been found to breach GDPR in EU case law. font-display: swap, preload the two above-the-fold weights.\n' +
      '2. MANIFEST at public/manifest.webmanifest: name, short_name (under 12 chars), start_url "/", display "standalone",\n' +
      '   background_color/theme_color from the CSS custom properties in src/index.css, icons at 192/256/384/512 plus a\n' +
      '   maskable 512. Add apple-touch-icon, theme-color and a real description meta tag — there is currently none.\n' +
      '3. SERVICE WORKER via vite-plugin-pwa + Workbox: precache the shell/JS/CSS/fonts; CacheFirst for /anatomy/** with a\n' +
      '   30-day expiry; NetworkFirst for Firestore; an update prompt that does NOT silently reload mid-session and lose answers.\n' +
      '4. OFFLINE REVISION. Firestore persistentLocalCache with multi-tab so attempts/mastery/summaries queue and sync on\n' +
      '   reconnect. An explicit per-area "download for offline" showing size, with removal. An offline indicator, and grey out\n' +
      '   what genuinely needs network (sign-in, class join) rather than letting it fail silently. Content is static in the\n' +
      '   bundle, so verify nothing in the session path awaits a Firestore read before rendering a question.\n' +
      '5. BUNDLE. Split the index chunk — Firebase is the bulk. manualChunks for firebase/auth and firebase/firestore, and\n' +
      '   lazy-load Firestore so revision can start before it resolves.\n\n' +
      'CONSTRAINTS: offline degrades gracefully, never blank-screens; do not cache auth tokens in the service worker;\n' +
      'all existing tests pass, plus new ones for the offline queue-and-sync path.\n' +
      'ACCEPTANCE: npm run build passes; Lighthouse PWA installability passes; with the network disabled after first load a\n' +
      'full revision session completes and syncs on reconnect.',
    dependsOn: [],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: '2026-09-09T10:00:00.000Z',
    completedAt: null,
    notes:
      'Item 1 (self-hosted fonts) and the missing description meta tag are DONE — 12 Latin-subset woff2 files in public/fonts/, ' +
      'generated by src/scripts/fetchFonts.ts, no request to Google remaining. Newsreader and IBM Plex Sans are variable fonts ' +
      'served as one file per subset, so naming downloads per weight fetched identical bytes three times; deduping by URL took ' +
      'the payload from 1.1MB to 508KB, which matters once a service worker precaches it.\n\n' +
      'ITEM 5 IS WRONG AS WRITTEN. "Firebase is the bulk of it" is not true: firebase already resolves to its own ~490kB chunk ' +
      'via the dynamic import in data/firebase.ts, and appears twice in the index chunk. The 813kB is React, the router and ' +
      '~536KB of anatomy seed content, which is static in the bundle deliberately so offline needs no fetch — the point of this ' +
      'whole CR. manualChunks for firebase would change nothing. If first paint needs improving, the real lever is lazy-loading ' +
      'the content itself, which conflicts with offline-first and should be decided rather than assumed.\n\n' +
      'Icons remain blocked on the logo (CR-028 part 2), which blocks the manifest and therefore installability.',
  },
  {
    ref: 'CR-024',
    title: 'Capacitor native shell and review notifications',
    category: 'infrastructure',
    priority: 'p0',
    effort: 'l',
    status: 'new',
    description:
      'Package the PWA as native iOS and Android apps with genuine native capability — local review notifications, filesystem-backed ' +
      'offline downloads, native auth — rather than a webview wrapper. Minimum functionality (App Store guideline 4.2) is the most ' +
      'common rejection reason and is used specifically to filter out web wrappers.',
    prompt:
      'Package this PWA as native iOS and Android apps using Capacitor, with genuine native functionality.\n\n' +
      '1. Capacitor with ios/ and android/ projects. Bundle web assets LOCALLY — do not point a webview at the Netlify URL.\n' +
      '2. NATIVE CAPABILITIES, each genuinely functional:\n' +
      '   - LOCAL NOTIFICATIONS for due reviews, scheduled from existing mastery data. The strongest single justification: a\n' +
      '     website cannot tell a student 14 structures are due this morning. Schedule locally so it works offline; settings\n' +
      '     screen for time-of-day and opt-out.\n' +
      '   - OFFLINE AREA DOWNLOADS on the native filesystem so they survive storage pressure.\n' +
      '   - Native status bar, splash screen, safe-area insets, haptics on answer submission, share sheet.\n' +
      '3. NATIVE AUTH via the Capacitor Firebase Authentication plugin. Sign in with Apple is REQUIRED on iOS if any\n' +
      '   third-party sign-in is offered.\n' +
      '4. Hide /admin/* and /educator/* from native builds unless shipping them — unreachable UI in a binary can trigger a\n' +
      '   hidden-features rejection under 2.3.1.\n' +
      '5. REVIEW-NOTES.md listing every native capability with exact steps to exercise it, plus a demo account with seeded\n' +
      '   progress. State plainly what the app does that the website cannot.\n\n' +
      'CONSTRAINTS: one codebase, no forked native UI; never load remote code at runtime (guideline 2.5.2); test on a real device.\n' +
      'ACCEPTANCE: both platforms build from a clean checkout; a due-review notification fires in airplane mode; a downloaded\n' +
      'area is fully revisable after a cold start.',
    dependsOn: ['CR-023'],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes: 'Needs an Apple Developer account, native toolchains and a physical device — not startable unattended.',
  },
  {
    ref: 'CR-025',
    title: 'Legal, privacy and store compliance',
    category: 'infrastructure',
    priority: 'p0',
    effort: 'm',
    status: 'new',
    description:
      'Privacy policy, terms, attributions page, in-app account deletion and data export, educator consent and an age gate. ' +
      'Not primarily store compliance — UK GDPR. Named students generate performance data a course leader can see, which needs a ' +
      'published policy, a stated lawful basis and a deletion route before a pilot can run, free or not.',
    prompt:
      'Add the legal and privacy infrastructure this app needs before pilots and store submission.\n\n' +
      '1. PRIVACY POLICY at /privacy, reachable without sign-in, linked from footer, account screen and both store listings.\n' +
      '   State: what is collected (email, display name, answer-level performance data, device identifiers), the lawful basis\n' +
      '   under UK GDPR, that class owners see named performance data for students who join their class, retention periods,\n' +
      '   third-party processors (Google Firebase), and how to exercise access, rectification, erasure and portability.\n' +
      '2. TERMS at /terms, including that this is an educational revision tool, not a clinical or diagnostic resource, with no\n' +
      '   warranty of anatomical accuracy for clinical decision-making.\n' +
      '3. ACCOUNT DELETION in-app, at most two taps from the account screen. Must delete profile, attempts, mastery, session\n' +
      '   summaries and class membership — not deactivate. Server-side so it cannot partially complete.\n' +
      '4. DATA EXPORT — JSON download of the user\'s own data. Cheap alongside deletion and satisfies portability.\n' +
      '5. EDUCATOR CONSENT. Joining a class must show, before joining, exactly what the owner will see. Leaving is one action\n' +
      '   and stops further visibility. Educators see aggregate and summary performance, never a keystroke-level record.\n' +
      '6. AGE. Appropriate rating plus a date-of-birth or over-16 confirmation at sign-up. Avoid inheriting UK GDPR\n' +
      '   children\'s provisions and Google Play Families policy deliberately rather than by accident.\n' +
      '7. ATTRIBUTIONS at /attributions: every image credit and licence, the Z-Anatomy attribution linking the source and the\n' +
      '   CC BY-SA 4.0 deed, the muscle dataset source, and open-source licences. A licence field on a badge is not sufficient\n' +
      '   for a shipped commercial product.\n' +
      '8. Play Data Safety and Apple privacy labels as a checked-in markdown file, so they match the code.\n\n' +
      'ACCEPTANCE: /privacy, /terms and /attributions render without authentication; account deletion removes every trace of a\n' +
      'test user from Firestore, verified by query.',
    dependsOn: [],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'THE PILOT BLOCKER — a university will ask, and it applies to a free pilot exactly as to a paid product. Note there is no ' +
      'functions/ directory and firebase.json declares only firestore rules and indexes, so item 3 needs a Cloud Functions project ' +
      'bootstrapped first; that is unscoped in this prompt. Items 1, 2 and 6 need Rory\'s own details (legal entity, contact ' +
      'address, retention periods); item 7 is derivable from the image data alone.',
  },
  {
    ref: 'CR-026',
    title: 'Image coverage completion; retire AI illustrations',
    category: 'content',
    priority: 'p1',
    effort: 'l',
    status: 'new',
    description:
      'Close the 68 structures with no image (44 muscles, 23 joints, 1 bone) using the Z-Anatomy Blender pipeline, and retire the ' +
      '14 remaining AI-generated illustrations. Escalated from polish to competitive necessity: every rival leads with visuals, and ' +
      'for an app teaching attachments, AI anatomy is the content most likely to be confidently wrong.',
    prompt:
      'Complete image coverage and remove the remaining AI-generated illustrations.\n\n' +
      '1. Run the existing Z-Anatomy pipeline for the 44 uncovered muscles, matching established render settings so the library\n' +
      '   stays visually consistent.\n' +
      '2. JOINTS need a different treatment — an articulation is a relationship between bones, not an isolated object. Render each\n' +
      '   showing its articulating surfaces with the relevant ligaments, from the view that best shows the articulation. Decide and\n' +
      '   document the convention BEFORE rendering 23 of them.\n' +
      '3. Retire each of the 14 AI images as a Z-Anatomy equivalent lands. Where none is practical, remove the image rather than\n' +
      '   shipping it — a structure with no image degrades gracefully; one with a wrong image teaches something false.\n' +
      '4. Author hotspots for every new render via the existing editor so locate coverage grows with image coverage. Target locate\n' +
      '   questions for the substantial majority of the 122 muscles.\n' +
      '5. Re-run the audit and record in the README: structures without images, images by licence, questions by type.\n\n' +
      'CONSTRAINTS: accurate credit and licence on every new image (Z-Anatomy, CC BY-SA 4.0); never hand-edit imageIds, they are\n' +
      'auto-linked by lib/linkImages.ts; run npm run validate-content after integration.\n' +
      'ACCEPTANCE: zero structures with no linked image (or a documented exception list); zero images licensed All rights reserved;\n' +
      'test, build and validate-content all pass.',
    dependsOn: [],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Needs the Blender source models under /atlas and /renders, which are gitignored and ~2GB — this runs on Rory\'s machine, not ' +
      'unattended. The joint convention in item 2 is a judgement call to make before bulk rendering.',
  },
  {
    ref: 'CR-027',
    title: 'Monetisation: entitlements, paywall and institutional licences',
    category: 'infrastructure',
    priority: 'p1',
    effort: 'l',
    status: 'new',
    description:
      'An entitlement layer every gate checks, a permanently free area, a paywall, Stripe on web and RevenueCat-normalised IAP on ' +
      'native, and redeemable institutional licences with seat tracking. The individual subscription pays the bills; the ' +
      'institutional licence is the business.',
    prompt:
      'Add monetisation supporting both individual subscriptions and institutional licences.\n\n' +
      '1. ENTITLEMENT LAYER FIRST, and route everything through it. An `entitlement` on the user document:\n' +
      '   { tier, source, expiresAt, seatId } where tier is free|individual|institutional and source is web|apple|google|licence.\n' +
      '   One useEntitlement() hook and a matching Firestore rules helper. Every gate checks the entitlement, never the payment\n' +
      '   provider — this is what lets pricing change without touching feature code.\n' +
      '2. FREE TIER — one complete area, permanently, with every question type. Not a trial, not a crippled demo. Every competitor\n' +
      '   has a free tier. Make the area configurable, not hardcoded.\n' +
      '3. PAYWALL on reaching locked content, never mid-session. Monthly, annual (default-selected, best value), and a three-year\n' +
      '   course pass once retention data justifies it. 7-day trial, not 3. Do NOT show a discount on the main paywall; implement a\n' +
      '   post-close offer for users who dismissed without converting.\n' +
      '4. WEB PAYMENTS via Stripe Checkout with a Cloud Function webhook writing the entitlement. Handle renewal, cancellation,\n' +
      '   failure and refund. Never let the client write its own entitlement — enforce in firestore.rules.\n' +
      '5. NATIVE PAYMENTS must use platform IAP (guideline 3.1.1); Stripe is not permitted. RevenueCat to normalise both stores\n' +
      '   against the same entitlement document. Register for Apple\'s Small Business Program (15% rather than 30%).\n' +
      '6. INSTITUTIONAL LICENCES — the highest-value part. A licences collection { id, institution, seats, seatsUsed, validFrom,\n' +
      '   validUntil, code, ownerEmail }; redemption from account settings that increments seatsUsed and refuses when exhausted;\n' +
      '   admin screens to issue, extend, revoke and monitor; auto-link redeemers to the institution\'s class so cohort analytics\n' +
      '   populate without the educator chasing anyone. Sold direct and invoiced, so no platform commission.\n' +
      '7. Do not build ads, an ad-removal purchase, or any ad SDK.\n\n' +
      'CONSTRAINTS: entitlement writes server-side only; fully usable offline for an entitled user; a lapsed subscriber keeps their\n' +
      'history and free area. Vitest coverage for expiry, seat exhaustion, and precedence when a user holds both entitlements.',
    dependsOn: ['CR-025'],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Needs a Stripe account and, for item 5, the native builds from CR-024. Pricing is settled in the backlog document: free area, ' +
      'GBP 4.99/mo, GBP 29.99/yr, GBP 10-12/student/yr institutional; the course pass ships later, once a renewal rate exists to price it against.',
  },
  {
    ref: 'CR-028',
    title: 'Demo deploy, brand and commercial site',
    category: 'infrastructure',
    priority: 'p1',
    effort: 'm',
    status: 'inProgress',
    description:
      'Three separable pieces in order of value per hour: deploy the seeded educator demo as the asset every pilot approach links to; ' +
      'clear and register the LocusMSK name and commission a logo; build a static marketing site separate from the SPA, which renders ' +
      'client-side and cannot be indexed.',
    prompt:
      'PART 1 — Deploy the educator demo build as a standalone public site (DONE, see notes).\n\n' +
      'PART 2 — Trademark and logo. Not a coding task. Clear "LocusMSK": UK IPO classes 9 and 41, locusmsk.com and .co.uk, App Store\n' +
      'and Play Store name search, Companies House. Commission a logo (GBP 200-500): must work at 48px and as a 512px maskable icon,\n' +
      'light and dark; no anatomical illustration — every competitor uses a muscle or skeleton and it renders as mush small. SVG master\n' +
      'plus the full PWA icon set for CR-023. Rename the codebase in ONE commit before CR-023 so the manifest and icons are generated\n' +
      'under the final name. Register the mark once cleared and in use, before store submission.\n\n' +
      'PART 3 — Commercial site. Static (Astro or plain HTML), its own Netlify site, because the app is a client-rendered SPA that\n' +
      'search engines see as an empty shell. Pages: home; for students; for educators (the one that matters — cohort dashboard, pilot\n' +
      'offer, link to the demo, contact form, and the Part 0 positioning table largely verbatim); pricing with institutional as\n' +
      '"contact us"; legal linking through to the app\'s own pages. Two distinct audiences: students go straight into the free area\n' +
      'with no sign-up, educators want evidence and a person — do not funnel both through one CTA. Stripe Checkout for individuals;\n' +
      'institutional is a contact form and an invoice, because universities pay by purchase order. SEO: target long-tail MSK terms,\n' +
      'not head keywords. Comparison pages ("LocusMSK vs Kenhub", "vs TeachMeAnatomy") are the exception and are winnable — be\n' +
      'scrupulously accurate about competitor prices and date every claim.\n' +
      'ACCEPTANCE: Lighthouse SEO and performance above 90; a student reaches a working question within two clicks; an educator\n' +
      'reaches the populated demo dashboard within one.',
    dependsOn: [],
    createdAt: '2026-09-08T09:00:00.000Z',
    startedAt: '2026-09-08T14:00:00.000Z',
    completedAt: null,
    notes:
      'Part 1 is built: npm run build:demo through vite.config.demo.ts, /admin dropped from the bundle, VITE_PERSISTENCE pinned local, ' +
      'demo fixtures made realistic, sample-data banner and reset added, and a [context.demo] block in netlify.toml so a second site ' +
      'does not inherit the production build. Outstanding: create the Netlify site, and Parts 2 and 3. Part 2 gates the PWA icons in ' +
      'CR-023, and nothing should be promised at demo.locusmsk.com until the name clears.',
  },
  {
    ref: 'CR-029',
    title: 'Educator dashboard works below 1024px',
    category: 'infrastructure',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'The educator section rendered through AppShell, a fixed 260px sidebar documented desktop-only, inside px-16 padding — on a 375px ' +
      'phone that is more than the viewport before any content. App.tsx routed /educator/* with no mobile branch, unlike every student ' +
      'screen. A course leader sent a link by email opens it on a phone.',
    prompt:
      'Make /educator/* usable below 1024px.\n\n' +
      'Prefer a responsive shell to the parallel Mobile* screen tree the student side uses: the student screens differ by design across\n' +
      'the breakpoint, whereas every educator screen is a table or list that reflows once given the width (the students table is already\n' +
      'wrapped for overflow). The shell is the whole problem.\n\n' +
      '- EducatorShell branches on useIsDesktop() into a mobile shell below 1024px, with CohortsProvider outside the branch so crossing\n' +
      '  the breakpoint does not refetch.\n' +
      '- The mobile shell: header with brand, class switcher and a horizontally scrollable section strip; 44px tap targets; its own\n' +
      '  tighter padding. No bottom tab bar — five sections with long labels are a section index, not top-level destinations.\n' +
      '- Nav items move to a shared module, since two shells now render them.\n' +
      'ACCEPTANCE: every educator screen is readable and operable at 375px; the desktop sidebar is unchanged above 1024px.',
    dependsOn: [],
    createdAt: '2026-09-09T09:00:00.000Z',
    startedAt: '2026-09-09T09:30:00.000Z',
    completedAt: '2026-09-09T10:30:00.000Z',
    notes:
      'Raised by Rory from the demo build. Shipped as EducatorMobileShell plus educatorNav.ts; the desktop sidebar now reads its nav from ' +
      'the same module so a new section cannot reach one shell only.',
  },
  {
    ref: 'CR-030',
    title: 'List the educator\'s classes at /educator',
    category: 'infrastructure',
    priority: 'p2',
    effort: 's',
    status: 'completed',
    description:
      '/educator redirected everyone to cohorts[0]. With two classes that silently picked one and left the other reachable only through a ' +
      'select in the desktop sidebar — invisible on a phone and easy to miss on a laptop.',
    prompt:
      'Show a class list at /educator when the educator owns more than one class. Keep the straight-in redirect for exactly one, because a\n' +
      'list of one is a click that buys nothing, and keep the create form for none. Archived classes sort last and are labelled rather than\n' +
      'hidden, so last year\'s cohort is still findable. Rows need 44px tap targets — on a phone this is the section\'s landing screen.',
    dependsOn: [],
    createdAt: '2026-09-09T09:00:00.000Z',
    startedAt: '2026-09-09T10:30:00.000Z',
    completedAt: '2026-09-09T11:00:00.000Z',
    notes:
      'Raised by Rory alongside CR-029. Note the account screen was never the gap: MyClasses has listed owned classes on both Account and ' +
      'MobileAccount since CR-012. What was missing was any class list inside the educator section itself.',
  },
  {
    ref: 'CR-031',
    title: 'Educators read aggregates, not answer-level rows',
    category: 'infrastructure',
    priority: 'p0',
    effort: 'l',
    status: 'new',
    description:
      'firestore.rules grants a cohort owner read on every attemptEvent of every student in their class, selectedAnswer ' +
      'included, and cohortAnalytics pulls those rows into the educator\'s browser to aggregate them client-side. Nothing in ' +
      'the UI displays them, so nobody sees this by accident — but the access exists, and the join notice had to be weakened ' +
      'to stop promising otherwise. Close the gap so the strong promise can come back.',
    prompt:
      'Stop answer-level student data reaching educator clients.\n\n' +
      'CURRENT STATE\n' +
      '- firestore.rules: `allow read: if ownsCohort(cohortOfUser(resource.data.userId))` on /attemptEvents/{attemptId}.\n' +
      '- educator/data/cohortAnalytics.ts calls listAttempts({ userId }) per student and returns attemptsByUid in the\n' +
      '  snapshot, so full UserAttempt records — selectedAnswer, correctAnswer, questionId, durationMs, timestamp — are in\n' +
      '  the educator\'s browser. Devtools is all it takes.\n' +
      '- The aggregation itself is clean: aggregateConfusionPairs discards userId.\n\n' +
      'WHAT TO BUILD\n' +
      'Aggregate on write rather than on read, so the educator never has permission to see a row.\n' +
      '1. When a student answers, increment cohort-scoped aggregate documents rather than relying on the educator to\n' +
      '   compute them later: per-structure attempt/correct counts, per-(correctAnswer, selectedAnswer) confusion counts,\n' +
      '   per-day active counts, per-region accuracy. Counter documents, not rows.\n' +
      '2. Per-student summary documents for the students list and detail screens — attempts total, accuracy, last active,\n' +
      '   weakest structures. Everything those screens already render, and nothing they do not.\n' +
      '3. Rewrite firestore.rules so a cohort owner reads ONLY those aggregates and summaries. The attemptEvents read grant\n' +
      '   for cohort owners goes away entirely.\n' +
      '4. Migrate: a one-off backfill for existing cohorts, since aggregates that start empty make a live class look\n' +
      '   inactive on the morning this ships.\n' +
      '5. Restore the stronger sentence in CohortMembership.tsx once (3) is live, and say so in the privacy policy.\n\n' +
      'CONSTRAINTS\n' +
      '- A student writing their own aggregate increment must not be able to write another student\'s, or another cohort\'s.\n' +
      '- Offline must still work: increments queue like any other write.\n' +
      '- The educator demo fixtures need the same shape, or the demo diverges from the product it is selling.\n' +
      '- Cloud Functions would be the tidier home for this, but there is no functions/ project yet (firebase.json declares\n' +
      '  only firestore rules and indexes). Client-side increments under tight rules avoid that dependency; a Function is\n' +
      '  the better answer if CR-025 bootstraps one first.\n\n' +
      'ACCEPTANCE\n' +
      '- An educator client issued a direct query for a student\'s attemptEvents is refused by rules.\n' +
      '- Every educator screen renders the same numbers it does today.',
    dependsOn: [],
    createdAt: '2026-09-09T11:30:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Found while checking whether the join notice was true. It was not. The notice now says "the app does not show them a ' +
      'question-by-question record", which is accurate, rather than "never your individual answers", which was not. P0 because ' +
      'it is a promise to students and the first thing a university DP officer will probe — but it does not block a pilot the ' +
      'way CR-025 does, since the corrected wording is honest as it stands.',
  },
  {
    ref: 'CR-032',
    title: 'Split Back & Core into Cervical, Thoracic and Lumbar Spine',
    category: 'content',
    priority: 'p1',
    effort: 'm',
    status: 'completed',
    description:
      'One "Back & Core" chip covered 85 structures from the atlas to the coccyx, which is not how the spine is revised — a ' +
      'student working on the cervical spine had no way to ask for it. The picker now offers Cervical Spine, Thoracic Spine ' +
      'and Lumbar Spine. The thoracic cage folds into thoracic, the abdominal wall and the sacrum into lumbar, and a ' +
      'vertebral part with no level of its own (a pedicle, a facet joint, the erector spinae) appears under all three — so a ' +
      'structure can now belong to several areas at once.',
    prompt:
      'Replace the Back & Core study filter with Cervical Spine, Thoracic Spine and Lumbar Spine.\n\n' +
      'WHAT CHANGED\n' +
      '- Area gained the three spine values and lost back-core. Region is untouched: it names the files under ' +
      'public/anatomy/regions/, every persisted UserAttempt, and the admin analytics breakdown.\n' +
      '- SubRegion is untouched too — spine/torso/neck are baked into the generated plate and panel modules — so the areas ' +
      'derive from it: AREAS_BY_SUBREGION maps neck to cervical, torso to thoracic, and spine to all three.\n' +
      '- A structure\'s `area` override became `areas`, and areaOf became areasOf. The seeds narrow the default where a ' +
      'structure does have a level (sacrum and its landmarks to lumbar, the costal facets and costovertebral joint to ' +
      'thoracic), and TRUNK_AREAS_BY_GROUP does the same for the trunk muscles, which carry no level in the source data.\n' +
      '- Filtering matches on overlap, and the pickers count a multi-area structure under each of its areas.\n' +
      '- A question still carries one area, since that is what the session header names, but generateSet re-stamps it with ' +
      'the area the student actually filtered by — otherwise a pedicle in a lumbar session would be headed "Cervical Spine".\n' +
      '- normaliseAreas expands a persisted back-core: a stored preference or a Firestore assignment scope written before ' +
      'the split reads back as all three spine areas.\n\n' +
      'ACCEPTANCE\n' +
      '- validateContent reports nine areas, none empty, no structure without one.\n' +
      '- A stored preference of ["back-core"] selects the three spine chips rather than silently meaning "every area".',
    dependsOn: ['CR-017'],
    createdAt: '2026-09-12T09:00:00.000Z',
    startedAt: '2026-09-12T09:00:00.000Z',
    completedAt: '2026-09-12T12:00:00.000Z',
    notes:
      'Structures per area after the split: Cervical Spine 41, Thoracic Spine 39, Lumbar Spine 45. The sacroiliac joint keeps ' +
      'its hip override — it is a spine structure anatomically but is examined with the pelvis — and is now the only override ' +
      'that moves a structure out of its own region rather than narrowing it to a level. The generic vertebral landmarks were ' +
      'already modelled once each rather than per level (see structures.landmarks.spine.seed.ts), which is what made the ' +
      'all-three default the right answer rather than a compromise.',
  },
  {
    ref: 'CR-033',
    title: 'Launch readiness: the ranked pre-revenue checklist',
    category: 'infrastructure',
    priority: 'p0',
    effort: 'l',
    status: 'new',
    description:
      'Ranked, tickable tracker for everything between the app as it stands and first revenue — the September 2026 ' +
      're-read of the store/monetisation backlog, carried out after the imagery, ligament and PWA work closed the ' +
      'gaps the 8 September draft was written around. Image coverage is no longer the top competitive threat (50 ' +
      'images then, 814 now); the blockers are now an absent entitlement layer, live legal duties that are unmet, ' +
      'and an autumn pilot window that closes within weeks. Eighteen steps, ranked by importance, each with its own ' +
      'walkthrough.',
    prompt:
      'Work the LocusMSK launch-readiness checklist held on this change request.\n' +
      '\n' +
      'This CR is a tracker, not a single piece of work. Its checklist is the ranked list of everything\n' +
      'standing between the app as it is today and money arriving, spanning legal, content, product and\n' +
      'go-to-market. Each step carries its own walkthrough in the admin panel.\n' +
      '\n' +
      'HOW TO USE IT\n' +
      '- Work top-down. The ranking is by importance, not by convenience, and ranks 1-5 are either\n' +
      '  statutory duties that are already live or deadlines set by the academic calendar.\n' +
      '- Tick a step in /admin/changes only when it is genuinely finished. The tick stores the date, which\n' +
      '  is what makes "what actually got done in September" answerable in February.\n' +
      '- Step definitions live in git (changeRequests.seed.ts) and are overlaid onto the Firestore document\n' +
      '  on read, so walkthroughs can be improved without disturbing anybody\'s ticks. Never reuse or rename\n' +
      '  a step id — it is the only thing joining a stored tick to its step.\n' +
      '\n' +
      'SCOPE NOTES\n' +
      '- Ranks 10-13 are the monetisation build. They restate and extend CR-027 rather than replacing it:\n' +
      '  open CR-027 for the full implementation prompt, and treat the checklist items as the compliance\n' +
      '  constraints that prompt predates.\n' +
      '- Ranks 1, 4, 5, 6, 7, 9, 12 are legal and commercial groundwork. None of them need code beyond\n' +
      '  editing the constants at the top of the legal pages.\n' +
      '- This CR completes when every step is ticked, not when the code lands.',
    dependsOn: ['CR-025', 'CR-026', 'CR-027'],
    createdAt: '2026-09-13T18:00:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Supersedes nothing — CR-025/026/027 remain the implementation specs and this tracker points at them. New ' +
      'material not in the 8 September document: the DMCC subscription regime, VAT and merchant of record, the ' +
      'muscle dataset\'s database-right exposure, accessibility as an institutional procurement gate, and ' +
      'incorporation. Written 13 September 2026.',
    checklistDone: {},
    checklist: [
      {
        id: 'ico-registration',
        rank: 1,
        label: 'Register with the ICO and replace \'pending\' in the privacy policy',
        effort: '1 hour',
        why:
          'You process named students\' performance data today, in pilots. The duty is already live — it is not ' +
          'triggered by charging — and the published policy currently admits in writing that it is unmet. Cheapest item ' +
          'on this list and the one most likely to be checked.',
        walkthrough:
          '1. Run the ICO fee self-assessment (linked below) to confirm your tier.\n' +
          '2. Answer as a small business: turnover under £632,000 and fewer than 10 staff puts you in tier 1.\n' +
          '3. Pay £52, or £47 by direct debit. Register in the name already named in the policy.\n' +
          '4. The registration number usually arrives the same day by email.\n' +
          '5. Replace the \'ICO registration: pending\' line in src/features/legal/PrivacyPage.tsx with the number, and\n' +
          '   delete the TODO comment sitting above it.\n' +
          '6. Bump the `updated` date passed to LegalLayout on /privacy, then deploy.\n' +
          '7. If item 7 (incorporation) is imminent, do that FIRST and register the company instead — otherwise you\n' +
          '   pay the fee twice.',
        links: [
          { label: 'ICO fee self-assessment', url: 'https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee-self-assessment/' },
          { label: 'Register and pay the fee', url: 'https://ico.org.uk/for-organisations/data-protection-fee/register/' },
          { label: 'Guide to the fee and its tiers', url: 'https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/' },
        ],
      },
      {
        id: 'pilot-outreach',
        rank: 2,
        label: 'Email 3–5 sports therapy and sport rehab course leaders offering a free cohort year',
        effort: '2 weeks, ongoing',
        why:
          'The institutional licence is the business, its budget window is February, and a pilot must be running by ' +
          'autumn to have outcome data by then. Teaching has already started. This is the only item on the list with a ' +
          'deadline set by someone other than you.',
        walkthrough:
          '1. Build the list from the published accreditation registers — SST (34 universities) and BASRaT. Start with\n' +
          '   anyone you already know; warm beats cold at this stage every time.\n' +
          '2. Deploy the educator demo build first (npm run build:demo) so the email carries a link that works with no\n' +
          '   account and no explanation.\n' +
          '3. Email the MODULE LEADER who teaches MSK anatomy, not the head of school. They feel the pain and can\n' +
          '   usually authorise a small spend or credibly champion it upward.\n' +
          '4. The offer: a free year for one cohort. Ask for exactly two things — a join code on one lecture slide,\n' +
          '   and fifteen minutes in week six.\n' +
          '5. In the first reply, ask the qualifying question: does the department already subscribe to Anatomy.tv,\n' +
          '   Complete Anatomy or TeachMeAnatomy, and do students actually use it? The answer changes the whole pitch\n' +
          '   — see Part 2 of docs/BACKLOG-STORE-MONETISATION.md.\n' +
          '6. Lead with the cohort weakness dashboard, never the question count. Two competitors have more questions\n' +
          '   than you; neither tells a module leader who is struggling while there is still time to reteach it.',
        links: [
          { label: 'SST — all accredited programmes', url: 'https://thesst.org/our-accredited-programmes/' },
          { label: 'SST — accredited BSc courses', url: 'https://thesst.org/accredited-bsc-courses/' },
          { label: 'BASRaT — accredited education', url: 'https://www.basrat.org/education' },
        ],
      },
      {
        id: 'ligament-review',
        rank: 3,
        label: 'Clear the 32 ligament structures flagged needsReview',
        effort: 'Half a day',
        why:
          'npm run validate-content warns on 32 ligaments today, including ACL, medial meniscus and the whole ' +
          'ulnocarpal set. Pilot students will see them. Shipping anatomy your own build calls unverified is the one ' +
          'content failure a course leader cannot forgive, and it lands in the same weeks as the pilot outreach.',
        walkthrough:
          '1. Run npm run validate-content and copy the 32 warned ids out of the output.\n' +
          '2. Open docs/ligament-attachments-review.md and the published review page — the picture-per-row pack was\n' +
          '   built for exactly this job.\n' +
          '3. Check each attachment pair against a source you would cite in an essay: Gray\'s, Standring, or the\n' +
          '   module\'s set text. Not another app.\n' +
          '4. Remove needsReview from each verified entry in\n' +
          '   src/features/anatomy-revision/data/seed/structures.ligaments.seed.ts.\n' +
          '5. Where the RENDER is wrong rather than the text, leave the flag and add a note. An unresolved flag is a\n' +
          '   feature; a silently cleared one is not.\n' +
          '6. Re-run npm run validate-content until it reports zero warnings, then npm run test.',
      },
      {
        id: 'dataset-permission',
        rank: 4,
        label: 'Cut the muscle dataset free of the lecture decks, and ask Salford who holds the rights',
        effort: '1 hour to send, 1–2 days to re-derive',
        why:
          'Every PAID route runs through this; free pilots are far more defensible than charging. The dataset was ' +
          'consolidated from a lecturer\'s own teaching PowerPoints — assembling them into one deck of your own makes ' +
          'you the author of the container, not of the content, and slides handed to students are normally licensed for ' +
          'personal study rather than commercial reuse. Two things follow. The short factual fields are safe: origin ' +
          'and insertion average under five words in standard anatomical phrasing and no copyright attaches to them. ' +
          'The 158 WRITTEN SENTENCES are the real exposure — 122 actionText, 21 clinical, 15 notes — because those ' +
          'carry authorial choice and were taken as a set from one person\'s decks. Rights may also sit with the ' +
          'University rather than the lecturer, since teaching materials made in the course of employment are often ' +
          'institution-owned.',
        walkthrough:
          '1. Do the re-derivation FIRST, in parallel with the email. It is a day or two of work and it makes you\n' +
          '   independent of an answer you do not control — which is worth more than the permission.\n' +
          '2. Keep origin, insertion, nerve and action as they are, but verify each against a source you can cite\n' +
          '   (Gray\'s, Standring, or the module\'s set text) and record that source under\n' +
          '   src/features/anatomy-revision/data/source/. Facts are free; what you need is your own citable route to\n' +
          '   them rather than his slide number.\n' +
          '3. Rewrite the 158 prose strings in your own words — every actionText, clinical and notes field in\n' +
          '   muscles.raw.json. This is the part that actually carries copyright, and rewriting it is cheap compared\n' +
          '   with negotiating for it.\n' +
          '4. Do NOT delete the per-muscle `source` fields naming his deck and slide numbers. They are honest and they\n' +
          '   are your record of what came from where; replace them as each muscle is re-derived, so the file always\n' +
          '   says truthfully where its current content came from.\n' +
          '5. Email Vinnie Maynard in parallel. Short and straight: what the app is, that your revision deck was built\n' +
          '   from his lecture slides, that he is credited on a public attributions page, and that you are asking\n' +
          '   permission for commercial use. Offer the credit plus a free institutional licence for his cohort — it\n' +
          '   turns a legal ask into a pilot conversation, and he teaches exactly your target cohort.\n' +
          '6. Ask him explicitly WHO holds the rights. If the slides were made in the course of his employment the\n' +
          '   answer is probably the University, and you need Salford\'s IP or commercialisation office rather than\n' +
          '   him. Ask in the first email so you do not lose a month discovering it.\n' +
          '7. Your student status helps only with your own work: you very likely own the deck YOU assembled. It gives\n' +
          '   you no rights over his slide content, so do not lean on it.\n' +
          '8. File every reply. Free pilots can run while this is open; do not take money until it is closed, by\n' +
          '   permission or by re-derivation.',
        links: [
          { label: 'IPO — ownership of copyright works (employment rule)', url: 'https://www.gov.uk/guidance/ownership-of-copyright-works' },
          { label: 'IPO — copyright guidance', url: 'https://www.gov.uk/topic/intellectual-property/copyright' },
          { label: 'Copyright, Designs and Patents Act 1988', url: 'https://www.legislation.gov.uk/ukpga/1988/48/contents' },
          { label: 'Copyright and Rights in Databases Regulations 1997', url: 'https://www.legislation.gov.uk/uksi/1997/3032/contents/made' },
          { label: 'University of Salford — research and IP contacts', url: 'https://www.salford.ac.uk/research' },
        ],
      },
      {
        id: 'dpa-pack',
        rank: 5,
        label: 'Draft the DPA and DPIA pack universities will ask for',
        effort: 'Half a day',
        why:
          'This directly unblocks item 2. A university asked to let named students generate performance data visible to ' +
          'staff will want paperwork before anyone joins, and a three-week scramble at that moment is exactly how an ' +
          'autumn pilot becomes a January one.',
        walkthrough:
          '1. Start from the ICO\'s sample data processing agreement. Do not write one from scratch.\n' +
          '2. Fill in what the codebase already settles: sub-processors are Google Firebase (Google Ireland) and\n' +
          '   Netlify; retention is 24 months of inactivity; deletion is self-service and immediate.\n' +
          '3. Decide and state the controller/processor question. For a student who joins with a code you are a\n' +
          '   controller in your own right; for a licensed cohort the university will likely argue you are its\n' +
          '   processor. Say which you are claiming, and why.\n' +
          '4. Write a one-page DPIA on the educator-visibility feature — the highest-risk processing you do — and\n' +
          '   point it at firestore.rules as the control, because that is where the restriction is actually enforced.\n' +
          '5. Keep both as markdown under docs/ so they are version-controlled and can be sent as PDF within the hour.',
        links: [
          { label: 'ICO — contracts between controllers and processors', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/' },
          { label: 'ICO — data protection impact assessments', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/' },
        ],
      },
      {
        id: 'accessibility',
        rank: 6,
        label: 'Publish an accessibility statement and add a keyboard route through locate questions',
        effort: '2–3 days',
        why:
          'UK universities are bound by the public sector accessibility regulations and increasingly ask suppliers for ' +
          'a conformance report at procurement, so this gates the institutional sale rather than merely being the right ' +
          'thing to do. The whole codebase currently has one focus-visible rule and one aria-live region, and locate ' +
          'questions have no non-pointer path at all.',
        walkthrough:
          '1. Start with the audit, not the fix. Tab through one full session with the mouse unplugged and write down\n' +
          '   every place you get stuck.\n' +
          '2. Fix the two cheapest global things first: a visible :focus-visible outline in src/index.css, and an\n' +
          '   aria-live=\'polite\' region that announces right/wrong after each answer.\n' +
          '3. For locate questions, add a keyboard fallback — arrow keys cycle a highlighted candidate region, Enter\n' +
          '   commits. The hotspot polygons already exist, so this is a selection UI over them, not new anatomy.\n' +
          '4. Write the statement at /accessibility in the same voice as /privacy: what conforms, what does not, what\n' +
          '   you are doing about it and by when. Universities accept honest gaps. They do not accept silence.\n' +
          '5. Put it in src/features/legal/ beside the others so it renders without sign-in, and link it from the\n' +
          '   footer.',
        links: [
          { label: 'WCAG 2.2 quick reference', url: 'https://www.w3.org/WAI/WCAG22/quickref/' },
          { label: 'Partially-compliant accessibility statement template (DfE)', url: 'https://accessibility.education.gov.uk/audits-issues-statements/accessibility-statements/partially-compliant' },
          { label: 'Jisc — accessibility regulations for UK education', url: 'https://www.jisc.ac.uk/guides/accessibility-regulations-what-you-need-to-know' },
        ],
      },
      {
        id: 'limited-company',
        rank: 7,
        label: 'Incorporate, and move the published address off your home',
        effort: 'Half a day',
        why:
          'A residential address is currently on a public privacy policy and will end up on every store listing and ' +
          'invoice. A limited company is also the cleaner counterparty for a university purchase order, and puts a ' +
          'layer between you personally and a product that gives clinical-adjacent information to students.',
        walkthrough:
          '1. Incorporate at Companies House — £100 online (the fee doubled in February 2026), certificate usually\n' +
          '   back within 24 hours. Keep the trading name if you like it.\n' +
          '2. Use a registered office / service address. Most formation agents include one for £30–50 a year, and it\n' +
          '   is the entire point of the exercise.\n' +
          '3. Open a business bank account. Payment providers will ask for one and will not accept a personal account\n' +
          '   for a company.\n' +
          '4. Update the CONTROLLER and ADDRESS constants at the top of PrivacyPage.tsx and TermsPage.tsx — they are\n' +
          '   single constants precisely so this is a two-line change.\n' +
          '5. Sequence this with item 1 so the ICO fee is paid once, by whichever entity ends up being the controller.',
        links: [
          { label: 'Register a company with Companies House', url: 'https://www.gov.uk/limited-company-formation/register-your-company' },
          { label: 'Setting up a limited company — overview', url: 'https://www.gov.uk/limited-company-formation' },
          { label: 'ICO registration (do this once, as the right entity)', url: 'https://ico.org.uk/for-organisations/data-protection-fee/register/' },
        ],
      },
      {
        id: 'retire-ai-images',
        rank: 8,
        label: 'Replace or remove the 14 AI-generated atlas slides',
        effort: '1–2 days',
        why:
          'CR-026\'s acceptance criterion was zero images licensed \'All rights reserved\'; 14 remain. For an app teaching ' +
          'attachments to people who will treat patients, AI anatomy is the content most likely to be confidently wrong ' +
          '— and Apple\'s AI content rules bite the moment you submit.',
        walkthrough:
          '1. grep -n \'AI_GENERATED_CREDIT\' src/features/anatomy-revision/data/seed/images.seed.ts to list the 14.\n' +
          '2. For each, check whether the Z-Anatomy pipeline now covers the same structures. With 814 images, most\n' +
          '   will already have a real equivalent shipped.\n' +
          '3. Where one exists, delete the AI entry. lib/linkImages.ts re-links imageIds automatically — never\n' +
          '   hand-edit them.\n' +
          '4. Where none exists, render it. The Blender pipeline under src/scripts/blender/ is working and documented.\n' +
          '5. Where neither is practical, remove the image rather than shipping it. A structure with no image degrades\n' +
          '   gracefully; one with a wrong image teaches something false.\n' +
          '6. Run npm run validate-content and confirm no \'All rights reserved\' entries remain.',
        links: [
          { label: 'Z-Anatomy source models', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
          { label: 'Apple App Review Guidelines', url: 'https://developer.apple.com/app-store/review/guidelines/' },
        ],
      },
      {
        id: 'vat-decision',
        rank: 9,
        label: 'Decide VAT handling before choosing a payment provider',
        effort: '2 hours',
        why:
          'It constrains the provider choice, so deciding after checkout is built means building it twice. UK ' +
          'registration has a threshold you will not hit soon, but selling digital services to EU consumers means EU ' +
          'VAT from the first sale, with no threshold at all.',
        walkthrough:
          '1. Decide whether you will sell outside the UK at launch. If not, this is simple — but write the decision\n' +
          '   down rather than leaving it implied.\n' +
          '2. If yes, choose between a merchant of record (Paddle, Lemon Squeezy), which becomes the seller and owns\n' +
          '   VAT registration and remittance, and Stripe plus Stripe Tax, where you remain the seller and register\n' +
          '   for non-union OSS yourself.\n' +
          '3. For a one-person business at this revenue the merchant of record is almost certainly right: the extra\n' +
          '   percentage buys away a compliance obligation you would otherwise carry personally.\n' +
          '4. Note that iOS in-app purchases are Apple\'s problem either way — Apple is merchant of record there.\n' +
          '5. Record the decision in docs/BACKLOG-STORE-MONETISATION.md before CR-027 starts, because it decides what\n' +
          '   CR-027 integrates against.',
        links: [
          { label: 'GOV.UK — VAT rules for digital services to consumers', url: 'https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers' },
          { label: 'EU VAT One Stop Shop (non-union scheme)', url: 'https://europa.eu/youreurope/business/taxation/vat/one-stop-shop/index_en.htm' },
          { label: 'Paddle — merchant of record', url: 'https://www.paddle.com/' },
          { label: 'Lemon Squeezy — merchant of record', url: 'https://www.lemonsqueezy.com/' },
          { label: 'Stripe Tax', url: 'https://stripe.com/tax' },
        ],
      },
      {
        id: 'entitlement-layer',
        rank: 10,
        label: 'Build the entitlement layer and the permanently free area (CR-027 item 1)',
        effort: '1–2 weeks',
        why:
          'You cannot take money today: there is no entitlement anywhere in src/, only the CR-027 spec. This is the ' +
          'literal barrier to revenue and everything else about charging routes through it. The free area ships with it ' +
          'because every competitor has a free tier and you cannot be the exception.',
        walkthrough:
          '1. Open CR-027 in this register and copy its prompt. It is already written and specifies the shape.\n' +
          '2. Build the entitlement document first: { tier, source, expiresAt, seatId } on users/{uid}, one\n' +
          '   useEntitlement() hook, and a matching firestore.rules helper.\n' +
          '3. Gate on the entitlement, never on the payment provider. That is what lets you change pricing and add\n' +
          '   providers later without touching feature code.\n' +
          '4. Make the free tier one complete body area with every question type available inside it, and make which\n' +
          '   area it is configurable rather than hardcoded.\n' +
          '5. Enforce that entitlement writes are server-side only in firestore.rules. A client that can write its own\n' +
          '   tier is not a paywall.\n' +
          '6. Add the Vitest coverage the spec asks for: expiry, seat exhaustion, and precedence when a user holds\n' +
          '   both an individual and an institutional entitlement.',
        links: [
          { label: 'Firestore security rules', url: 'https://firebase.google.com/docs/firestore/security/get-started' },
          { label: 'RevenueCat documentation', url: 'https://www.revenuecat.com/docs/' },
        ],
      },
      {
        id: 'dmcc-compliant-paywall',
        rank: 11,
        label: 'Build the subscription flow DMCC-compliant from day one',
        effort: '3–5 days on top of the paywall',
        why:
          'The new UK subscription contracts regime lands around the window you are targeting for launch. Retrofitting ' +
          'reminder notices and a cancellation route into a live billing system costs far more than building them in, ' +
          'and these obligations carry enforcement rather than merely embarrassment.',
        walkthrough:
          '1. Pre-contract information on the paywall itself: price, billing frequency, that it auto-renews, and how\n' +
          '   to cancel — before the payment step, not in the confirmation email.\n' +
          '2. A reminder before any free trial converts to a charge. The 7-day trial in CR-027 now carries a notice\n' +
          '   obligation.\n' +
          '3. Renewal reminders: on an annual plan, every six months; on a monthly plan, before the sixth payment and\n' +
          '   every sixth payment after that.\n' +
          '4. Cancellation must be straightforward and online — one clear route from the account screen, no\n' +
          '   email-us-to-cancel, working up until shortly before the renewal date.\n' +
          '5. Honour the renewal cooling-off right: 14 days after a trial converts or an annual plan auto-renews, with\n' +
          '   a proportionate refund.\n' +
          '6. Build the notices as scheduled Cloud Functions driven off the entitlement document, not ad-hoc emails.\n' +
          '   They have to fire reliably and be auditable afterwards.',
        links: [
          { label: 'DMCC Act 2024', url: 'https://www.legislation.gov.uk/ukpga/2024/13/contents' },
          { label: 'Implementation timing (Hogan Lovells)', url: 'https://www.hoganlovells.com/en/publications/uk-subscription-law-shakeup-new-rules-pushed-to-autumn-2026' },
          { label: 'The obligations in outline (Cooley)', url: 'https://www.cooley.com/news/insight/2024/2024-12-09-uk-crackdown-on-subscription-traps-government-reveals-new-proposals-for-incoming-subscription-contracts-regime-under-dmcc-act' },
        ],
      },
      {
        id: 'cooling-off-waiver',
        rank: 12,
        label: 'Add the digital content cooling-off waiver to checkout',
        effort: '2 hours',
        why:
          'Access starts the instant someone pays. Without express consent to immediate supply and an acknowledgement ' +
          'that the 14-day cancellation right is lost, you owe a refund to anyone who asks within a fortnight, whatever ' +
          'your terms say.',
        walkthrough:
          '1. Add a checkbox at checkout, unticked by default, saying access starts immediately and that the customer\n' +
          '   accepts they lose the 14-day right to cancel once it does.\n' +
          '2. Store the consent alongside the subscription: the timestamp AND the exact wording shown. The wording is\n' +
          '   the evidence, so a later copy change must not rewrite history.\n' +
          '3. Mirror it in TermsPage.tsx, in the same plain register as the rest of that file.\n' +
          '4. Remember the carve-out: this waiver covers the initial period only. The renewal cooling-off right in\n' +
          '   item 11 still applies afterwards.',
        links: [
          { label: 'Consumer Contracts Regulations 2013', url: 'https://www.legislation.gov.uk/uksi/2013/3134/contents/made' },
          { label: 'Digital content waiver under the DMCCA (Mills & Reeve)', url: 'https://www.mills-reeve.com/publications/proposed-changes-to-the-digital-content-waiver-for-subscription-contracts-under-the-dmcca/' },
        ],
      },
      {
        id: 'small-business-program',
        rank: 13,
        label: 'Register for Apple\'s Small Business Program',
        effort: '30 minutes',
        why:
          '15% instead of 30% on every iOS subscription below $1M annual revenue. It is a form. Missing it hands Apple ' +
          'an extra 15% of iOS revenue for nothing.',
        walkthrough:
          '1. Enrol once the Apple Developer account exists. It is an application in App Store Connect, not something\n' +
          '   that happens automatically.\n' +
          '2. Apply BEFORE the quarter you want the rate in: the reduced commission takes effect 15 days after the\n' +
          '   end of the fiscal month in which you are approved, not immediately.\n' +
          '3. Do it even if the store launch is months away. There is no downside to being enrolled early.',
        links: [
          { label: 'App Store Small Business Program', url: 'https://developer.apple.com/app-store/small-business-program/' },
        ],
      },
      {
        id: 'outcome-instrumentation',
        rank: 14,
        label: 'Instrument the outcome comparison the February pitch depends on',
        effort: '1 day now, then the term',
        why:
          'The most valuable sentence you can own is \'students who completed N sessions scored X% higher than those who ' +
          'did not\'. It takes a full teaching term to earn, no competitor offers it to UK MSK course leaders, and it ' +
          'cannot be backfilled in February. Set it up alongside the pilots or lose the year.',
        walkthrough:
          '1. Decide the measure NOW, before data exists: sessions completed and structures mastered per student,\n' +
          '   across the term.\n' +
          '2. Check what src/features/educator/data/cohortRollups.ts already records and add only what is genuinely\n' +
          '   missing — most of this is built.\n' +
          '3. Ask each pilot lead at the START whether they will share anonymised module marks at the end. Asking in\n' +
          '   February is asking for a favour; asking in September is agreeing terms.\n' +
          '4. Keep it honest — engaged students revise more, so this is an association, not causation. Say so. You\n' +
          '   will still be the only person in the room with a number.\n' +
          '5. Diarise the analysis for early February, before the budget conversations rather than after.',
      },
      {
        id: 'social-series',
        rank: 15,
        label: 'Start the locate-question series on Instagram and TikTok',
        effort: 'Ongoing, ~2 hours a week',
        why:
          '300 followers pulling 750–2000 views is a 2.5–6x ratio: the content already works and the follower count is ' +
          'simply early. Posting the product itself costs nothing — there are 814 renders sitting in the repo. Ranked ' +
          'below the institutional items because 300 followers will not produce meaningful subscription revenue; its ' +
          'real job is putting the app in front of a course leader.',
        walkthrough:
          '1. One format, one name, one slot: a render, \'can you tap the X?\', a pause, then the reveal. Three to five\n' +
          '   a week during term.\n' +
          '2. Export straight from the app\'s own locate questions. The rotation and zoom already built is native to\n' +
          '   vertical video.\n' +
          '3. Post the same asset to both platforms. TikTok\'s distribution is far less follower-gated than\n' +
          '   Instagram\'s, which is why 70 followers there is not the constraint it looks like.\n' +
          '4. Do not sell for the first eight weeks. Build the \'this account teaches me anatomy\' habit first, then one\n' +
          '   link in bio straight to the free area.\n' +
          '5. Never put a sign-up wall before the first correct answer. The aha is a locate question answered right on\n' +
          '   a real render, inside 90 seconds of arriving.\n' +
          '6. Follow and tag what matters for item 2: SST and BASRaT student networks, university society accounts,\n' +
          '   course leaders. One post a course leader sees beats a hundred student views.',
      },
      {
        id: 'cohort-ambassadors',
        rank: 16,
        label: 'Recruit one student ambassador per pilot cohort',
        effort: '1 hour per cohort',
        why:
          'The real distribution channel inside a cohort is the year group chat, not Instagram. Class join codes are ' +
          'already viral by design — one student sharing a code recruits the group, and that outperforms any post you ' +
          'will make.',
        walkthrough:
          '1. Ask the pilot lead to name one engaged student in the year. They will know immediately.\n' +
          '2. Give them a free year, plainly labelled as such, and one job: put the join code in the year group chat\n' +
          '   and answer questions about it.\n' +
          '3. Give them something worth sharing — a results card, a streak — rather than a link to a marketing page.\n' +
          '4. Extend it to placement. Students on placement meet students from other universities, which is how you\n' +
          '   reach an institution you never emailed.\n' +
          '5. Once individual subscriptions exist, add referral credit on both sides, as Kenhub does. A physio cohort\n' +
          '   is a dense enough network for it to compound.',
      },
      {
        id: 'comparison-page',
        rank: 17,
        label: 'Build a comparison page for competitor long-tail search',
        effort: '1 day',
        why:
          'Head-on SEO against TeachMeAnatomy and Kenhub is a year spent losing to a decade of domain authority. ' +
          'Comparison pages targeting their brand names are the exception — winnable, and they reach people who are ' +
          'already shopping.',
        walkthrough:
          '1. Reuse the Part 0 positioning table from docs/BACKLOG-STORE-MONETISATION.md verbatim. It is written and\n' +
          '   sourced; fresh marketing copy would be worse.\n' +
          '2. Put it on the educator page of the commercial site, where the audience that cares about cohort\n' +
          '   analytics already is.\n' +
          '3. Be scrupulously accurate about competitors, including where they beat you. A table pretending you have\n' +
          '   more 3D models than Complete Anatomy destroys your credibility with the one reader who matters.\n' +
          '4. Re-check every price before publishing, and quarterly after. Part 0 records how much drifted between two\n' +
          '   drafts written a month apart.',
        links: [
          { label: 'Kenhub pricing', url: 'https://www.kenhub.com/en/pricing' },
          { label: 'TeachMeAnatomy pricing', url: 'https://teachmeanatomy.info/sign-up/' },
          { label: 'Complete Anatomy pricing', url: 'https://store.3d4medical.com/' },
        ],
      },
      {
        id: 'claims-evidence-file',
        rank: 18,
        label: 'Open an evidence file for every public marketing claim',
        effort: '2 hours, then ongoing',
        why:
          'Under the CAP code you must hold substantiation for objective claims BEFORE publishing them. The moment you ' +
          'say \'students who used it scored X% higher\' you need the analysis on file, and the same applies to every ' +
          'structure count and competitor figure you put on a page.',
        walkthrough:
          '1. Create docs/CLAIMS.md. One row per public claim: the claim, where it appears, the evidence, the date\n' +
          '   last verified.\n' +
          '2. Seed it with what you already state publicly: 345 structures, 814 images, and the competitor prices on\n' +
          '   the comparison page.\n' +
          '3. Wire the countable ones to npm run validate-content output so they cannot go stale silently — that\n' +
          '   script already prints the real numbers.\n' +
          '4. Re-verify competitor claims quarterly, before each selling window.\n' +
          '5. Rule of thumb: if you could not show a sceptical reader where a number came from inside five minutes,\n' +
          '   do not publish it.',
        links: [
          { label: 'ASA — substantiation', url: 'https://www.asa.org.uk/advice-online/substantiation.html' },
          { label: 'The CAP Code (non-broadcast)', url: 'https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html' },
        ],
      },
    ],
  },
  {
    ref: 'CR-034',
    title: 'Carry the glenoid labrum over from the old branch',
    category: 'content',
    priority: 'p2',
    effort: 's',
    status: 'new',
    description:
      'The only structure the four stale branches held that main does not. content/port-bone-context-images carried ' +
      'eight in-context renders in August; seven of the eight (intervertebral disc, L4 vertebra, menisci, calcaneus, ' +
      'cuboid, navicular, talus) are on main today with images and working locate questions. The glenoid labrum was ' +
      'never carried over, and no structure of that name exists in the seed.',
    prompt:
      'Add the glenoid labrum to the seed.\n\n' +
      'WHAT IS ALREADY DONE\n' +
      '- The atlas objects exist and are resolved: ta2-mapping-landmarks.resolved.json maps glenoid-labrum to\n' +
      '  ["Glenoid labrum.l", "Glenoid labrum.r"], resolution "manual", confidence 1.0. ligament-collections.json\n' +
      '  carries the same two objects (and the acetabular labrum beside them).\n' +
      '- Nothing downstream was built: glenoid-labrum appears in no spec, no render, no seed.\n\n' +
      'WHICH PIPELINE IS THE REAL DECISION\n' +
      'It is fibrocartilage, not bone, so the landmark pipeline is the wrong shape for it — a landmark marks a point\n' +
      'or region ON a bone, and the labrum is a ring sitting proud of the glenoid rim. The ligament pipeline already\n' +
      'draws exactly this kind of thing: a soft-tissue strap in blue over bone, eight angles, a traced hotspot per\n' +
      'angle, neighbours named. Prefer it, and take the acetabular labrum in the same pass since the atlas offers it\n' +
      'and the hip tranche is already framed at 300mm.\n\n' +
      'AGAINST THAT, note what main already has: glenoid-cavity is seeded as a landmark with panels and a target\n' +
      'core. The labrum and the cavity are the same place seen two ways, so whichever pipeline draws the labrum,\n' +
      'check the two hotspots do not overlap on any shared plate — generateSet.test.ts enforces mutual exclusivity\n' +
      'and will fail the build rather than ship an ambiguous tap.\n\n' +
      'ACCEPTANCE\n' +
      '- The glenoid labrum is askable, and a student can tell it from the glenoid cavity in the picture.\n' +
      '- validateContent passes with no new warnings.',
    dependsOn: [],
    createdAt: '2026-09-17T23:30:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'P2 because it is one structure, and the shoulder already has 40. Raised while tidying the four branches that ' +
      'were never merged: three of them turned out to be the old Python + msk-quiz.html project, sharing no ancestor ' +
      'with main, and the fourth held this. All four are tagged under legacy/ and dropped locally, so this change ' +
      'request is now the only record that the labrum was ever wanted.',
  },
  {
    ref: 'CR-035',
    title: 'Finish fill-the-blank, or retire it',
    category: 'content',
    priority: 'p1',
    effort: 'm',
    status: 'new',
    description:
      'fill-blank is a generated question type that no picker offers, and the reason turns out to be that it is not ' +
      'finished. It produces 294 questions of which 285 never name the structure they are about, because the generator ' +
      'blanks a word out of an attachment record rather than writing a question around it. Its session screen is ' +
      'unfinished to match.',
    prompt:
      'Decide whether fill-the-blank ships, then make it true either way.\n' +
      '\n' +
      'WHAT IS WRONG WITH THE QUESTIONS\n' +
      'Run the generator and read them. Three real examples, with the blank shown as ______:\n' +
      '  Scapula          "______ origin - supraglenoid tubercle"\n' +
      '  Medial Malleolus "______ origin"\n' +
      '  Talus            "Ankle joint with the ______"\n' +
      'None of these is answerable. The stem is a row from the attachment data with a word removed, so the thing being ' +
      'asked about is exactly the thing that was removed. 285 of 294 never mention their own structure; the 9 that do ' +
      'are accidents of phrasing.\n' +
      '\n' +
      'WHAT IS WRONG WITH THE SCREEN\n' +
      'FillBlankSession renders top-left with no header, no centred column, no confidence buttons - none of the shell ' +
      'every other session has. It has never been reachable, so nobody has ever looked at it.\n' +
      '\n' +
      'THE FIX, IF IT SHIPS\n' +
      'A stem has to name its subject: "Biceps brachii originates from the ______ of the scapula" rather than ' +
      '"______ origin". That means writing sentences round the attachment data rather than punching holes in it, which ' +
      'is closer to how the OINA cards were built - look there first, because if fill-the-blank ends up asking the same ' +
      'four facts in the same words, it is a second skin on OINA rather than a format of its own, and the honest answer ' +
      'is to delete it.\n' +
      '\n' +
      'THE FIX, IF IT DOES NOT\n' +
      'Delete fillBlank.ts, blankParser.ts, FillBlankSession and the fill-blank branch of generateSet, and drop the ' +
      'member from QuestionType. Leaving a type that cannot be chosen is how this went unnoticed for months.\n' +
      '\n' +
      'ACCEPTANCE\n' +
      '- Either every fill-blank question names the structure it asks about and the session looks like the others, or ' +
      'the type is gone from the codebase.\n' +
      '- QUESTION_FORMATS in lib/questionFormats.ts offers every remaining QuestionType, and its test says so.',
    dependsOn: [],
    createdAt: '2026-09-18T10:40:00.000Z',
    startedAt: null,
    completedAt: null,
    notes:
      'Found while adding a missing format to the pickers. The count looked healthy - 294 questions over 134 ' +
      'structures - and it was only on running one that the stems turned out to be unanswerable. P1 rather than P2 ' +
      'because the decision is cheap and the code is load-bearing in generateSet either way.',
  },
];
