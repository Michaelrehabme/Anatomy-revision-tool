# Status: paid content behind the server

Companion to `DESIGN-CONTENT-BEHIND-SERVER.md`. Rewritten 5 Oct 2026 on branch
`content-server-2` (from `581dfe1`, what was live that day; 487 structures).

**All seven steps are built. Production is NOT switched over.** The default
build is still `bundled`: every fact ships in the bundle and the paywall is
still drawn by the browser. Nothing here protects anything until the owner
sets `VITE_CONTENT_SOURCE=server` and redeploys — see "Rollout".

## What exists

| Step | What | Where |
| --- | --- | --- |
| 1 | The free area lives on the account, held to one choice and one change by the rules | `firestore.rules`, `rules-tests/`, `hooks/useEntitlement.ts`, `data/entitlementRepository.ts`, `lib/freeAreaRecord.ts` |
| 2 | A structure type with no facts | `types/structureIndex.ts`, `data/structureIndex.ts` |
| 3 | The cut, generated without being asked | `src/scripts/buildContent.ts`, `src/scripts/lib/ensureContent.ts` |
| 4 | Distractors that survive one area | `lib/questionGenerators/sources.ts` |
| 5 | The content function | `netlify/functions/content-area.ts`, `netlify/functions/lib/`, `netlify/tests/content-area.test.ts`, `lib/entitlementRecord.ts` |
| 6 | The app runs with only some areas in hand | `data/content/` (`contentSource.ts`, `bundledContent*.ts`, `areaFacts.ts`, `serverLoader.ts`, `lease.ts`), `data/contentCache.ts`, `hooks/useAnatomyContent.ts`, `components/shared/AreaFactsNotice.tsx`, `pwa/offline/areaFactsPrefetch.ts` |
| 7 | The guards, and the demo fixture | `eslint.config.js`, `src/scripts/checkBundleForFacts.ts`, `data/content/bundledContent.fixture.ts` |

### The switch

`VITE_CONTENT_SOURCE` = `bundled` (default) | `server` | `fixture`, read by
`vite.config.ts` at build time. It is an **alias**, not a runtime branch:
everything imports `data/content/bundledContent`, and the config points that
name at `bundledContent.ts` (the seed), `.server.ts` (index + vocabulary, no
facts, a loader) or `.fixture.ts` (two areas). A server build's module graph
does not contain the seed.

- A `server` build with `VITE_PERSISTENCE=local` has nobody to ask as, and is
  given the fixture.
- The test runner is always `bundled`, whatever `.env` says.
- `npm run build` ends with `check:bundle`, which fails a server or fixture
  build if a structure's description is in any built file.
- Not added to `.env.example` or `vite-env.d.ts`: another session had both
  open. Add `VITE_CONTENT_SOURCE` and `VITE_FIREBASE_EMULATORS` there.

### The free area (step 1)

`users/{uid}.freeArea = { area, chosenAt, switches }`, `chosenAt` a server
timestamp. The rules allow: a first write (switches 0 or 1, `chosenAt ==
request.time`); one change, `switches` 0 → 1, a different area, thirty days
after the stored `chosenAt`; nothing else. Refused, each with a rules test:
choosing twice; changing early; changing twice; a change that does not count
itself or counts backwards; a backdated or future `chosenAt`; re-timing or
re-counting without changing; removing the field; anything not one of the
nine areas or not this shape; another account's document; an entitlement
slipped in beside a valid choice.

A device's old choice is **moved up once, dated the day it is moved.** A
student who picked three weeks ago waits thirty days from the move, not nine.
Accepting the device's date would make "migration" a way to backdate.

**Not stopped** (tested as a known limit): the owner may delete their profile
(erasure) and a new profile may carry a first pick — so delete-and-recreate
gives a fresh choice. So does a second account. See "Risks".

### The content function (step 5)

`GET /.netlify/functions/content-area?area=<area>&v=<version>` + `Authorization:
Bearer <Firebase ID token>`.

| Answer | When |
| --- | --- |
| 405 | not GET (OPTIONS included: no preflight is ever answered) |
| 403 | an `Origin` that is not this site's (or one in `CONTENT_ALLOWED_ORIGINS`) |
| 401 | no token; a token Google will not vouch for; a deleted account; no API key configured |
| 400 | not one of the nine areas (before the token is checked) |
| 429 | over 30 an hour (`data/content/fetchLimit.ts`), with `Retry-After` |
| 503 | the account could not be read (includes a missing service account) |
| 403 | the account may not have this area |
| 200 | `{ version, area, leaseUntil, structures }` |

Every answer is `Cache-Control: private, no-store`; no CORS header is ever
sent. The decision is `lib/entitlementRecord.areaAccess`, built from the
app's own `resolveEntitlement`, `freeAreasFor`, `canAccessArea`. No admin
bypass, as in the app. The count is kept on `users/{uid}.contentFetch`
(pinned in the rules; `update` only, so a deleted profile is not recreated)
and in the instance's memory, which refuses without a database read.

### Leases and the device copy (step 6)

- Lease: `min(entitlement expiry, now + 14 days)`; 14 days for the free area.
- A copy inside its lease is used without asking. Under half the lease left →
  renewed when online, at most once a day. Version changed → refetched.
- 403 → the copy is deleted. No answer → the copy stands while its lease
  runs; once it is over the copy is deleted and the area reads as not on the
  device.
- Another account's copies are deleted on load; sign-out clears all; an area
  the account lost is deleted only if the entitlement was actually **read**
  (`UseEntitlement.known`), never when the read failed.
- IndexedDB `locusmsk-content`, store `areas`, key `uid:area:version`.

## Sizes

Measured 5 Oct 2026. Entry chunk limit 2,097,152 B.

See the hand-over report for the entry chunk in each mode; payloads as
generated (`notes` and `source` no longer served):

| File | Raw |
| --- | --- |
| `structureIndex.json` (now with `factKinds`) | 197.4 kB |
| `vocabulary.json` | 12.0 kB |
| `demoFixture.json` (hip + wrist & hand) | 79.1 kB |
| shoulder | 35.9 kB |
| elbow | 15.6 kB |
| wrist-hand | 50.9 kB |
| hip | 28.2 kB |
| knee | 25.2 kB |
| ankle-foot | 46.5 kB |
| cervical-spine | 29.4 kB |
| thoracic-spine | 26.8 kB |
| lumbar-spine | 25.7 kB |

## Proof that `bundled` did not change

`lib/__tests__/questionDump.test.ts` (skipped unless `QUESTION_DUMP` is set)
writes every question of 69 fixed configurations — 26,695 questions — with
the clock fixed. Run at `581dfe1` in a clean checkout and at this branch:
**byte-identical**, sha256 `629965d3…9a06bb`.

    QUESTION_DUMP=/path/out.json npx vitest run --exclude ".claude/**" \
      src/features/anatomy-revision/lib/__tests__/questionDump.test.ts

(An earlier pair of dumps differed in three OINA sessions. That was the
clock: whether a fact is due decides its format, and the runs were an hour
apart. The dump now fixes the time.)

## The eleven decisions — defaults taken, none confirmed by the owner

Each is one constant or one small module.

| # | Decision | Default taken | Change it at |
| --- | --- | --- | --- |
| 1 | Artery lists keyed by area | kept | `data/content/vocabulary.ts` |
| 2 | `factKinds` in the index | added | `types/structureIndex.ts`, `split.ts toIndexEntry` |
| 3 | `jointId` / `parentBoneId` in the index | kept | `STRUCTURE_INDEX_FIELDS` |
| 4 | `notes` / `source` in payloads | left out (nothing renders them) | `STRUCTURE_FACT_FIELDS_NOT_SERVED` |
| 5 | Unread vocabulary lists | dropped | `data/content/vocabulary.ts` |
| 6 | Generated files | git-ignored, regenerated by `vite.config.ts` when missing or stale | `src/scripts/lib/ensureContent.ts` |
| 7 | Diagnostic | picture-to-name only when the sitter does not hold every area | `components/Diagnostic/DiagnosticScreen.tsx` |
| 8 | Assignment preview | pool from the index; questions exact where in hand, else "up to N" | `educator/lib/assignmentScope.ts` |
| 9 | Guests / local builds | a guest is an account and is served its free area; local builds get the fixture | `vite.config.ts contentVariant` |
| 10 | Offline lease | 14 days | `CONTENT_LEASE_DAYS` in `data/content/lease.ts` |
| 11 | Demo fixture areas | hip and wrist & hand (most-answered by the demo class) | `data/content/demoFixtureAreas.ts` |

**What decision 7 means for a class.** With the seed bundled, nothing changes.
In a server build the fifteen structures are still the same for everyone in
the class (they are chosen from the index). A student holding every area —
any member of a licensed class — sits the paper as now, mixing picture and
fact questions. A student who does not (a free account in an unlicensed
class) sits fifteen picture-to-name questions about the same structures.
Those are two different papers, and a class mixing both kinds of student is
measured on both. A picture-only baseline replays exactly later; a mixed
baseline replayed by a student who has since lost access drops its fact
questions and is shorter.

**What decision 8 means for an educator.** An educator's own account is
usually free: the class licence opens areas for members, and the owner is not
a member. In a server build such an educator's device holds one area, so the
form says "up to 20 questions" for scopes outside it and cannot say "all this
scope can build". They also cannot sit their own assignments outside their
free area. Serving educators every area is the alternative.

**What decision 11 costs.** Two of the demo's three set assignments are on
the shoulder and the ankle & foot. Built from the fixture, a visitor who
tries to sit those is told the area is not part of the demo. `hip` +
`shoulder` is the pair to pick if that matters more than dashboard density.
The demo's default is still `bundled`.

## Rollout — recommended order

Nothing below has been done. Each step is safe on its own and can stop there.

1. **Rules.** `npm run deploy:rules`. Additive: old clients write no
   `freeArea` and are unaffected. Nothing else may ship first — a client that
   writes `freeArea` before the rules know it is still accepted (the old
   rules allow any field), but unconstrained.
2. **Client and functions, still `bundled`.** Deploy this branch as it is.
   Students notice nothing except: their free area is moved to their account
   on first load, and the thirty-day clock restarts that day. The content
   function is live and unused. Watch `billingFailures` and the function log
   for a day; confirm the three billing functions answer as before.
3. **Test `server` on a draft.** Build with `VITE_CONTENT_SOURCE=server` and
   deploy without `--prod`. A draft shares production's Firebase and
   functions environment, so sign in with a real free account and a real
   paid one: free sees one area; paid sees nine; offline reload works;
   `/structure/<locked>` shows the lock. Check the function log lines.
4. **Decide the eleven.** At least 7, 8, 10 before students are switched.
5. **Switch.** Set `VITE_CONTENT_SOURCE=server` in Netlify and redeploy.
   Existing installs keep the old bundle until they accept the update prompt
   (`registerType: 'prompt'`), so the two modes coexist for days; both work.
6. **Rollback** is unsetting the variable and redeploying. The seed is still
   in the repository and a bundled build is the default. Device copies become
   unused, not harmful.
7. **The demo** (`build:demo`) separately: `VITE_CONTENT_SOURCE=fixture` on
   the demo site once decision 11 is made.

Only after step 5 has held: remove the seed from a bundled build's reach
entirely, if ever. Keeping it is what makes rollback one variable.

## Risks to paying users

1. **The thirty-day clock restarts on migration** for every free student
   (not a paying-user risk, but the one visible change at step 2).
2. **A paying student offline for more than 14 days** opens the app to
   pictures without facts. Decision 10.
3. **At the renewal instant**, between Paddle charging and the webhook
   landing, the entitlement reads as expired (as today, paywall trace finding
   14). In a server build the app then also asks the function, is refused,
   and deletes the saved copies; they are refetched once the webhook lands.
   A student who goes offline in exactly that gap has no facts until they
   reconnect. A grace on `expiresAt` for the lease would close it.
4. **First load needs the function.** A cold start is 300–800 ms per area,
   nine in parallel for a subscriber, behind the "Loading anatomy content…"
   screen. If the function is down, nobody without a saved copy can revise.
   Today a broken function breaks billing only.
5. **The function reads Firestore**: one read per fetch (two for a class
   member) and one write per grant, against Spark's daily allowance. Nine per
   subscriber per week at steady state; a release that changes facts costs
   nine per active device.
6. **Entitlement read fails → free → paid areas not loaded.** As today the
   gates lock on a failed first read; the saved copies are kept (not purged)
   and return on the next successful read.
7. **A stale bundle and a newer function** is handled (`askedWith`); a newer
   bundle and an older function cannot happen within one deploy.
8. **The service worker** does not cache the function's answers (only
   `/anatomy/` images are runtime-cached; the response is `no-store`).
9. **App Check**, when it is switched on, does not cover this function: it
   verifies an ID token, not an App Check token.

## What this still does not stop

- **Nine free accounts are nine areas.** A guest is an account, any account
  may choose its free area, and sign-up is free. The design's "someone who
  paid for at least a month" is not the bar; "someone prepared to script nine
  sign-ups" is. The same goes for delete-and-recreate. Closing it means
  either not letting the free area be chosen, or App Check on the function,
  or a per-IP limit — none built.
- A paying account saving its own areas; content already on a device; the
  public pictures and hotspot polygons.
- The index gives away each structure's name, areas, relations (`jointId`,
  `parentBoneId`) and which kinds of fact it has.

## Found on the way, not fixed

- Adaptive mode builds each MCQ from a pool of one structure, so its name
  distractors have nothing to draw from (from the earlier status note; still
  true).
- `tsc -p tsconfig.node.json` fails on `caches` in `pwa/anatomyCache.ts` and
  `offline/swPlugin.ts`; it did before this work.
- `eslint .` reports 21 errors in `src/scripts/` (explicit `any`); none in
  files this work touched.
- `HotspotEditorApp` is lazy-loaded without a build-time guard, unlike
  `DevRoutes`; it no longer imports the seed, so it carries no facts either way.
