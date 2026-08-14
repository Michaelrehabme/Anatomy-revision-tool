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

On first run you'll get a large, immediately-usable content library for flashcards and MCQs:
all 122 muscles (from `muscles.json`) plus ~180 bones/landmarks/joints, illustrated by 24 real
atlas-slide images. **Locate-the-structure questions still show zero results** — see "Image and
hotspot status" below for why.

## Image and hotspot status

`src/features/anatomy-revision/data/source/muscles.raw.json` and `ta2-mapping.raw.json` are
verbatim copies of `Downloads/muscles.json`/`ta2-mapping.json` — `structures.muscles.seed.ts` is
a small transform over them (see that file), not hand-typed data, so re-copy those two files
here and the seed content updates automatically.

24 real atlas-slide images live under `/public/anatomy/atlas/` — 10 muscle atlas slides plus 14
bone/landmark atlas slides, each an `AnatomyImageAsset` with `mode: 'atlas-slide'` in
`images.seed.ts`. Every structure's `imageIds` is populated **automatically** by
`lib/linkImages.ts`, which matches each image's `panelStructureNames` against structure
name/id/aliases — you never hand-maintain `imageIds` (see "Adding a new structure" below).

What's still missing, and what that means:

1. **Hotspot polygon data.** None of the 24 images have `hotspots` populated yet, so every
   image works for flashcard/MCQ prompts but **zero** locate-the-structure questions exist. See
   "Adding hotspots" below for the two authoring paths.
2. **Individual single-structure images** (e.g. one isolated render per muscle, cropped/labelled
   on its own) — the current image library is all multi-panel atlas slides. Nothing stops adding
   single-structure images later; they'd link the same way via `linkImages.ts`.

## Licensing — read before adding images

The 24 atlas-slide images currently in the app are AI-generated illustrations the project owner
created — credited as `'Rory Neary (AI-generated illustration)'` / `'All rights reserved'` (see
the `AI_GENERATED_CREDIT`/`AI_GENERATED_LICENCE` constants in `images.seed.ts`).

Images rendered from the [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) 3D
atlas (via the Blender pipeline described below) are **CC BY-SA 4.0** — attribution required,
derivatives must stay share-alike, commercial use is fine. Any *other* image source (slide decks,
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

**Muscles**, via the Blender pipeline already scaffolded in `Downloads/` (not yet run):

```bash
# In Downloads/, per its own README.md:
blender Z-Anatomy.blend --background --python dump_objects.py -- --out objects.json
python3 reconcile.py --objects objects.json --mapping ta2-mapping.json
blender Z-Anatomy.blend --background --python render_muscles.py -- \
    --mapping ta2-mapping.resolved.json --out ./renders --region shoulder-arm
python3 masks_to_svg.py --masks ./renders/masks --out hotspots.json
```

Then feed the output into this project:

```bash
npx tsx src/scripts/importHotspots.ts path/to/hotspots.json
```

This validates the file, cross-references muscle ids and image ids against the current seed
data, and prints ready-to-paste TS snippets (plus a mismatch report) for anything that matches
— it does not rewrite `images.seed.ts` automatically, since seed content is deliberately typed
TS (not raw JSON) so the compiler catches shape errors immediately.

**Bones and landmarks** have no equivalent Blender pipeline. Two options:

1. A small in-repo dev-only route (not yet built — a natural next addition) at e.g.
   `/dev/hotspot-authoring`, gated behind `import.meta.env.DEV`, that loads an image, lets you
   click to place polygon vertices, previews live via the existing `HotspotOverlay` component,
   and gives you a "copy JSON" button for the resulting `HotspotPolygon`.
2. For simple/small landmark shapes, eyeball pixel coordinates in any image viewer and divide
   by the image's width/height to get normalized 0–1 points by hand.

Either way, hotspot coordinates are normalized **0–1** against the image's own natural
width/height (not screen pixels) — see `HotspotPolygon` in `types/image.ts` and
`lib/hotspot/pointInPolygon.ts`'s point-in-polygon test, which is the same algorithm documented
in `Downloads/README.md`. When polygons overlap (e.g. deltoid over supraspinatus), the
smallest-area structure wins a click — this is deliberate, matching how a student tapping
precisely usually means the smaller structure underneath.

## Persistence

Two `AnatomyRepository` implementations exist (`src/features/anatomy-revision/data/`):

- **`local`** (default) — everything in `localStorage`, no backend required. Good for
  development and for running the app standalone.
- **`firestore`** — real Firebase project. Set `VITE_PERSISTENCE=firestore` and fill in the
  `VITE_FIREBASE_*` values in `.env` (see `.env.example`). Uses Firebase **Anonymous Auth**
  (silent sign-in, no login UI) so Firestore security rules can trust `request.auth.uid`
  instead of a client-supplied id. Suggested rules:

  ```
  match /users/{userId}/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```

Either way, anatomy **content** (structures/images) always comes from the static seed modules,
never from Firestore — only user-generated data (attempts, mastery, session summaries) is
actually persisted per-backend. This keeps content changes a normal PR, with no admin UI or
read costs.

## Project structure

```
public/anatomy/atlas/                  # 24 real atlas-slide images (10 muscle + 14 bone/landmark)

src/
  App.tsx                              # setup -> in-progress -> results state machine, no router
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
    context/                           # RepositoryProvider, AnonymousUserProvider
  scripts/
    validateContent.ts                 # npm run validate-content
    importHotspots.ts                  # npx tsx src/scripts/importHotspots.ts <hotspots.json>
```

## Testing

`npm run test` runs Vitest against `lib/` — the pure-function layer (indexes, distractors,
question generation, mastery scheduling, hotspot hit-testing) with no React/Firebase
dependency, so it's the fastest and most valuable place to add coverage as content grows.
