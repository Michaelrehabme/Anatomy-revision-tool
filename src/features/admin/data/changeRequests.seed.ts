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
    dependsOn: ['CR-017'],
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
];
