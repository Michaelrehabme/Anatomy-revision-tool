# Status: paid content behind the server

Companion to `DESIGN-CONTENT-BEHIND-SERVER.md`. Written 4 Oct 2026 on the
`content-server` branch (from 3abd1d9, 487 structures). Steps 2, 3 and 4 of the
design's seven are done. Steps 1, 5, 6 and 7 are not started. **The seed is
still bundled and the paywall is still enforced only in the browser** — nothing
here protects anything yet. What is done is the part that could be done
without changing what a student sees.

## What is done

### Step 2 — a structure type with no facts

- `types/structureIndex.ts`: `StructureIndexEntry`, and the two lists that say
  which side of the split every field is on, `STRUCTURE_INDEX_FIELDS` and
  `STRUCTURE_FACT_FIELDS`. They are the only place that decides it. Three
  type-level checks at the foot of the file stop a new field on
  `AnatomyStructure` compiling until it is in exactly one list.
- `data/structureIndex.ts`: `STRUCTURE_INDEX`, the one import for code that
  needs no facts. Today it is the seed seen through the narrower type.
- Narrowed to the index type: `admin/lib/analyticsAggregation.ts`,
  `educator/lib/rollupAggregation.ts`, `CreateAssignmentForm`, `demoData`, the
  achievement tallies in `useRevisionSession`, `buildDiagnostic`,
  `filterStructures`, `linkImages`, `promptImagesFor`, `buildLocateQuestions`,
  `bodyRank`, `areasOf`/`primaryAreaOf`, and `pwa/offline/areaImages.ts`.
- **Not narrowed, because they read facts:** see "Mastery" below.

### Step 3 — the cut, at build time

- `npm run generate:content` (`src/scripts/buildContent.ts`) runs at the start
  of `build` and `build:demo`, after `generate:offline`. It reads the seed and
  writes, all git-ignored:
  - `src/features/anatomy-revision/data/content/generated/structureIndex.json`
    and `vocabulary.json` — for the bundle;
  - `.content/areas/<area>.json` — `{ area, structures, version }`, the facts;
  - `.content/version.json` — the version and a per-area hash, size and count.
- `vite.config.ts` reads the version file and defines `__CONTENT_VERSION__`
  (`'dev'` when the file is absent). `data/content/version.ts` exports it as
  `CONTENT_VERSION`. Nothing imports it yet, so it is not in the bundle.
- `data/content/split.ts`: `toIndexEntry`, `toFacts`, `joinFacts`,
  `buildAreaFacts`, `joinLoadedAreas`. Pure and Node-free: the build cuts with
  it and the app will join with it.
- The seed files stay the source of truth. `validate-content`,
  `generate:provenance`, `generate:offline` and the authoring tools read
  nothing written here.

Sizes (487 structures):

| File | Raw | Gzipped |
| --- | --- | --- |
| `structureIndex.json` | 172.6 kB | 13.6 kB |
| `vocabulary.json` | 12.5 kB | 2.7 kB |
| shoulder | 40.9 kB | 9.2 kB |
| elbow | 17.2 kB | 4.7 kB |
| wrist-hand | 64.1 kB | 12.0 kB |
| hip | 33.9 kB | 7.6 kB |
| knee | 30.0 kB | 6.7 kB |
| ankle-foot | 60.1 kB | 11.4 kB |
| cervical-spine | 34.2 kB | 7.6 kB |
| thoracic-spine | 32.1 kB | 7.7 kB |
| lumbar-spine | 30.1 kB | 6.6 kB |
| all nine areas | 342.7 kB | 73.5 kB |

### Step 4 — distractors that survive one area

- `lib/questionGenerators/sources.ts`: `DistractorSources { index, vocabulary }`,
  an optional fourth argument to `generateRevisionSet` and `buildStarterSet`.
  The first argument is now "the structures whose facts are loaded". No caller
  passes sources yet, so every session is built exactly as before.
- Names come from the index: ligament attachment boxes (`identifyTyped.ts`)
  and select-all attachment questions (`multiSelect.ts`).
- The vocabulary fills in where a pool reached across the whole dataset: the
  nerve MCQ, the OINA nerve and action top-up, and every blood-supply wrong
  answer. It is consulted **only** when the index holds structures that are not
  loaded (`vocabularyWhenPartial`).
- `lib/questionGenerators/questionBase.ts`: the question header, shared. Seven
  copies became one, which is what kept the entry chunk from growing.
- `lib/__tests__/singleAreaGeneration.test.ts` builds each of the nine areas
  from its payload alone and checks counts, leaks and truth (below).

### Proof that nothing changed

85 fixed configurations (every area × three seeds, every type, practice,
assessment, adaptive, mastery-weighted, priority, the starter set, the
diagnostic, assignment previews), 22,989 questions, dumped before the work and
after each step: **byte-identical**, same hash every time. There are no
differences to justify.

With one area loaded, against the same area with everything loaded: the same
6,200 questions are built in all nine areas — every count equal, not merely
within 10%. 5,189 have the same choices. 1,011 have different wrong answers,
all of the kinds expected: OINA facts (origin, insertion, nerve, action, both
blood-supply kinds), the nerve MCQ, and nine select-all questions whose
sampling order moved.

Entry chunk: 1,921,275 B before, 1,920,958 B after (limit 2,097,152 B).

## What the design got wrong, or predates

1. **Fields it did not list.** Index: `audioUrl`. Facts: `bloodSupply`,
   `needsReview`, `palpability`, `dermatomeRelation`, `referredPainPattern`,
   `functionalContext`. `needsReview` is a fact because it only qualifies
   `attachmentStructureIds`.
2. **`imageIds` cannot be written into the index after linking.** Linked, the
   index was 1.08 MB of turntable frame ids. It is cut from
   `AUTHORED_STRUCTURES` (new export of `data/seed/index.ts`) and the app must
   run `linkImages` over it at load, as it does over the seed today.
3. **"70–80% of seed bytes are facts, ~300 kB freed."** Measured as JSON: facts
   are about 280 kB of 452 kB, 62%. The index is 173 kB. Expect the entry chunk
   to fall by rather less than 280 kB, and the muscles' two raw JSON imports
   (`data/source/*.raw.json`) leave with the seed.
4. **The vocabulary list.** The clinical generators (myotome, special test,
   palpation, injury, functional) and the joint-type MCQ take their wrong
   answers from the session's own pool, never from the dataset, so one area
   loaded changes nothing for them. The vocabulary carries `jointTypes`,
   `myotomes` and `specialTests` as the design asks, but **nothing reads
   them**. Origins, insertions and action sentences are not in it at all and
   are not needed: the counts hold without them.
5. **Arteries were not in the design** (blood supply landed after it), and they
   are the one place the vocabulary is essential: wrong arteries come from
   OUTSIDE the structure's areas by rule. A flat or region-keyed list would
   have broken the rule that keeps the question true — a neighbour's artery
   must never be offered as wrong — for a structure in two areas with one
   loaded. So `vocabulary.arteries` is keyed by area, then region. See the
   decisions below.
6. **"The per-area image download (`pwa/anatomyCache.ts`)".** That file is the
   runtime image cache. The per-area download is `features/pwa/offline/`.
7. **"A lint rule bans importing `data/seed` from app code."** Too broad:
   `images.seed.ts`, every `*.generated.ts` plate file and the hotspot chunks
   live in `data/seed` and stay bundled. The rule must ban the structure seeds
   and `bloodSupply.generated.ts` (in practice: `data/seed` index and
   `structures.*.seed`), or the images move to their own directory first.
8. **`educator/lib/assignmentScope.ts` "must count from the index".** Half
   right: `poolSize` can, `available` is a count of generated questions and
   needs facts for every area. See the decisions.
9. **The content version** is a hash of the facts only, not of the index. A
   deploy that changes a picture or an alias must not send every device back
   for nine areas.

## Next steps

### Step 1 — free area to Firestore (blocked on the rules work)

`firestore.rules`, `rules-tests/`, `firebase.json` and `vitest.rules.config.ts`
have uncommitted changes in the main checkout (the wildcard-hole fix). Step 1
must be built on top of that once it is committed, not beside it.

- `lib/preferences.ts` `getFreeAreaChoice` / `setFreeAreaChoice`
  (`FREE_AREA_KEY`): becomes the local-mode fallback and the migration source.
- `hooks/useEntitlement.ts`: reads and writes the choice; `chooseFreeArea`.
- `lib/entitlement.ts`: `freeAreasFor`, `canSwitchFreeArea`,
  `FREE_AREA_SWITCH_DAYS` (30), `FREE_AREA_SWITCHES_ALLOWED` (1). Already pure;
  the function will import them.
- `data/entitlementRepository.ts` (and its `.demo.ts` alias): add
  read/write of `users/{uid}.freeArea = { area, chosenAt, switches }`.
- Rules: create once; one update, only when `switches` goes 0 → 1 and
  `request.time` is 30 days past the stored `chosenAt`; `chosenAt` must equal
  `request.time`. Rules tests for each refusal.
- Migrate the stored value on first sign-in. `data/accountLifecycle.ts` and
  `scripts/accountData.ts` export and delete the user doc and need the field.

### Step 5 — the content function

- New `netlify/functions/content-area.ts`. Move `adminApp()` and the
  `accounts:lookup` token check out of `paddle-portal.ts` into
  `netlify/functions/lib/`.
- Import `.content/areas/*.json` and `.content/version.json` statically so
  esbuild bundles them. `tsconfig.functions.json` needs `resolveJsonModule` and
  `src/features/anatomy-revision/lib/entitlement.ts` in `include`.
- Entitlement: `resolveEntitlement` / `canAccessArea` from `lib/entitlement.ts`;
  the cohort lookup mirrors `entitlementRepository.ts` (`users/{uid}.cohort` →
  `cohorts/{id}.licensedUntil`); the free area comes from step 1.
- Respond `{ version, area, leaseUntil, structures }`, `Cache-Control: private,
  no-store`. Allow/deny matrix tests: no token, bad token, unknown area, free
  user on and off their area, active, expired, not yet started, cohort member
  licensed and lapsed.
- `scripts/deployCheck.mjs` should fail when `.content/version.json` is
  missing, since a CLI deploy bundles functions from the working tree.
- The service worker must not cache the response: check `runtimeCaching` and
  `navigateFallbackDenylist` in `vite.config.ts` cover `/.netlify/functions/`.

### Step 6 — the repository split

- `data/structureIndex.ts` becomes
  `linkImages(structureIndex.json, IMAGE_ASSETS)`. Its importers do not change.
- New `loadAreaFacts(areas)` and `data/contentCache.ts` (IndexedDB, keyed
  `uid:area:version`, with the lease). `joinLoadedAreas` in `split.ts` already
  turns payloads into structures.
- `hooks/useAnatomyContent.ts` must return three things, not one: the index
  (every structure), `structures` (loaded only) and `sources`. Then every
  generator call passes `content.sources`: `App.tsx` (5), `RevisionSetup` (2),
  `MobileRevisionSetup` (2), `Today`, `MobileToday`, `Progress` (2),
  `ClassAssignments`, `DiagnosticScreen`, and both `buildStarterSet` calls.
- `listStructures` / `getStructure` in `localRepository.ts`,
  `memoryRepository.ts` and `firestoreRepository.ts` read `ALL_STRUCTURES`.
- Screens that list structures have to choose: the Atlas and Progress
  (`useAtlasList`, `useProgressData`) currently walk `content.structures` and
  would silently shrink to the loaded areas.
- Side-by-side check: the test "nine areas joined from their payloads build
  what the seed builds" is the model — the flag can run the same comparison in
  the browser.

### Step 7 — remove the seed

- Still importing structure seeds in app code: the three repositories,
  `useRevisionSession.ts` and `educator/lib/studentRollup.ts`
  (`STRUCTURES_BY_ID`, for mastery levels), `educator/lib/assignmentScope.ts`,
  `educator/demo/cohortAnalytics.demo.ts`, `hotspotEditor/HotspotEditorApp.tsx`
  and `dev/HotspotAuthoring.tsx` (names only — move to `STRUCTURE_INDEX`).
- The build check must scan **every** chunk in `dist/assets`, not the entry
  alone: the admin, educator and legal chunks are public too. Use descriptions
  as the canary, not origins — "Ischial tuberosity" is an origin and a
  landmark's name.
- The diagnostic change, the lint rule (see 7 above), the demo fixture.

## Newer features the design predates

**Offline downloads (`features/pwa/offline/`).** `areaImages.ts` now needs
only the index, so manifests can still be generated and matched after step 7.
The gate is `access.canAccess(area)` in `OfflineSection.tsx` and
`useOfflineAutoUpdate.ts`. The comment on `offlineSource.ts` promises signed
manifests; the design does not protect images at all, so the server check that
matters is the facts fetch. In step 6 `downloadArea.ts` /
`offlineController.ts` should call `loadAreaFacts([area])` as part of a
download and treat a 403 as "the source said no", which they already handle.
A content-version change must mark a downloaded area stale the way a manifest
hash change does (`areaStatus.ts`, `autoUpdate.ts`). The 14-day lease is the
open question: a downloaded area whose lease lapses offline has pictures and no
facts.

**Blood supply.** `bloodSupply` is a fact field and is in the area payloads;
`bloodSupply.generated.ts` leaves the bundle with the seed. `/sources`
(`legal/data/provenance.generated.ts`) holds counts and works only, no
per-structure fact, and is unaffected. The "how rich" MCQ has no distractors to
source. Artery wrong answers are covered above.

**The eight buried ligaments.** They are ordinary structures in the seed and
are in the index and the payloads with the rest; the tests run over all 487.
Their second renders, the variant switch and the gap plate are image-side and
stay public. `needsReview` travels with the facts. Do not run
`generateLigamentSeed.ts` (it would delete 111 ligaments).

**Mastery levels and fact mastery.** `structureLevel` calls
`requiredFactKinds(structure)`, which reads facts: whether a structure is a
muscle, has a primary artery, has assisting arteries. It is called for
structures that may not be loaded — `studentRollup.ts` (every structure the
student has touched, sent to their educator), `useRevisionSession.ts`,
`useProgressData.ts`, `atlasList.ts`, both muscle cards. A lapsed subscriber's
levels would be computed without the fact kinds and come out wrong. The fix is
a derived index field, `factKinds`, written by `toIndexEntry` like
`hasDescription`. Not done: it is a decision (below).

**The public demo (`build:demo`).** It runs `generate:content` now, and
`.content/` does not reach `dist-demo/`. After step 7 it has no function to
call (local persistence, no auth), so it needs a bundled fixture of two areas
behind an alias in `educatorDemoAliases`, as the design says.
`cohortAnalytics.demo.ts` uses `requiredFactKinds` over the whole seed and
needs `factKinds` too.

## Decisions for the owner

1. **Artery lists keyed by area.** Bundled, so readable by anyone: which
   arteries are listed at the knee, at the hip, and so on — not which structure
   each supplies. The alternative is a flat list, and then a structure in two
   areas can be offered a true artery as a wrong answer. Recommended: keep.
2. **`factKinds` in the index.** Reveals which structures have blood-supply
   facts and which of those have assisting arteries. Needed for correct mastery
   levels outside the loaded areas.
3. **`jointId` and `parentBoneId` in the index** (the design's choice, kept).
   They are relations, so arguably facts; the pictures already show them.
4. **`notes` and `source` in the payloads.** 38 kB and 14 kB of roughly 280 kB.
   Nothing in the app renders either. Leaving them out makes the payloads a
   fifth smaller and stops authoring notes being served to students.
5. **The unread vocabulary lists** (`jointTypes`, `myotomes`, `specialTests`):
   drop them, or use them to top up thin clinical pools — which would add
   questions to today's sessions and is a behaviour change.
6. **Generated index: git-ignored or committed?** Ignored today, like the
   offline manifests. Once step 6 imports it, a fresh checkout cannot run
   `npm run dev` or `npm test` until `generate:content` has run. Either add it
   to `predev`/`pretest`, or commit the two bundle-side files and let
   `validate-content` fail when they are stale, as it does for provenance.
7. **The diagnostic** asks across all nine areas ungated. Picture-to-name
   only, or a small fixed bundled sample (the design leaves it open).
8. **Assignment preview** (`previewAssignment`) counts questions over every
   area for an educator who may hold one. Serve educators every area, or ship
   a per-structure question-count table in the index.
9. **Signed-out and local-mode users.** The function needs an ID token. Decide
   what `VITE_PERSISTENCE=local` builds and signed-out visitors load.
10. **Offline lease.** `min(expiresAt, now + 14 days)` means two weeks offline
    ends a paid download. Longer for downloaded areas, or accept it.
11. **Which two areas the public demo carries**, since they become public.

## Found on the way, not fixed

Adaptive mode builds each MCQ from a pool of one structure
(`generateOneQuestionForStructure`), so its name distractors have nothing to
draw from: an adaptive MCQ comes out with a single choice, the right answer.
Six of twenty questions in the mastery-seeded adaptive sets above. It predates
this work and fixing it changes behaviour, so it is left and reported.
