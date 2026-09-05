# Anatomy Revision

A standalone musculoskeletal anatomy revision tool — flashcards, multiple choice, and image
"locate the structure" questions — covering muscles, bones, and bony landmarks. Built to
eventually plug into a larger clinical notes / rehabilitation app, but usable on its own.

## Getting started

This project was hand-written (not run through `npm create vite`) because Node.js/npm/git
weren't available in the environment it was built in. You'll need:

- [Node.js](https://nodejs.org/) 20 or later (includes npm)
- Optionally [git](https://git-scm.com/), if you want to put this under version control

Then:

```bash
npm install
cp .env.example .env      # defaults to local persistence, no Firebase project needed
npm run dev                # starts the app at http://localhost:5173
npm run test                # runs the lib/ unit tests (Vitest)
npm run validate-content    # checks seed data for broken cross-references
npm run build                # type-checks + production build
```

On first run you'll get a large, immediately-usable content library: all 122 muscles (from
`muscles.json`) plus ~180 bones/landmarks/joints, illustrated by 14 bone/landmark atlas slides,
21 single-muscle panels and 15 Z-Anatomy regional renders. Locate-the-structure questions
cover 74 muscles across all five regions — see "Image and hotspot status" below.

## Image and hotspot status

`src/features/anatomy-revision/data/source/muscles.raw.json` and `ta2-mapping.raw.json` are
verbatim copies of `Downloads/muscles.json`/`ta2-mapping.json` — `structures.muscles.seed.ts` is
a small transform over them (see that file), not hand-typed data, so re-copy those two files
here and the seed content updates automatically.

14 bone/landmark atlas slides live under `/public/anatomy/atlas/`, each an `AnatomyImageAsset`
with `mode: 'atlas-slide'` in `images.seed.ts`. Every structure's `imageIds` is populated
**automatically** by `lib/linkImages.ts`, which matches each image's `panelStructureNames`
against structure name/id/aliases — you never hand-maintain `imageIds` (see "Adding a new
structure" below). The 10 AI-generated *muscle* slides that used to sit alongside them were
retired in favour of the Z-Anatomy renders.

15 regional renders live under `/public/anatomy/regions/` — anterior, lateral and posterior for
each of the 5 regions, from the Z-Anatomy 3D model. These carry **every hotspot in the app**:
107 polygons over 74 muscles, traced from the Blender per-muscle masks by
`src/scripts/masksToHotspots.ts`. All three views are frames of one turntable, so they share a
camera and the masks align to all of them.

The renders include the **skeleton**, and the masks are **bone-occluded**. That is not
decoration. Rendered muscle-only, the views have holes where bones belong: from the front the
calf showed through the gap between tibia and fibula, and the intercostals read as floating
slats with no ribs between them. Worse, the occlusion model had no concept of bone at all, so a
student could tap a visibly bony area and be graded as having hit the muscle behind it.
`src/scripts/blender/renderRegionsWithBones.py` renders the skeleton as a holdout so anything
hidden behind bone drops out of its own mask.

What's still missing, and what that means:

1. **48 of the 122 muscles have no locate question.** They are occluded in every view a solo
   silhouette can offer — you cannot tap what you cannot see. Unlocking them needs a *layered*
   render pass that also hides superficial *muscles*, not just bone. Run `masksToHotspots.ts`
   and read its closing "occluded in every view" list to see exactly which muscles that would
   buy.
2. **Hotspots for bones and landmarks.** The Blender masks only cover muscles, so the 163
   bone/landmark structures have no polygons and generate no locate questions. Author these by
   hand with the dev tool — see "Adding hotspots" below.
3. **Hotspots on the panel images.** The 21 muscle panels are `mode: 'single-structure'`, so
   they answer "which structure is shown?" but cannot be tapped. Each is a strip of three
   views, so hotspots would need per-view polygons.

## Licensing — read before adding images

The 14 atlas slides under `/public/anatomy/atlas/` are AI-generated illustrations the project
owner created — credited as `'Rory Neary (AI-generated illustration)'` / `'All rights reserved'`
(see the `AI_GENERATED_CREDIT`/`AI_GENERATED_LICENCE` constants in `images.seed.ts`). They are
now the *only* AI-generated images left: the 21 muscle panels were re-rendered from Z-Anatomy
and carry its licence instead, so check which constant an entry uses before copying one.

The 15 regional renders under `/public/anatomy/regions/` and the 21 muscle panels under
`/public/anatomy/panels/` come from the
[Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) 3D atlas and are
**CC BY-SA 4.0** — attribution required, derivatives must stay share-alike, commercial use is
fine. Share-alike covers the **traced hotspot polygons too**, not just the images: they are
derived from the same renders, so `hotspots.regions.generated.ts` carries the same obligation. Any *other* image source (slide decks,
textbook scans, someone else's photography) has whatever licence *that* source actually carries —
**do not assume CC BY-SA, and do not assume the AI-generated credit above, for anything that
didn't come from one of those two places.** For anything with unconfirmed terms, leave
`credit`/`licence` as an explicit `'TODO — confirm source licence'` string rather than guessing —
`AttributionBadge.tsx` renders whichever string is actually stored, so an unresolved TODO stays
visibly unresolved in the UI rather than silently defaulting to something reassuring.

## Adding a new structure (muscle, bone, or landmark)

1. Open the relevant seed file under `src/features/anatomy-revision/data/seed/`:
   - **Muscles** — don't hand-edit `structures.muscles.seed.ts` at all; it's a transform over
     `data/source/muscles.raw.json`/`ta2-mapping.raw.json`. To add/update muscles, re-copy an
     updated `Downloads/muscles.json`/`ta2-mapping.json` over those two raw files and the seed
     content regenerates automatically on next build.
   - **Bones** — `structures.bones.seed.ts`. Author `attachments`/`articulations` as prose,
     matching the style of the existing entries.
   - **Landmarks** — split by body region: `structures.landmarks.seed.ts` (original core 5),
     `structures.landmarks.spine.seed.ts`, `structures.landmarks.upper-limb.seed.ts`,
     `structures.landmarks.lower-limb.seed.ts`. Pick whichever file matches the new landmark's
     region, or start a new file and merge it in `data/seed/index.ts` if you're covering new
     territory (e.g. a skull/cranial file). Joints (e.g. a facet joint, the SI joint) are also
     `category: 'landmark'` — use `articulations` to describe what they connect, see
     `structures.landmarks.spine.seed.ts`'s file comment for why there's no separate `'joint'`
     category.
2. Append a new object literal to the relevant array. TypeScript will flag any missing
   required field immediately (the `AnatomyStructure` union is discriminated on `category` —
   see `types/structure.ts`). Leave `imageIds: []` — don't hand-maintain it.
3. **Get it linked to images**: make sure the structure's `name` (or an entry in `aliases`)
   matches, case-insensitively and ignoring parenthetical suffixes, some `panelStructureNames`
   entry on an existing/new image — `lib/linkImages.ts` populates `imageIds` automatically at
   build time from that match. If a panel uses a region-prefixed phrasing that won't
   auto-normalize to your structure's name (e.g. "Thoracic Intervertebral Disc" instead of
   "Intervertebral Disc (Thoracic)"), add the exact panel phrase to `aliases` — see the multiple
   examples in `structures.landmarks.spine.seed.ts`.
4. Run `npm run validate-content` to catch broken cross-references (`parentBoneId`, hotspot
   `structureId`s).

Content rules to keep in mind (see `types/structure.ts` and the seed files' own comments):
- Grouped hand/foot structures (lumbricals, interossei, phalanges, metacarpals, metatarsals,
  tarsals, and by the same logic carpals) stay grouped — one `AnatomyStructure` entry, not one
  per digit/bone. Individually-named sub-bones (scaphoid, talus, etc.) become `landmark` entries
  with `parentBoneId` pointing at the grouped bone, rather than separate bones.
- Multi-headed muscles (e.g. biceps brachii) stay as **one** structure, not split by head.

## Adding images

1. Export at a consistent width (e.g. 1600px), name descriptively (e.g.
   `muscle-slide-11-<region>.png` for another atlas slide, or `<slug>-<view>.png` for a
   single-structure image).
2. Place single-structure images under `/public/anatomy/<region>/`; multi-panel atlas slides
   under `/public/anatomy/atlas/` (see the 24 existing files there for the naming pattern).
3. Add a new entry to `images.seed.ts` with the real `filePath`, `width`/`height` (needed for
   correct hotspot coordinate normalization — see `HotspotImage.tsx`'s comment), real
   `credit`/`licence`, and — for atlas slides — `panelStructureNames` transcribed **verbatim**
   from the image's panel labels. Don't set `imageIds` on structures by hand; matching names/
   aliases against `panelStructureNames` links them automatically (see "Adding a new structure"
   above and `lib/linkImages.ts`).

## Adding hotspots (for locate-the-structure questions)

**Muscles**, from the Blender render masks. These live in the untracked `deploy/` and `renders/`
directories (see `.gitignore`) — they are ~2GB of build output, not source:

```bash
# Trace polygons from the per-muscle turntable masks, depth-subtracted (see below).
npx tsx src/scripts/masksToHotspots.ts --masks renders/regions-bones --out hotspots.regions.json

# Validate against the current seed data and regenerate the typed module.
npx tsx src/scripts/importHotspots.ts hotspots.regions.json --emit-ts \
  --out src/features/anatomy-revision/data/seed/hotspots.regions.generated.ts
```

Use `--out` on the second command rather than redirecting stdout: the script imports the seed
data, and `>` would truncate the very module it is regenerating before it could read it.

The converter prints a per-structure table (solid px / visible px / % / vertices / kept or
dropped), then a list of muscles that have a mask in the region but no place in that view's
occlusion order, with the area each would add. Scan both: a muscle you know is visible showing
a low percentage, or a large unlisted one, means the layering in
`src/scripts/data/occlusionOrder.ts` needs a look. Those unlisted entries are *candidates*, not
defects — a solo silhouette projects even when the muscle faces away from the camera.

To check a whole view at a glance, draw the generated polygons back onto the render:

```bash
npx tsx src/scripts/renderHotspotOverlay.ts \
  --renders <dir of region PNGs> --hotspots hotspots.regions.json --out overlays
```

A wrong occlusion order fails *silently* — a polygon over the wrong muscle still grades
consistently against itself, so no test catches it. Looking at the picture is the only check.

**Regenerating the renders themselves** needs Blender (vendored in `tools/`) and the Z-Anatomy
scene in `atlas/`:

```bash
./tools/blender-*/blender.exe --background atlas/Z-Anatomy/Startup.blend \
  --python src/scripts/blender/renderRegionsWithBones.py -- \
  --mapping ta2-mapping.resolved.json --out renders/regions-bones --views 0,6,12

./tools/blender-*/blender.exe --background --factory-startup \
  --python src/scripts/blender/platesToWebp.py -- \
  --plates renders/regions-bones --out public/anatomy/regions
```

~16 minutes for 381 renders. `ta2-mapping.resolved.json` maps all 122 muscle ids to their
Z-Anatomy object names; it and the original `render_regions.py` are in git history (commits
`c56f780` and `a8fb5c1`) rather than the working tree. **The camera framing in
`renderRegionsWithBones.py` is copied verbatim from that original**, including deriving the
region bounding box from the region's muscles only — that is what keeps new renders aligned
with the stored polygons (verified at IoU 1.000000). Changing it silently invalidates every
hotspot in the app.

**Why the depth subtraction matters.** Each mask is a *solo* silhouette, rendered with only that
muscle visible, so a deep muscle's mask covers ground that a superficial muscle hides in the
actual image — rhomboid minor's silhouette lies entirely inside trapezius'. Since overlapping
polygons resolve smallest-area-wins (below), importing the raw silhouettes would attribute a
correct trapezius tap to a muscle the student cannot see: measured, trapezius graded correct
only 56% of the time. `occlusionOrder.ts` lists each render's muscles superficial-to-deep, the
converter subtracts everything already claimed, and the resulting polygons are mutually
exclusive. **Never import `--no-occlusion` output as content** — that flag exists only to
compare the tracer against the polygons embedded in the prototype viewer.

**Bones and landmarks** have no masks, so author them by hand:

```bash
npm run dev     # then open /dev/hotspots
```

The dev-only route (gated behind `import.meta.env.DEV`, so it cannot reach a production build)
lets you pick any image, click to place vertices, close rings, drag vertices to adjust, and copy
the result as `importHotspots.ts` v2 JSON. It loads any existing hotspots into the editor first,
so it doubles as the correction surface for whatever the converter produced. For simple shapes
you can also eyeball pixel coordinates in an image viewer and divide by the image's dimensions.

Hotspot coordinates are normalized **0–1** against the image's own natural width/height (not
screen pixels) — see `HotspotPolygon` in `types/image.ts` and `lib/hotspot/pointInPolygon.ts`.
An image carrying hotspots **must** have `width`/`height` set in `images.seed.ts`: `HotspotImage`
derives its wrapper's aspect-ratio from them, and without it the rendered box stops matching the
image 1:1 and every click normalizes to the wrong point. `npm run validate-content` warns about
this. When polygons overlap, the smallest-area structure wins a click — deliberate, matching how
a student tapping precisely usually means the smaller structure underneath.

## Persistence

Two `AnatomyRepository` implementations exist (`src/features/anatomy-revision/data/`):

- **`local`** (default) — everything in `localStorage`, no backend required. Good for
  development and for running the app standalone.
- **`firestore`** — real Firebase project. Set `VITE_PERSISTENCE=firestore` and fill in the
  `VITE_FIREBASE_*` values in `.env` (see `.env.example`), then enable the **Anonymous**,
  **Google**, and **Email/Password** sign-in providers in the Firebase console (Authentication →
  Sign-in method). New visitors are silently signed in via Firebase **Anonymous Auth** (no
  login wall) so Firestore security rules can trust `request.auth.uid`; signing up from the
  in-app account screen links that anonymous session to the chosen provider via
  `linkWithPopup`/`linkWithCredential`, so the uid — and every `users/{uid}/**` doc — carries
  over untouched. If the credential already belongs to an account from another device
  (`auth/credential-already-in-use`), the user is signed into that existing account instead and
  told this device's progress couldn't be merged. See `firestore.rules` at the repo root for the
  matching security rules (owner-only access to `users/{uid}` and everything under it).

Either way, anatomy **content** (structures/images) always comes from the static seed modules,
never from Firestore — only user-generated data (attempts, mastery, session summaries) is
actually persisted per-backend. This keeps content changes a normal PR, with no admin UI or
read costs.

## Deploying

**One repository, one deploy path.** This project has been checked out more than
once on the same machine, and on 2026-09-04 a deploy ran from the checkout that was
missing two days of committed work — the live site silently lost a whole question
type. Nothing in the deploy path had an opinion about which commit the build came
from, so nothing caught it.

Two things guard against a repeat:

- `netlify.toml` lives in the repo, so the build command and publish directory come
  from version control rather than from the linked site's own settings (which
  published the project root, meaning every correct deploy needed a hand-passed
  `--dir=dist`).
- `npm run deploy` refuses to publish a tree that is dirty, on an untracked branch,
  or ahead of / behind its remote — see `scripts/deployCheck.mjs`. It checks
  identity, not correctness: whether what you are about to publish is a commit
  other people can see.

```bash
npm run deploy          # check, build, publish
npm run deploy:check    # just the check
```

**Better: let Netlify build from git.** Connecting the site to the GitHub repo
removes the local working tree from the deploy path entirely — deploys become a
function of a commit, the wrong-checkout failure stops being possible, and
`scripts/deployCheck.mjs` becomes redundant. That is a change made in the Netlify
UI (Site configuration → Build & deploy → link repository); `netlify.toml` already
carries the build settings it needs.

## Admin section

`/admin/*` (Change Register, Users, Analytics) is a separate, code-split part of the
app — students never download it, and it only works against a real Firebase project
(`VITE_PERSISTENCE=firestore`). See `src/features/admin/`.

**Teaching is self-service; admin is granted.** Anyone signed in can create a class from
`/educator`, and creating it makes them its owner — ownership is what grants access to that
class's students, so there is no educator role, no approval step and no script. The privacy line
that makes this safe is the student's: an educator sees a student only after that student enters
the join code, and leaving removes them again.

Admin is different, because it reaches every user's data, the Change Register and platform
analytics. It comes from a `roles/{uid}` document written at `/admin/people`, a legacy `admin`
custom claim, or the bootstrap owner address. Claims were the original mechanism and still work,
but they can only be minted with service-account credentials, which made every grant a terminal
command run by whoever held the key.

**Join codes are document ids.** A code lives at `joinCodes/{CODE}` holding the cohort it points
at, which buys two things a `where joinCode ==` query could not. Uniqueness is settled by the
database — Firestore refuses to create a document that already exists, so two people generating
the same code at the same moment cannot both win. And a student resolves a code with a single
`get()` by id, so nobody needs list access to the `cohorts` collection; granting that would have
made every join code on the platform enumerable. Codes are immutable (`allow update: if false`) —
a code that could be repointed would silently redirect a class mid-term.

The client-side `<RequireAdmin>` / `<RequireEducator>` guards are **not** the security boundary —
`firestore.rules` is, and it re-runs every check server-side. `<RequireEducator>` only asks
whether you are signed in; what you can actually see comes from which cohorts you own.

### Granting admin access

1. Sign in at `/admin/people` as an admin.
2. Find the person — they must have signed in at least once, since a role attaches to a uid.
3. Tick **Admin** and Save. It takes effect on their next page load, with no sign-out.

**The first admin** is the bootstrap: `nearyomichael@gmail.com` is admin by definition, in
`isBootstrapAdmin()` in `firestore.rules` and in `src/features/roles/bootstrap.ts`. Without it no
admin could exist, because granting admin requires already being one. It requires a verified
email. **Change it in both places or not at all** — changing only the app locks the owner out of
`/admin`; changing only the rules leaves a former owner with access the app cannot revoke.

### Granting admin access with the script (break-glass)

Still supported, and the only route if the rules ever deny you the People screen:

### Change Register

The backlog is version-controlled at `src/features/admin/data/changeRequests.seed.ts` — Firestore
is a mirror of it, not the source of truth. After editing that file (adding a new `CR-00N` entry,
say), sync it to Firestore with:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run admin:seed-changes
```

This only **creates** documents whose `ref` doesn't already exist in Firestore — it never
overwrites one, so it's safe to re-run after an admin has changed a status/note in the live app.
Status/notes edits made in `/admin/changes` itself are NOT written back to the seed file; if a
completed change request's history is worth preserving in git, update the seed file by hand.

## Project structure

```
public/anatomy/atlas/                  # 14 bone/landmark atlas slides (webp)
public/anatomy/panels/                 # 21 muscle-on-skeleton panels, 3 views each (webp)
public/anatomy/regions/                # 15 Z-Anatomy renders, skeleton included — the only images with hotspots

src/
  App.tsx                              # react-router route table; session phase (setup -> in-progress ->
                                        # results) still drives its own full-screen takeover on top of routing
  features/anatomy-revision/
    types/                             # AnatomyStructure, AnatomyImageAsset, RevisionQuestion, ...
    data/
      source/                          # muscles.raw.json / ta2-mapping.raw.json — verbatim copies
                                        # of Downloads/*.json, transformed (not hand-typed) into
                                        # structures.muscles.seed.ts
      seed/                            # typed TS seed content — see "Adding a new structure" above
                                        # (landmarks are split into spine/upper-limb/lower-limb files)
      repository.ts                    # AnatomyRepository interface + local/firestore factory
    lib/
      questionGenerators/              # flashcards.ts, mcq.ts, locate.ts, generateSet.ts
      distractors.ts                   # tiered anatomically-relevant distractor picker
      linkImages.ts                    # auto-links structures <-> images by name/alias match
      hotspot/                         # point-in-polygon hit-testing
      mastery.ts                       # SM-2-lite spaced repetition
    components/                        # RevisionSetup, FlashcardSession, MCQSession,
                                        # LocateStructureSession, RevisionResults, shared/
    hooks/                             # useRevisionSession, useAnatomyContent, useRepository
    context/                           # RepositoryProvider, AuthProvider (useAuth)
  features/admin/                      # /admin/* — code-split (React.lazy), see "Admin section" above
    AdminApp.tsx                       # lazy-loaded entry point; nests RequireAdmin + its own <Routes>
    components/
      RequireAdmin.tsx                 # UI-only route guard — real enforcement is firestore.rules
      shell/                           # AdminShell, AdminSidebar
      ChangeRegister/                  # table, filters, detail panel, new-request form
      Users/                           # UsersPage, UserDetailPage
      Analytics/                       # structure weakness, distractor analysis, question health, cohort overview
    data/
      changeRequests.seed.ts           # version-controlled backlog — see "Change Register" above
      changeRequestsRepository.ts      # Firestore CRUD for changeRequests
      usersRepository.ts               # admin-only reads of the users collection
    lib/statusTransition.ts            # pure status/timestamp rule — see the Testing section
  features/dev/                        # /dev/* — dev-only, absent from production builds
    DevRoutes.tsx                      # lazy-loaded behind import.meta.env.DEV in App.tsx
    HotspotAuthoring.tsx               # /dev/hotspots — trace and correct polygons by hand
  scripts/
    validateContent.ts                 # npm run validate-content
    importHotspots.ts                  # validates hotspots.json, --emit-ts regenerates the seed module
    masksToHotspots.ts                 # Blender masks -> depth-subtracted polygons
    renderHotspotOverlay.ts            # draws polygons back onto a render, to check by eye
    data/occlusionOrder.ts             # superficial->deep layering per render (hand-authored)
    lib/png.ts                         # dependency-free PNG decoder
    lib/pngEncode.ts                   # and the writer half, for the overlays
    lib/maskToPolygons.ts              # binarise, subtract, component-label, trace, simplify
    blender/renderRegionsWithBones.py  # re-renders regions with the skeleton, bone-occluded masks
    blender/platesToWebp.py            # rendered plates -> the .webp the app loads

scripts/                                # Node-only, run via tsx — NOT part of the Vite app bundle
  setAdmin.ts                          # npm run admin:set-claim -- <uid> — see "Admin section" above
  seedChangeRequests.ts                # npm run admin:seed-changes
  firebaseAdmin.ts                     # shared firebase-admin bootstrap for the two scripts above
```

## Testing

`npm run test` runs Vitest against `lib/` — the pure-function layer (indexes, distractors,
question generation, mastery scheduling, hotspot hit-testing) with no React/Firebase
dependency, so it's the fastest and most valuable place to add coverage as content grows.
`src/features/admin/lib/statusTransition.ts` (the Change Register's inline status-editing rule)
follows the same pattern and is covered the same way.
