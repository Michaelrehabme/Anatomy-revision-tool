# Status: paid content behind the server

Companion to `DESIGN-CONTENT-BEHIND-SERVER.md`. Rewritten 5 Oct 2026 on branch
`content-server-2` (from `581dfe1`, what was live that day; 487 structures).
Checked end to end on 6 Oct 2026 by a second pass that did not write it: see
"Verified on 6 Oct 2026" for what was run, what it found and what it could not
run. Where that section and the rest of this file disagree, that section is
the one that was measured.

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
| 7 | The guards, and the demo fixture | `eslint.config.js`, `src/scripts/checkBundleForFacts.ts`, `src/scripts/lib/bundleFacts.ts`, `data/content/bundledContent.fixture.ts` |
| — | The diagnostic's fixed paper (decision 7) | `data/diagnostic/fixedSample.v2.json`, `lib/diagnosticSample.ts`, `src/scripts/buildDiagnosticSample.ts` |

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
| 401 | no token at all (checked first, so an unknown area with no token is also 401) |
| 400 | not one of the nine areas (before the token is sent to Google) |
| 401 | a token Google will not vouch for; a deleted account; no API key configured |
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

Two limits of that count, both measured: grants to an account that has **no
profile document** (a guest before its first profile write) are not counted on
the account, because there is nothing to update — only the instance's memory
bounds them, and what such an account can be given is the default area and
nothing else. And refusals are bounded only by the instance's memory, so a
cold instance starts from nothing.

An account that has never chosen is given the **default free area, the
shoulder** — as in the app. So a new visitor's device fetches the shoulder on
first load and then the area they pick at onboarding: two areas per new guest,
not one. The shoulder copy is deleted from the device once the pick is known.

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

Entry chunk, built on 6 Oct 2026:

| Build | Entry chunk | Under the limit by |
| --- | --- | --- |
| production today (`index-BCjoSWbO.js`, for comparison) | 1,971,523 B | 125,629 B |
| `bundled` (the default), production's `.env` | 1,981,548 B | 115,604 B |
| `server` | 1,760,848 B | 336,304 B |
| `build:demo` (bundled, the demo's default) | 1,390,882 B | 706,270 B |

After the fixed diagnostic paper and the two fixes of 6 Oct (evening):
`bundled` 1,982,439 B (114,713 B under the limit), `server` 1,761,730 B. The
paper is not in the entry chunk: it is its own file, 7,926 B, precached with
the rest.

Moving the facts out frees about 221 kB of entry chunk, not the 300 kB the
design estimated: the index and the vocabulary stay.

Payloads as generated (`notes` and `source` no longer served):

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

## The eleven decisions

**Confirmed by the owner on 6 Oct 2026: 7 and 10.** Decision 7 was answered
differently from the default first taken, and has been rebuilt: the
diagnostic is a small fixed sample that everyone can see (below). Decision 10
stands as built: the lease is 14 days. **Decision 8 is pending an owner
answer** — see "What decision 8 means". The other eight are defaults taken and
not yet confirmed.

Each is one constant or one small module.

| # | Decision | Default taken | Change it at |
| --- | --- | --- | --- |
| 1 | Artery lists keyed by area | kept | `data/content/vocabulary.ts` |
| 2 | `factKinds` in the index | added | `types/structureIndex.ts`, `split.ts toIndexEntry` |
| 3 | `jointId` / `parentBoneId` in the index | kept | `STRUCTURE_INDEX_FIELDS` |
| 4 | `notes` / `source` in payloads | left out (nothing renders them) | `STRUCTURE_FACT_FIELDS_NOT_SERVED` |
| 5 | Unread vocabulary lists | dropped | `data/content/vocabulary.ts` |
| 6 | Generated files | git-ignored, regenerated by `vite.config.ts` when missing or stale | `src/scripts/lib/ensureContent.ts` |
| 7 | Diagnostic | **owner, 6 Oct:** one fixed paper of fifteen questions, public, the same for every sitter | `lib/diagnosticSample.ts`, `data/diagnostic/` |
| 8 | Assignment preview | pool from the index; questions exact where in hand, else "up to N" — **pending the owner** | `educator/lib/assignmentScope.ts` |
| 9 | Guests / local builds | a guest is an account and is served its free area; local builds get the fixture | `vite.config.ts contentVariant` |
| 10 | Offline lease | 14 days — **owner, 6 Oct: stays** | `CONTENT_LEASE_DAYS` in `data/content/lease.ts` |
| 11 | Demo fixture areas | hip and wrist & hand (most-answered by the demo class) | `data/content/demoFixtureAreas.ts` |

### Decision 7: the diagnostic is one fixed paper

The before/after diagnostic is a whole-body baseline for a class. The default
first taken on this branch gave a student who did not hold every area a paper
of picture-to-name questions only — a different paper from a classmate's. The
owner's answer (6 Oct 2026) is the other option in the design: **a small fixed
sample that everyone can see**, so a whole class sits the same paper whatever
each student has paid for. The picture-only branch and its generator
(`questionGenerators/pictureName.ts`) are removed.

**How it works now.** The paper is not generated on the device. It is fifteen
finished questions in a committed file, `data/diagnostic/fixedSample.v2.json`,
which every build carries — `bundled`, `server` and `fixture` alike — as its
own small chunk (7.9 kB), loaded when a sitting starts. Nothing about the
sitter goes into choosing it: not their areas, not their entitlement, not
their class. A baseline is that paper; a follow-up is the paper its baseline
was. The order is still shuffled per sitting. **One behaviour in both modes:**
a `bundled` build uses the fixed paper too.

**How the fifteen were chosen.** By the rule the live diagnostic used to draw
a class's paper (`buildDiagnostic` + `buildDiagnosticQuestions`: the six
most-pictured muscles and bones of each area, every area once and then round
again, kinds of question spread), run once under the fixed name
`locus-fixed-sample-2` in place of a class id
(`src/scripts/buildDiagnosticSample.ts`). Nobody typed a list, and the paper
has the character the live ones had. All nine areas are covered: six twice,
elbow, thoracic and lumbar spine once.

| # | Covers | Structure | Kind | Asks |
| --- | --- | --- | --- | --- |
| 1 | cervical spine | Multifidus | action | What is the action of Multifidus? |
| 2 | hip | Psoas Major | identify | Which structure is shown? (picture) |
| 3 | shoulder | Levator Scapulae | insertion | What is the insertion of Levator Scapulae? |
| 4 | wrist & hand | Opponens Digiti Minimi (Hand) | nerve | What nerve innervates …? |
| 5 | ankle & foot | Flexor Digitorum Longus | origin | What is the origin of …? |
| 6 | knee | Popliteus | action | What is the action of Popliteus? |
| 7 | thoracic spine | Iliocostalis | identify | Which structure is shown? (picture) |
| 8 | elbow | Brachioradialis | insertion | What is the insertion of …? |
| 9 | lumbar spine | External Oblique | nerve | What nerve innervates …? |
| 10 | cervical spine | Longissimus | origin | What is the origin of …? |
| 11 | hip | Obturator Internus | action | What is the action of …? |
| 12 | shoulder | Latissimus Dorsi | functional | … is most responsible for which of these? |
| 13 | wrist & hand | Flexor Digitorum Profundus | identify | Which structure is shown? (picture) |
| 14 | ankle & foot | Flexor Digiti Minimi Brevis (Foot) | insertion | What is the insertion of …? |
| 15 | knee | Vastus Intermedius | nerve | What nerve innervates …? |

**The kinds of question are the kinds the live diagnostic asks**: multiple
choice, four choices, mixing name-the-picture with origin, insertion, nerve,
action and the clinical "functional" kind. No kind had to be dropped: a
finished question is a prompt and four strings, and any kind can be written
down. (The live papers also sometimes drew an "injury mechanism" question;
this draw did not.)

**Exactly what this makes public.** The file holds, per question, the prompt,
the picture's id, the four choices and which is right. No explanation is
stored (the generator's explanation is the structure's whole card) and no
other field of any structure. Names, areas and pictures were public already.
New to the public, in a build that otherwise carries no fact:

*Twelve facts, each attributed to its muscle by the question that asks it:*

| Structure | Field | The string |
| --- | --- | --- |
| multifidus | `actionText` (= `description`) | Stabilises and extends the spine; rotates the trunk. |
| popliteus | `actionText` (= `description`) | Unlocks the extended knee by laterally rotating the femur on a fixed tibia, then assists knee flexion. |
| obturator-internus | `actionText` (= `description`) | Externally rotates and stabilises the hip; arises from the obturator membrane. |
| flexor-digitorum-longus | `origin` | Posterior tibia |
| longissimus | `origin` | Sacrum; Iliac crest; Lumbar transverse processes |
| levator-scapulae | `insertion` | Superior angle & medial border of scapula |
| brachioradialis | `insertion` | Styloid process of radius |
| flexor-digiti-minimi-brevis-foot | `insertion` | Base of proximal phalanx of 5th toe |
| opponens-digiti-minimi-hand | `nerve` | Ulnar nerve |
| external-oblique | `nerve` | Thoracoabdominal nerves; Subcostal nerve |
| vastus-intermedius | `nerve` | Femoral nerve |
| latissimus-dorsi | `functionalContext` (clinical layer) | Powerful shoulder extension and adduction, e.g. a pull-up, swimming's freestyle pull, or climbing. |

*Twenty-seven wrong answers, printed beside them with no structure named.*
They are other structures' facts of the same kind, and anyone who knows the
anatomy can say whose:

- action sentences (9), which are those muscles' `description`: gracilis,
  abductor pollicis brevis, tensor fasciae latae; opponens digiti minimi
  (hand), intertransversarii, vastus lateralis; dorsal interossei (foot),
  biceps brachii, gluteus medius.
- origins (6): popliteus, tibialis posterior, flexor hallucis longus;
  spinalis, quadratus lumborum, iliocostalis.
- insertions (9): serratus anterior, pectoralis minor, trapezius; flexor/
  extensor carpi ulnaris ("Base of 5th metacarpal"), brachialis, biceps
  brachii; adductor hallucis, quadratus plantae, plantar interossei.
- functional sentences (3): triceps brachii, glenohumeral joint, pectoralis
  major.

The nine wrong answers to the three nerve questions are nerve names, which
the public vocabulary already held. The three picture questions offer names
only. **The right answers are in the file** (`correctIndex`): a student with
devtools can read the key. That is no worse than today, when the bundle holds
every answer to everything, and nothing rides on the diagnostic for the
student — but it is a key that every class shares now, where before each
class drew its own paper.

**The guards know this is the exception.** The lint rule is unchanged: the
paper is not the seed and is not reached through it. The built-file check
looks for every structure's description exactly as before, and nine of the
sentences above are descriptions — so the check is told about the paper
rather than loosened: a sentence the paper prints may appear **only in the
built file that carries the paper** (found by the marker
`locusmsk-diagnostic-fixed-sample-v2`) and **only as often as the paper
prints it**. The same sentence in any other file, or once more in that one,
fails the build like any other leak (`src/scripts/lib/bundleFacts.ts`, eight
tests, run against the real seed and the real paper). The papers are read
from `data/diagnostic/`, so the only way to widen the exception is to put a
string in a paper every student is handed. `diagnosticSample.test.ts` holds
the file to the list above and fails if a right answer on the paper stops
being what the seed says.

**Versions, and the classes already mid-diagnostic.** Every sitting stores
its `version` and the ids of the questions it asked. The live site is
version 1: each class drew its own fifteen on the device (seeded by the class
id) from the whole dataset. The fixed paper is **version 2**
(`DIAGNOSTIC_VERSION`). So:

| Student | What they see |
| --- | --- |
| Joins a class after this ships | Baseline: the fixed paper, stamped v2. Follow-up ten weeks on: the same fifteen, stamped v2. Any build, any areas. |
| Sat a baseline on the live site (v1), follow-up due, `bundled` build | **The paper they sat before**: their class's own fifteen, rebuilt by the version-1 rule from the question ids their baseline stored, stamped **v1** so the two pair. Nothing is orphaned. This is the reason `buildDiagnostic` is kept, with its seed pinned to version 1; a test pins a version-1 draw. |
| …the same student, `server` build, holding every area (a paying student, or a member of a licensed class) | The same: their own v1 paper, rebuilt from the facts the function served. |
| …the same student, `server` build, **not** holding every area (a free account in an unlicensed or lapsed class) | **No follow-up.** Their v1 paper asked for facts across the body that this device may no longer be given, so it cannot be rebuilt; the fixed paper would be a different test and would not pair. The screen says "This one cannot be set up on this account… this account does not have every area", and nothing is stored. Their baseline stays an unpaired baseline and is left out of the class figure. |
| Sat a v1 baseline and somehow a v2 follow-up | Not paired. `pairDiagnostics` still requires the same version and the same questions; tested. |

The class report mixes nothing: a v1 pair and a v2 pair are each a
before/after on one paper, and both are percentage-point gains. But **a class
that straddles the change sat two papers**, and its mean baseline mixes them;
`scripts/cohortReport.ts` now says so when it happens, pairs by
`pairDiagnostics` (it used a looser rule of its own), and counts the students
who sat both but could not be paired.

**What was given up.** Under version 1 two classes drew different papers,
"which limits how far an answer key can travel between year groups". A fixed
public paper cannot do that without publishing more facts: every class, every
year, now sits the same fifteen until the paper is deliberately replaced by a
version 3. And the paper no longer follows the dataset: if one of its twelve
facts is corrected in the seed, the test above fails and a new version has to
be cut (`buildDiagnosticSample.ts`; never edit a published file).

**What decision 8 means for an educator.** An educator's own account is
usually free: the class licence opens areas for members, and the owner is not
a member. In a server build such an educator's device holds one area, so the
form says "up to 20 questions" for scopes outside it and cannot say "all this
scope can build". They also cannot sit their own assignments outside their
free area. Serving educators every area is the alternative.

**Pending (6 Oct 2026).** The owner intends educator features to need a
full-access account, which would dissolve this decision rather than answer it
— an educator would hold every area. **That rule is not built**, and nothing
on this branch enforces or assumes it. Before it can be, the owner has to say
what happens to the classes that already exist and are owned by free accounts.
Until then decision 8 is as built above.

**What decision 11 costs.** Two of the demo's three set assignments are on
the shoulder and the ankle & foot. Built from the fixture, a visitor who
tries to sit those is told the area is not part of the demo. `hip` +
`shoulder` is the pair to pick if that matters more than dashboard density.
The demo's default is still `bundled`.

## Rollout — recommended order

Nothing below has been done. Each step is safe on its own and can stop there.
Each has its own way back: step 1, redeploy the previous `firestore.rules`
(`git show 581dfe1:firestore.rules`) — free areas already written stay on the
accounts and are simply no longer policed; step 2, publish the previous
deploy from Netlify's deploy list (the content function goes with it; nothing
calls it); step 3 is a draft and is deleted or ignored; step 5, unset the
variable and redeploy, or publish the previous deploy.

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

10. **A slow connection at the moment a free area is chosen** used to end in
    a refusal (fixed 6 Oct, `1dc7dbb`). What is left of it: if the write to
    the account takes longer than eight seconds the app asks anyway, may be
    refused once, and asks again by itself when the write lands.
11. **Whoever signs in on a device inherits that device's free-area copy** if
    their own account has none: the copy is moved up as that account's first
    pick. Seen when a new admin account signed in on a browser a guest had
    used. For a paying account it costs nothing; for a second free student on
    a shared computer it spends their choice for them.
12. **Someone offline at the first load after the switch has no facts**: none
    were ever saved on the device, because a bundled build saves none. They
    see the names, the pictures and "connect to load this area" until they
    are next online. Measured; see below.

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
- The diagnostic's fixed paper gives away twelve facts and its own answer
  key, on purpose (decision 7 lists them).

## Verified on 6 Oct 2026

On `content-server-2` at `5a1420d` (three commits past the hand-over at `0eccb7a`:
`e8158ca` rules tests, `1dc7dbb` the free-area race, `5a1420d` a slash in a
document id). Everything ran against the Firebase emulators (Firestore and
Auth, project `demo-locusmsk`) and a local `netlify dev`; nothing touched the
real project, and nothing was deployed to production.

**Checks.** `vitest`: 1,999 passed, 1 skipped (the question dump), 160 files
— main had 1,836. `test:rules`: 63 passed — main had 44. `tsc` on the app and
on the functions: clean. `eslint` on the 102 files changed since main: no
errors, 3 fast-refresh warnings. `validate-content`: 0 errors.

**Bundled did not change.** The dump was run on `581dfe1`'s source and on
this branch: 69 configurations, 26,695 questions, sha256
`629965d3…9a06bb` both times, the files byte-identical.

**A server build carries no facts.** An independent scan (not `check:bundle`)
took every fact string of 28 characters or more out of the nine payloads that
is not also in the public index or vocabulary — 1,225 of them — and looked in
every non-picture file of `dist/`. The same scan finds all 1,225 in a bundled
build's entry chunk. In the server build it finds four, all in the admin
chunk: sentences in the change-request log that quote a fact as an example
(`changeRequests.seed.ts`), not the seed. `.content/` is not in `dist/`.

**The function, over real HTTP with emulator-minted tokens.** Every row
behaved as the table above says: no token 401; a forged token 401; a guest on
its own area 200 and on the other eight 403; a guest with no profile, the
shoulder only; free, and free with the change used; paid, all nine; past due
inside the three days, all nine, and after them the free area only;
cancelled before the period ends, all nine, and after, the free area;
refunded, the free area; a delayed start not begun, the free area, and begun,
all nine; a member of a licensed class, all nine; of a lapsed or unlicensed
one, the free area; an admin with no entitlement, the free area (no bypass);
an unknown area 400; a deleted account 401; POST and OPTIONS 405; another
site's `Origin` 403. Every answer `Cache-Control: private, no-store`, never a
CORS header. Each of the nine payloads identical to its generated file, no
structure from outside its area, no `notes` or `source`. A stale `v`, or none,
is answered with the deploy's version. The lease was 14 days, and 2.000 days
inside a two-day grace. The 31st grant in an hour was 429 with `Retry-After`
and the stored count stopped at 30.
*Not observable locally:* the in-memory cut-off for refusals — `netlify dev`
reloads the function on every call — which the unit test
`bounds refusals too` covers instead.

**The rules, in the emulator.** Create once; not twice; not before thirty days
by the server's clock; once after; not twice; no backdated or future date; not
a non-area; not another account's; a choice moved up from a device buys no
extra change, moved as unused or as used; entitlement, payment flags and
`contentFetch` not client-writable. All in `rules-tests/firestore.rules.test.ts`;
two tests were added for the sequences a client could attempt in a row.

**In a browser** (Chromium, fresh profile, no reload, 1280 px and 390 px, a
server build): a guest picks the knee at onboarding and its cards and first
session show facts; a shoulder card shows the lock, the function answers that
guest 403, and no script the page loaded contains another area's facts; the
account made a subscriber in the emulator loads all nine; a twenty-question
mixed session with locate questions, the answer-in-words route and the long
description runs to its results; Progress, Atlas and Study with one area and
with nine; an area downloaded, the network cut, the page reloaded — facts and
pictures there, nothing asked; every lease forced into the past — "connect to
load this area" on every screen, no crash, the copies deleted; reconnecting
and Try again brings them back; sign-out deletes every saved copy; the
educator screens (a class created, all five tabs) and the six admin pages
open. No console errors beyond the network's own while offline.
*Not browser-tested:* iOS Safari and an installed PWA; a real update prompt
from the live bundle to this one; a stale-version client (unit-tested);
`visibilitychange` renewal after days in a background tab (unit-tested); the
browser's own `online` event (Playwright does not fire it; sent by hand); the
diagnostic for a mixed class (decision 7) and the assignment form for a free
educator (decision 8).

**Existing users, first load after an update**, in both modes:

| Who | `bundled` | `server` |
| --- | --- | --- |
| Free, area only on the device (chosen 21 days ago) | moved to the account dated today, changeable in 30 days; facts as before; function not called | the same, then one fetch, 200, no refusal |
| …who had used their one change, or whose record predates the count | moved up as used | the same |
| …who then edits the device copy | overwritten by the account's on the next load | the same |
| Paying | everything as before; function not called; entitlement untouched | nine fetches, all 200 |
| A guest | as a free user | as a free user |
| Offline at that moment | everything works (facts are in the bundle); the move waits and lands on reconnect | names and pictures, "connect to load" for the facts; loads by itself on reconnect |

**Defects found.**

1. *Fixed, `1dc7dbb`.* A server build asked the function for a free area that
   had been picked on the device but not yet written to the account, and was
   refused: onboarding ended on "Knee could not be opened for this account".
   Reproduced by slowing the account write; the loader now waits for it.
2. *Fixed, `5a1420d`; the same on main, so live today.* The question for
   "Proximal biceps tendinopathy/tear" has a slash in its id, the id is a
   Firestore document id, and every answer to it failed to save.
3. *Fixed after this pass (6 Oct); the same on main, so live today.* After
   "Create account" the screen went on saying "this device only" until the
   page was reloaded: linking keeps the uid, so Firebase's
   `onAuthStateChanged` does not fire, and it was the only thing
   `AuthProvider` listened to. The sign-in actions now hand the provider the
   user they ended with, and it takes it up when it is the same account seen
   differently. The profile document (`isAnonymous`, `email`) is refreshed at
   the same moment; before, it too waited for a reload.
4. *Fixed after this pass (6 Oct); the same on main, so live today.* Offline
   with nothing cached, one Firestore read rejected with no handler ("Failed
   to get document because the client is offline" as an uncaught error). It
   was the desktop sidebar's level bar (`NavSidebar` `LevelProgress`), which
   every desktop screen mounts. It now draws no level when it cannot read
   one, which is what it already did while waiting.

**A draft of the default build**, deployed from this branch (never to
production): `https://content-server--mskanatomyrevision.netlify.app`, entry
chunk 1,981,548 B. On it: `paddle-portal` 405, `paddle-webhook` 405,
`renewal-reminders` 403, `content-area` with no token 401 (`private,
no-store`), with a token Google rejects 401, an unknown area 400, POST 405,
another site's `Origin` 403. Production served `assets/index-BCjoSWbO.js`
before and after. *Not run there:* a granted request — that would read the
real database, which this pass was not to touch. It is rollout step 3.

**To run it again.** `firebase emulators:start --only firestore,auth --project
demo-locusmsk`; `netlify dev --offline` with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`,
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and `METADATA_SERVER_DETECTION=none`
(without the last, every call waits three seconds on a metadata lookup); a
build made with `VITE_CONTENT_SOURCE=server VITE_PERSISTENCE=firestore
VITE_FIREBASE_EMULATORS=1`, any non-empty `VITE_FIREBASE_API_KEY`, and
`VITE_FIREBASE_PROJECT_ID=demo-locusmsk`. On Windows `netlify dev` answers 403
for every static file in a subdirectory, so the build has to be served by
something else that passes `/.netlify/functions/*` through to it. `netlify
dev` in a worktree also reads the main checkout's `.env`. And Chromium's Cache
Storage fails outright when the browser profile's path is very long, which
looks exactly like "downloads are not available in this browser".

## After the owner's answers, 6 Oct 2026 (evening)

Four commits on top of the pass above: the fixed diagnostic paper
(decision 7), the same paper held in one order for a whole sitting, and
defects 3 and 4. Emulators only; nothing deployed to production.

**Checks.** `vitest`: 2,035 passed, 1 skipped, 163 files. `test:rules`: 63.
`tsc` on the app and the functions: clean. `eslint` on the files touched: no
errors. `validate-content`: 0 errors. The question dump is still
`629965d3…9a06bb`: the version-1 draw and every ordinary session are
byte-identical to `581dfe1`. A `server` build passes `check:bundle` with the
paper in it (69 files, 462 descriptions looked for).

**In a browser** (Chromium, fresh profile, a server build, 1280 px and
390 px, the Firestore and Auth emulators): a guest picks the knee, creates an
account — and with no reload the Account screen drops "this device only",
shows the email, offers no "Create account", and the profile document reads
`isAnonymous: false`; joins an unlicensed class by its code, so stays free
and holds one area; sits the baseline end to end: fifteen questions, each
with its prompt and four choices, the three pictures drawn, no "connect to
load" and no facts notice, no area asked for during the sitting; the stored
sitting is version 2 with the paper's fifteen ids and the words on screen are
the committed file's. With `takenAt` moved back 75 days the follow-up is
offered and asks the same fifteen (prompt, choices, picture), stored as
version 2; nothing is offered after it. Then the network cut and `/`,
`/account`, `/progress` reloaded: nothing thrown uncaught. The same script
against the build from before these commits fails on the label (four checks)
and on the offline reload (the uncaught error, three times).
*Not browser-tested:* a follow-up to a version-1 baseline (unit-tested, in
both the can and the cannot case); iOS Safari and an installed PWA; Google
sign-in (the emulator has no popup; unit-tested).

**The draft** was redeployed from this state (default build, never to
production): `https://content-server--mskanatomyrevision.netlify.app`, entry
`index-DxpO7SDg.js`, the paper at `assets/fixedSample.v2-hPHW3veh.js`.
`paddle-portal` 405, `paddle-webhook` 405, `renewal-reminders` 403,
`content-area` with no token 401 `private,no-store`. Production still serves
`assets/index-BCjoSWbO.js`.

**Left open by this.**

- A student with a version-1 baseline who cannot be given their follow-up (a
  server build, not every area) is still shown the offer on the Account
  screen each visit; it leads to the screen that says why. The offer does not
  know what the device holds.
- The fifteen were drawn by rule, not chosen by a teacher. They are the
  owner's to change before the first version-2 baseline is sat
  (`buildDiagnosticSample.ts --force`); after that, only as version 3.
- Decision 8.

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
