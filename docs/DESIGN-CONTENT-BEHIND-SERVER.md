# Design: paid content behind the server

Walkthrough card 5. Drafted 29 Sep 2026; not started. The paywall today is
enforced only in the browser, and every structure's facts ship in the entry
chunk, so anyone with devtools has the whole sourced dataset.

## What is protected

**Facts, fetched per area:** `description`, `origin`, `insertion`, `nerve`,
`actions`, `actionText`, `attachments`, `articulations`,
`attachmentStructureIds`, `jointType`, `movements`, `stabilizers`,
`articulatingStructureIds`, `clinical`, `notes`, `source`, and the clinical
layer (myotome, palpation, injuries, special tests).

**Index, bundled:** `id`, `name`, `latin`, `aliases`, `phoneticSpelling`,
`category`, `region`, `subregion`, `areas`, `groups`, `imageIds`,
`eligibility`, `difficulty`, `tags`, `parentBoneId`, `jointId`,
`abbreviation`, `partOf`, plus a `hasDescription` flag. Roughly 70–80% of seed
bytes are facts, so this also frees an estimated 300 KB of entry chunk.

## How facts are served

One Netlify Function, `netlify/functions/content-area.ts`:
`GET ?area=knee&v=<contentVersion>` with the Firebase ID token.

1. Verify the token as `paddle-portal.ts` does (identitytoolkit
   `accounts:lookup`; `firebase-admin/auth` fails bundled). Move `adminApp` and
   the token check into `netlify/functions/lib/`.
2. Read `users/{uid}` and, for a cohort member, `cohorts/{id}`.
3. Decide with the same `resolveEntitlement` / `canAccessArea` the client uses.
4. 403, or `{version, area, leaseUntil, structures}` with
   `leaseUntil = min(expiresAt, now + 14 days)`.

Payloads come from a generated, git-ignored `.content/areas/*.json` imported
by the function, so they version with the deploy and never reach `dist/`.
Clients fetch an area only when the content version changes: about nine calls
per paid user per content release, well inside Spark's 50k reads a day and
Netlify's free function allowance. First fetch is 300–800 ms cold, 10–20 KB
gzipped per area.

Rejected: Firestore `content/{area}` docs guarded by rules (the entitlement
logic would be duplicated in the rules language, with 1–3 extra `get()`s per
read and a separate upload that can drift); signed URLs (Netlify has none).

## Prerequisite: the free area moves to Firestore

The free area is chosen and stored on the device (`lib/preferences.ts`
`getFreeAreaChoice`), so a server cannot honour "one free area" it cannot see.
Move it to `users/{uid}.freeArea` with rules allowing one creation and one
change after 30 days, and migrate the stored value on first sign-in.

## Offline

Cache each fetched area in IndexedDB (`data/contentCache.ts`), keyed
`uid:area:version` with its lease. Purge on sign-out, when an area is no
longer allowed, or when a lease expires and cannot be renewed. The per-area
image download (`pwa/anatomyCache.ts`) also prefetches that area's facts.

## Distractors

Names alone serve name MCQs, identify-typed, locate and ligament attachment
multi-select. These need other structures' facts: origin/insertion MCQs,
nerve and action MCQs, OINA, joint type, clinical questions, and nerve/action
multi-select. Build the indexes over the index plus whatever facts are
loaded (tiered pools already prefer the same region), and bundle an unkeyed
vocabulary (nerve names, action tags, joint types, myotome labels,
special-test names) as the fallback. Add a test that every generator still
produces its usual count, ±10%, from a single area. The diagnostic asks across
all nine areas ungated: limit it to picture-to-name questions, or bundle a
small fixed sample. (Neither, in the end. The owner's answer of 6 Oct 2026 is
ten papers — the whole body for a student holding every area, one area for a
student on a free account — each a list of what to ask, built at the sitting
from the facts the sitter holds, so nothing is bundled. And a guest is no
longer served a free area: it needs a real account. Both are in
CONTENT-SERVER-STATUS.md, decisions 7 and 9.)

## Build

`src/scripts/buildContent.ts` from `prebuild` writes the bundled index JSON,
`.content/areas/<area>.json` and a content version hash (injected as
`CONTENT_VERSION`). The seed `.ts` files stay the source of truth for scripts,
`validate-content` and `/sources`. A lint rule bans importing `data/seed` from
app code, and the build fails if a known origin string appears in the entry
chunk.

## Order of work

Each step leaves the app working.

1. Free area to Firestore, with rules and rules tests (M).
2. A `StructureIndexEntry` type; narrow analytics, achievements,
   `CreateAssignmentForm` and `demoData` to it (S–M, pure refactor).
3. `buildContent.ts`, the generated index and area files, coverage tests (M).
4. Distractor rework with the unkeyed vocabulary and per-area generator tests
   (M–L; can ship with the seed still bundled).
5. The content function, shared function libs, allow/deny matrix tests (M).
6. Repository split: `loadAreaFacts(areas)` and the IndexedDB cache, with the
   seed still bundled behind a flag for side-by-side checking (L).
7. Remove the seed from the app, turn on the lint rule and the entry-chunk
   check, apply the diagnostic change (S).

Also: `educator/lib/assignmentScope.ts` generates over everything and must
count from the index instead. The demo build keeps full data locally — ship
it a reduced two-area fixture, since the demo is public. The authoring tools
under `/admin` still ship in `dist`.

## What this does and does not stop

Stops: lifting all nine areas from the bundle or the service-worker cache; a
free user unlocking areas by editing local storage; a lapsed subscriber
receiving new content versions.

Does not stop: a paying user scraping their own areas (every area, on the
individual plan); content already cached offline; the public images and
hotspot polygons, which reveal names and positions but not facts. Add
per-user rate limiting in the function (about 30 area fetches an hour) and log
fetch volume. The bar moves from "anyone with devtools" to "someone who paid
for at least a month", which is the right bar for this product.
