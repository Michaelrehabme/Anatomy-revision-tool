# Status: paid content behind the server

Companion to `DESIGN-CONTENT-BEHIND-SERVER.md`. Rewritten 5 Oct 2026 on branch
`content-server-2` (from `581dfe1`, what was live that day; 487 structures).
Checked end to end on 6 Oct 2026 by a second pass that did not write it: see
"Verified on 6 Oct 2026" for what was run, what it found and what it could not
run. Where that section and the rest of this file disagree, that section is
the one that was measured.

**Three owner decisions were built on the night of 6 Oct 2026**: the
diagnostic's papers follow what a student holds (decision 7), the free area
needs a real account (decision 9), and teaching needs full access (decision
8). What was measured is in "Three owner decisions, 6 Oct 2026 (night)" near
the end. The sections dated before it say what was true when they were
written; where one of them disagrees with that section, the later one is the
one that was measured.

**Two more owner decisions were built on 7 Oct 2026**: the ten diagnostic
papers are approved on the condition that their answers are the Atlas's
(checked question by question, and now held by a test), and the free area
needs a **confirmed email address**. What was measured is in "Two owner
decisions, 7 Oct 2026" at the end, which is also where the rollout order now
stands; **"Before you deploy" there lists what the owner must do in the
Firebase console first.** Where an earlier section disagrees with it, it is
the one that was measured.

**The rules on this branch are stricter than production's**, for guests, for
creating a class, and for choosing a free area with an unconfirmed address.
"Rollout" says exactly what an installed copy of the live bundle experiences
once they are deployed: nothing, for a guest or a student.

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
| — | The diagnostic's ten papers (decision 7) | `data/diagnostic/papers.v3.json` and its lock, `lib/diagnosticPapers.ts`, `lib/diagnosticReport.ts`, `src/scripts/diagnosticPapers.ts`, `src/scripts/lib/paperLock.ts`, docs/DIAGNOSTIC-PAPERS.md |
| — | A real account for the free area (decision 9) | `firestore.rules` `isRealAccount`, `hooks/useEntitlement.ts` (`guest`, `needsFreeArea`), `lib/entitlementRecord.areaAccess`, `netlify/functions/lib/idToken.ts`, `components/Auth/` (`AccountForm`, `AccountGate`, `GuestAccountPanel`), `components/Onboarding/onboardingSteps.ts`, the `gated` wrapper in `App.tsx` |
| — | Full access for teaching (decision 8) | `firestore.rules` `mayTeach` / `mayRunCohort`, `educator/lib/teachingAccess.ts`, `educator/hooks/useTeachingAccess.ts`, `educator/components/TeachingGate.tsx`, `TeachingAccessPanel.tsx`, `Account/MyClasses.tsx` |
| — | A confirmed email address for the free area (7 Oct) | `lib/emailVerification.ts` (the rule, and when it starts), `firestore.rules` `emailIsConfirmed` / `profilePredatesVerification` / `createdAtIsHonest`, `lib/entitlementRecord.areaAccess`, `netlify/functions/lib/idToken.ts`, `hooks/useEntitlement.ts` (`needsEmailConfirmation`, `switchNeedsConfirmation`), `data/emailConfirmation.ts`, `context/AuthProvider.tsx`, `components/Auth/` (`EmailConfirmPanel`, `EmailConfirmGate`), `scripts/verificationReport.ts` |
| — | The papers say what the Atlas says (7 Oct) | `lib/atlasFacts.ts` (`muscleCardFacts`, `functionalRole`), `components/__tests__/diagnosticPapersAtlas.test.tsx` |

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
timestamp. **Only a real account may write it** (6 Oct, night): a guest's
token — `firebase.sign_in_provider == 'anonymous'` — may leave it as it is
and nothing more. From an account, the rules allow: a first write (switches 0 or 1, `chosenAt ==
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

**The device's copy belongs to one account** (6 Oct, night). It carries the
uid it was written for, and a different account signing in on that device
does not see it. A copy with no uid — everything the live bundle wrote — is
taken to be whoever is signed in the first time this build looks, and
stamped as theirs. A guest's copy is not moved up while they are a guest
(the rules would refuse it); it is moved up the moment they create an
account, which keeps their uid.

**No default.** An account with no free area holds no area, in the app and
in the function, and is asked to choose. (A build with no accounts still
defaults to the shoulder.)

**And only an account whose email address is confirmed** (7 Oct): choosing
or changing needs `email_verified` on the token. One exception — a profile
first written before the rule started may make its FIRST choice unconfirmed,
because that is the live app's device-only choice being moved up for someone
who was never sent a confirmation email. See "Two owner decisions, 7 Oct
2026".

**Not stopped** (tested as a known limit): the owner may delete their profile
(erasure) and a new profile may carry a first pick — so delete-and-recreate
gives a fresh choice, to an account that has confirmed its address. So does
a second account with a second address that really receives email. See
"Risks".

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
| 403 | **a guest** (an anonymous token), for every area, before anything is read about them |
| 503 | the account could not be read (includes a missing service account) |
| 403 | **an account whose email address is not confirmed**, asking for its free area ("Confirm your email address to open your free area") — unless it holds full access, or its profile is from before the rule (7 Oct) |
| 403 | the account may not have this area — which includes every area, for an account that has not chosen its free area |
| 200 | `{ version, area, leaseUntil, structures }` |

Every answer is `Cache-Control: private, no-store`; no CORS header is ever
sent. The decision is `lib/entitlementRecord.areaAccess`, built from the
app's own `resolveEntitlement`, `freeAreasFor`, `canAccessArea`. No admin
bypass, as in the app. The count is kept on `users/{uid}.contentFetch`
(pinned in the rules; `update` only, so a deleted profile is not recreated)
and in the instance's memory, which refuses without a database read.

One limit of that count, measured: refusals are bounded only by the
instance's memory, so a cold instance starts from nothing. (The other limit
the evening found — grants to a caller with no profile document could not be
counted on the account — is gone: such a caller is no longer granted
anything.)

**A guest is served nothing, and there is no default area** (6 Oct, night).
Google's lookup lists the ways an account can sign in; a guest has none, and
is answered 403 for every area whatever their document says. An account
that has not chosen its free area is refused every area too: it used to be
served the shoulder, so a new visitor's device fetched the shoulder on first
load and then the area they picked. Now it fetches one.

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

After the three owner decisions (6 Oct, night): `bundled` 2,000,555 B
(96,597 B under the limit), `server` 1,779,830 B,
`build:demo` 1,407,741 B. The ten papers are one chunk of
30,943 B holding no facts; the screen a guest sees is its own
chunk too. The growth in the entry chunk is the account form now being part
of onboarding, the builder that puts a paper together, and the teaching
panel on the account screen.

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

**The owner's, as of 6 Oct 2026 (night): 7, 8, 9 and 10.** Decision 7 has
been answered twice and rebuilt twice: first "a small fixed sample that
everyone can see" (that evening; built, never released), then "choose your
own, based on region if on a free account" — ten papers, built from the
sitter's own facts (below). Decision 8 is resolved by a rule the owner set:
educator features need full access. Decision 9's default is reversed: a
guest is not an account. Decision 10 stands as built: the lease is 14 days.
The other seven are defaults taken and not yet confirmed.

Each is one constant or one small module.

| # | Decision | Default taken | Change it at |
| --- | --- | --- | --- |
| 1 | Artery lists keyed by area | kept | `data/content/vocabulary.ts` |
| 2 | `factKinds` in the index | added | `types/structureIndex.ts`, `split.ts toIndexEntry` |
| 3 | `jointId` / `parentBoneId` in the index | kept | `STRUCTURE_INDEX_FIELDS` |
| 4 | `notes` / `source` in payloads | left out (nothing renders them) | `STRUCTURE_FACT_FIELDS_NOT_SERVED` |
| 5 | Unread vocabulary lists | dropped | `data/content/vocabulary.ts` |
| 6 | Generated files | git-ignored, regenerated by `vite.config.ts` when missing or stale | `src/scripts/lib/ensureContent.ts` |
| 7 | Diagnostic | **owner, 6 Oct (night):** ten papers; every area held → the whole-body paper, a free account → its free area's paper; built at the sitting from the sitter's facts, nothing public | `lib/diagnosticPapers.ts`, `data/diagnostic/papers.v3.json` |
| 8 | Assignment preview | **resolved, owner, 6 Oct (night):** teaching needs full access, so an educator holds every area and the count is exact; "up to N" remains only for a device without the facts | `educator/lib/teachingAccess.ts`, `firestore.rules` `mayTeach` |
| 9 | Guests / local builds | **owner, 6 Oct (night):** a guest is NOT an account and is served nothing; the free area needs a real account. **Owner, 7 Oct:** and that account's email address must be confirmed. Local builds get the fixture | `firestore.rules` `isRealAccount`, `emailIsConfirmed`; `lib/emailVerification.ts`; `hooks/useEntitlement.ts`; `netlify/functions/content-area.ts` |
| 10 | Offline lease | 14 days — **owner, 6 Oct: stays** | `CONTENT_LEASE_DAYS` in `data/content/lease.ts` |
| 11 | Demo fixture areas | hip and wrist & hand (most-answered by the demo class) | `data/content/demoFixtureAreas.ts` |

### Decision 7: ten papers, and which one depends on what the student holds

**Owner, 6 Oct 2026 (night): "choose your own, based on region if on a free
account."** This replaces the answer of that evening (one public paper of
finished questions, version 2), which was built and never released. No
sitting carries version 2 outside test data; its file, its script and its
allowance in the built-file check are gone, and the number is skipped.

**Who sits what.**

| Sitter | Paper |
| --- | --- |
| Holds every area: a subscriber, a member of a licensed class, a complimentary account, a subscriber inside the three days of grace | the **whole-body** paper: fifteen questions across all nine areas |
| A free account | the paper for **their free area**: fifteen questions from that one area. Nine such papers |
| A free account that has not chosen its area | none: nothing is offered until it has chosen |

**A paper is a list of what to ask, not of answers.**
`data/diagnostic/papers.v3.json` holds, for each question, a structure's id,
the kind of question, the picture's id if it is a picture question, and the
ids of the three structures whose own answers are the wrong choices. No
origin, insertion, action or sentence of any kind. The question — its
wording, the right answer, the wrong ones — is built at the sitting from the
facts the sitter's device holds (`lib/diagnosticPapers.ts`
`buildPaperQuestions`). So the papers put **no fact in any build**, and
`check:bundle` allows nothing again: a server build passes with 462
descriptions looked for and none found, no exception.

The one thing in the file that is not an id is a **nerve's name**, on five
area-paper questions (two of them repeated on the whole-body paper), where an area has too few nerves of its own to offer four (the
elbow has two). Those names are in the public vocabulary every server build
already carries, and say nothing of which muscle a nerve supplies. What the
file does give away, said plainly: which fifteen structures each paper asks
about and in which way, and that structure A's answer is not structure B's.

**Everyone who sits a paper gets the same paper.** The wrong answers are
named in the file and the order of the four choices comes from the
question's own id, so nothing depends on what else is loaded. Tested for
every paper: byte-identical on a bundled build, on a server build holding
only that paper's area, and on one holding all nine; and a follow-up
byte-identical to its baseline.

**An area paper uses that area and nothing else**, because a free student
holds nothing else. The structure asked about and every structure a wrong
answer comes from sit in the paper's area; a paper that reached outside
would build nothing rather than a shorter test.

**How the 150 were chosen.** By hand, not by rule: what a first- or
second-year sports therapy or physiotherapy student is commonly taught and
examined on in that area (shoulder: deltoid, supraspinatus, the rotator
cuff's attachments, the acromion, the glenohumeral joint…), spread across the
kinds of structure the area has and the kinds of question the diagnostic
already asked. **docs/DIAGNOSTIC-PAPERS.md lists every question with its
right answer as the seed states it**, for the owner to change before a
paper's first sitting; how to swap one is at the top of
`src/scripts/diagnosticPapers.ts`. The whole-body paper is fifteen of the
area papers' questions, word for word, so the two relate.

| Paper | Muscle facts (origin / insertion / nerve / action) | Clinical | Pictures | Of which bones, landmarks, joints, ligaments |
| --- | --- | --- | --- | --- |
| Whole body | 9 | 1 functional | 5 | 1 bone, 1 landmark, 1 joint, 2 ligaments |
| Shoulder | 7 | 1 functional, 1 injury vignette | 6 | 3 landmarks, 2 ligaments, 1 muscle |
| Elbow | 4 | 2 injury vignettes | 9 | 6 landmarks, 3 ligaments |
| Wrist & hand | 8 | — | 7 | 1 bone, 2 landmarks, 2 joints, 1 ligament, 1 muscle |
| Hip | 8 | — | 7 | 4 landmarks, 2 ligaments, 1 muscle |
| Knee | 7 | — | 8 | 3 landmarks, 4 ligaments, 1 muscle |
| Ankle & foot | 7 | — | 8 | 1 bone, 3 landmarks, 1 joint, 2 ligaments, 1 muscle |
| Cervical spine | 5 | — | 10 | 2 bones, 3 landmarks, 2 joints, 2 ligaments, 1 muscle |
| Thoracic spine | 5 | — | 10 | 4 landmarks, 2 joints, 3 ligaments, 1 muscle |
| Lumbar spine | 5 | — | 10 | 6 landmarks, 3 ligaments, 1 muscle |

**What could not be filled well, and why.**

- **A picture's choices are always the same kind of thing as the answer**
  (a bone among three ligaments is not a choice). So a kind with fewer than
  four members in an area cannot be asked by picture there: **bones** in the
  shoulder, elbow, hip, knee, thoracic and lumbar spine (two or three each),
  and **joints** in the shoulder, elbow, hip, knee and lumbar spine. The
  shoulder and elbow papers ask their joints by clinical vignette instead;
  the hip, knee and lumbar papers have no joint question, and six papers
  have no bone question.
- **The clinical layer exists only for the shoulder and elbow**, so only
  those two papers (and the whole-body one) have a functional or injury
  question.
- **The three spine papers are ten pictures in fifteen.** Their muscles are
  mostly the deep back muscles the three areas share, with vague or
  near-identical facts ("Dorsal rami of spinal nerves"); the clean fact
  questions there are few.
- **The elbow has 22 structures and four askable muscles**: nine of its
  fifteen are pictures, two are vignettes about its two joints with the same
  four choices.
- Only reviewed data is used: no structure on any paper is flagged
  `needsReview`, and blood supply is not asked.

**Versions.** The papers are version 3 (`DIAGNOSTIC_VERSION`), and a sitting
stores which paper it was (`paperId`) beside the version and the ids of the
questions asked. **A published paper is never edited.**
`papers.v3.lock.json` holds a fingerprint of every question as first built,
and `diagnosticPapers.test.ts` fails — printing which question, and that a
new version must be cut — if a structure is renamed or removed, or a fact a
question prints (right or wrong) is corrected. `npm run papers:check` says
the same from the command line.

**The follow-up is always the baseline's paper**, whatever the student holds
by then. Whether it can be built is a separate question, and the answer is
the facts in hand: always, in a bundled build; in a server build, only if
the account still holds what the paper is built from.

| Between sittings | `bundled` | `server` |
| --- | --- | --- |
| Nothing changed | the same fifteen | the same fifteen |
| A free student used their one change of free area (knee then, hip now) | sits the knee paper again: the facts are in the bundle | **cannot be set up**: "It repeats the questions you sat when you joined, which were about the knee, and this account does not have that area now." Nothing stored |
| A free student subscribed, or joined a licensed class | still their area paper, not the whole-body one | the same |
| A subscriber lapsed to free | sits the whole-body paper again | **cannot be set up**: "…drawn from every area, and this account does not have every area." |
| A version-1 baseline from the live site (a class's own drawn paper) | that class's fifteen, rebuilt from the stored ids, stamped version 1 | the same for an account holding every area; otherwise cannot be set up, as before |
| A baseline of a version this build does not have (version 2) | nothing is asked | nothing is asked |

**The card is only offered when the paper can be sat.** The account screen
used to offer "Take the follow-up" to a student whose follow-up could never
be set up, on every visit. It now asks both questions — is a sitting due,
and can its paper be built on this device — and shows nothing otherwise.

**Two papers are never one figure.** `pairDiagnostics` pairs only sittings
of the same version, paper and questions. `scripts/cohortReport.ts` reports
each paper on its own ("3 students sat the knee paper, 1 sat the whole-body
paper"), prints no figure for the class as a whole, and asks `MIN_PAIRED` of
each paper separately. docs/CLAIMS.md says what follows: **a quotable figure
needs one paper, which in practice means a licensed class**, where everyone
sits the whole-body paper.

**What students are told.** The baseline card said the course leader sees
"only whether the class as a whole moved". No educator screen shows that; a
sitting is stored under the student, where the rules give a class owner no
read, and the only thing that adds a class up is the report script. The card
now says what happens: "your course leader never sees your score. We work
out one overall figure for the class from the students who sit it twice, and
only that figure may be shared with your course leader."

**What was given up.** A free student is measured on one area, not the whole
body, so an unlicensed class is as many small groups as its students chose
areas. And each paper is fixed: every class that sits it sits the same
fifteen until it is replaced by a new version.

### Decision 8: resolved — an educator holds every area

**Owner, 6 Oct 2026 (night): educator features need full access.** Creating
a class, and the educator screens, need the educator's own account to hold a
subscription that has started and not run out (the days of grace included),
a complimentary or institutional grant, or admin — in `firestore.rules`, not
only in the app (`mayTeach`, `mayRunCohort`; `educator/lib/teachingAccess.ts`).
An educator therefore holds every area, the facts of every area are on their
device, and the assignment form counts real questions: seen in a browser, a
paid educator in a server build holds nine areas and the form does not say
"up to N".

**The "up to N questions" fallback is kept**, because it is still reachable:
when the educator's device does not have an area's facts at that moment
(offline, a lease that ran out), and for the one educator who does not hold
every area — the owner of a class that is itself licensed, whose own account
has no entitlement (below). It is no longer the normal case.

**Chosen: a licensed class carries its owner, for that class.** The licence
is granted to the class by the owner of LocusMSK, through the admin script,
for exactly that teaching. So while it runs, the class's owner may see its
screens, set work and invite even with no entitlement of their own. It does
not let them create another class (the rules cannot ask "does this account
own some licensed class" without a query, and a new class has no licence
yet). A **member** of a licensed class holds every area as a student and is
not thereby an educator.

**An educator whose access lapses keeps everything.** The rules still let
them read their classes, students, figures, assignments and invitations, and
delete any of them; students stay members and can still join and leave. In
place of the screens they see "Teaching tools need full access", which says
first that their classes are kept and their students are still in them.

**Where the rules read the entitlement differently from the app** (all on
the strict side, and noted in the rules file): dates are ISO strings, which
rules cannot parse, so they are read from their first nineteen characters as
UTC (ten for a date alone); a date that cannot be read **refuses** there and
reads as "not expired" in the app; only a single entitlement map is read,
where the app also accepts a list (nothing writes one).

### Decision 9, changed: a guest is not an account

**Owner, 6 Oct 2026 (night): the free area needs a real account.** The
default taken was "a guest is an account and is served its free area". A
guest — the anonymous sign-in every visitor gets — could pick a free area
with no sign-up, and nine wiped browsers were nine areas.

| Who | What they can reach |
| --- | --- |
| A guest | The landing page, the prices, the legal and sources pages, the comparison page, onboarding, and their own account screen (their numbers, appearance, the way to an account). **Not** Today, Study, a session, the Atlas, a structure's card, Progress, the diagnostic or achievements. They cannot join or create a class |
| An account that has not chosen its free area | Asked to choose before anything else. No default: it used to be the shoulder |
| An account | As before |

The Atlas was considered as something a guest might browse by name. It lists
entitled structures with their facts and is where drills start, so a
names-only version would be a second screen to build; a guest is shown the
way to an account there too.

- **Rules.** `users/{uid}.freeArea` may be created or changed only by a
  token whose `firebase.sign_in_provider` is not `anonymous`. A write that
  leaves it unchanged still goes through, so a guest holding one from before
  keeps it and their other writes are not refused. Linking a sign-in keeps
  the uid, so the same document can be chosen for from that moment.
- **Function.** A guest's token is answered 403 for every area, before
  anything is read about them, whatever their document holds. And there is
  no default area: not chosen is not served.
- **App.** `useEntitlement` is told when it is reading for a guest and
  answers "no area". The gate is one wrapper in `App.tsx` round every route
  that revises (`Auth/AccountGate.tsx`).
- **Joining a class** is closed to a guest by the app only (the account
  screen offers a guest the account, not the join-code field). The rules
  still accept a guest's join: the live bundle lets guests join, and an
  installed copy must go on working. A guest who joined before stays a
  member; their class's licence opens nothing until they have an account.
- **Bundled mode.** The same gate, but there it is the app declining to show
  facts that are in the downloaded files. Server mode is where it is
  enforced.
- **Builds with no accounts** (`VITE_PERSISTENCE=local`: the demo, a dev
  server with no Firebase project) are unchanged: nobody is a guest there,
  and the free area still defaults to the shoulder.

**New visitor.** Landing → Start free → create account (email and password,
or Google, with the age and terms tick) → pick your free area → how it works
(two short steps) → Today. Four steps where there were three. Someone who
signs in at step one to an account that is already set up goes straight in.

**Existing guests lose nothing.** On their next load they see "Create a free
account to keep going — Your progress and your free area come with you."
Creating the account **links** it to the guest they already are: same uid,
so everything stored under it is theirs, and the free area kept on their
device is moved up to the account at that moment. Seen in a browser against
the emulators with a guest seeded the way the live site stores one (an
anonymous account, the choice on the device only, progress in Firestore):
after creating the account, the same uid, the area on the account, six
mastery rows, twelve answers and 180 XP all intact, and one fetch of their
area. **Offline**, the gate opens (from the service worker's cache) and says
"You are offline. Creating an account needs a connection. Everything you
have done is still on this device"; the account screen still opens; nothing
revises until they are back online and have an account.

**Email was not verified when this was written. It is now** (owner, 7 Oct
2026): a free account confirms its address before its free area. See "Two
owner decisions, 7 Oct 2026".

**What decision 11 costs.** Two of the demo's three set assignments are on
the shoulder and the ankle & foot. Built from the fixture, a visitor who
tries to sit those is told the area is not part of the demo. `hip` +
`shoulder` is the pair to pick if that matters more than dashboard density.
The demo's default is still `bundled`.

## Rollout — recommended order

Nothing below has been done. Each step is safe on its own and can stop there.

*7 Oct 2026: the order stands, and each step now also carries the
confirmed-address rule. What that adds to each step, the things to do in the
Firebase console first, and the way back from each, are in "Two owner
decisions, 7 Oct 2026" under "Before you deploy" and "Rollout, as it now
stands". The rules are now stricter than production's in four places, not
two; the table below was measured before that and is still true of what it
lists.*

**The rules on this branch are stricter than production's in two places**: a
guest may not hold a free area, and creating a class needs full access. Rules
deploy in an instant; the app does not — an installed copy keeps the bundle
it has until the student accepts the update prompt (`registerType:
'prompt'`), which can be days. So for days **the old bundle talks to the new
rules**. What that does to each kind of person was tested by replaying the
writes the live code makes (`581dfe1`, what production served on 6 Oct)
against these rules in the emulator (`rules-tests/oldClient.rules.test.ts`,
nine tests):

| On the OLD bundle, once these rules are deployed | What they experience |
| --- | --- |
| An existing guest | **Nothing changes.** They can still study: the live bundle carries every fact and never asks a server. Every write it makes is accepted: the profile write on each load, each answer, the question counter, mastery, the session summary, XP, achievements. They can still join a class by its code, write the class counters, sit a baseline and leave. Nothing errors |
| A guest who creates an account from the old screen | Carries on as that account; every write accepted |
| A signed-in student | Nothing changes, in or out of a class; can still delete their account |
| A paying educator | Nothing changes: creates classes, sets work, invites |
| A **free** account that tries to create a class | **Refused, which is the rule.** The old screen tries eight join codes, is refused eight times and says "Could not allocate a join code. Please try again." Nothing is half-written. The owner says no class is owned by a free account, so this is someone trying for the first time |

**Why nothing breaks for guests:** the live client keeps the free area on
the device and **never writes `users/{uid}.freeArea`**, so the one guest
write the new rules refuse is one it does not make. (Shown refused in the
same test file, so that sentence has something under it.) The only clients
that ever wrote a guest's free area were test visitors to this branch's
earlier draft; such a guest keeps what was stored and simply cannot change
it.

So **rules first is still the right order**, and no tolerant transition rule
is needed. The other order also works — the new app never writes a free area
for a guest and shows the panel in place of the class form whatever the
rules say — but it leaves both rules unenforced in the meantime.

Each step has its own way back: step 1, redeploy the previous
`firestore.rules` (`git show 581dfe1:firestore.rules`) — free areas already
written stay on the accounts and are simply no longer policed, and nothing
written under the new rules is invalid under the old; step 2, publish the
previous deploy from Netlify's deploy list (the content function goes with
it; nothing calls it) — an existing guest who created an account stays one,
which the old bundle handles as it always did; step 3 is a draft and is
deleted or ignored; step 5, unset the variable and redeploy, or publish the
previous deploy.

0. **Before step 1, one check.** `npx tsx scripts/cohortReport.ts` (no
   argument) now prints, for every class, whether its owner has full access.
   The owner says none is owned by a free account; this is the run that
   confirms it. For any line reading `OWNER HAS NO FULL ACCESS`, grant that
   account access (`accountData.ts grant`) or licence the class before
   deploying, or its owner meets the panel.
1. **Rules.** `npm run deploy:rules`. Safe for every installed copy, as
   above. From this moment: no guest can be given a free area, by any
   client; only an account with full access can create a class.
2. **Client and functions, still `bundled`.** Deploy this branch as it is.
   What people notice, as each accepts the update:
   - **A new visitor** creates a free account before anything else.
   - **An existing guest** sees "Create a free account to keep going"; their
     progress and their free area come with them.
   - **A free student with an account** has their free area moved to their
     account on first load, and the thirty-day clock restarts that day. One
     who never chose (they skipped, and were given the shoulder) is asked to
     choose.
   - **A paying student** notices nothing.
   - **An educator** with full access notices nothing; one without sees the
     panel.
   - **A class mid-diagnostic** carries on: version-1 follow-ups are as they
     were, and new baselines are the new papers.

   The content function is live and unused. Watch `billingFailures` and the
   function log for a day; confirm the three billing functions answer as
   before.
3. **Test `server` on a draft.** Build with `VITE_CONTENT_SOURCE=server` and
   deploy without `--prod`. A draft shares production's Firebase and
   functions environment, so sign in with a real free account and a real
   paid one: free sees one area; paid sees nine; a guest is refused;
   offline reload works; `/structure/<locked>` shows the lock. Check the
   function log lines.
4. **Decide what is left of the eleven**: 1 to 6 and 11 are defaults still
   unconfirmed. 7, 8, 9 and 10 are the owner's.
5. **Switch.** Set `VITE_CONTENT_SOURCE=server` in Netlify and redeploy.
   Existing installs keep the old bundle until they accept the update
   prompt, so the two modes coexist for days; both work.
6. **Rollback** is unsetting the variable and redeploying. The seed is still
   in the repository and a bundled build is the default. Device copies become
   unused, not harmful.
7. **The demo** (`build:demo`) separately: `VITE_CONTENT_SOURCE=fixture` on
   the demo site once decision 11 is made. (With the fixture the demo's
   educator holds two areas, so the whole-body diagnostic cannot be built
   there; the demo has no class to sit one in.)

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
11. **Whoever signs in on a device inherited that device's free-area copy**
    if their own account had none. Fixed (6 Oct, night) for copies written
    from now on, which carry their owner's uid. What is left: a copy the
    live bundle wrote has no owner, and goes to whoever is signed in on that
    device the first time this build looks.
12. **Someone offline at the first load after the switch has no facts**: none
    were ever saved on the device, because a bundled build saves none. They
    see the names, the pictures and "connect to load this area" until they
    are next online. Measured; see below.
13. **An educator whose subscription lapses loses the teaching tools the
    same moment as the areas** — at the renewal instant too (risk 3): until
    the webhook lands they see "Teaching tools need full access" and cannot
    set work. Their classes and students are untouched, and it clears when
    the entitlement does. The three days of grace cover a failed payment.
14. **A free student who was mid-diagnostic and changes their free area**
    cannot sit their follow-up once facts are fetched per area, and is left
    out of the class figure. They are told why.
15. **Existing guests must create an account to carry on.** Nothing of
    theirs is lost and the uid is kept, but it is a step some will not take.
    How many guests there are is not something this branch can count.
    (`npm run admin:verification-report` now counts them.)
16. **An existing guest now has two steps, not one**: the account, then the
    email. Their progress and their area wait for them through both, but
    some will stop at the inbox. (7 Oct.)
17. **The confirmation email is Firebase's**, sent from Firebase's address
    unless a sender is set up in the console. An email that lands in junk is
    a student who cannot start. See "Before you deploy".
18. **A paying student is never asked to confirm**, by design — until their
    subscription ends, when they are a free account like any other and meet
    "Check your inbox" before their free area, unless their profile is from
    before the rule. A lapsed subscriber may read that as a second thing
    going wrong on the same day.
19. **An existing email-and-password account whose profile has no
    `createdAt`** cannot be recognised as "here before the rule" and is
    asked to confirm on its first load. The live app has always stamped that
    field; whether every one of the 372 profiles carries it can only be
    counted against production (`npm run admin:verification-report`).

## What this still does not stop

- **Nine free accounts are nine areas — if they are nine addresses that
  really receive email.** A guest can no longer hold one (6 Oct, night), and
  an account must now have confirmed its address (7 Oct). So the bar is
  "someone prepared to set up nine working mailboxes" (or nine Google
  accounts, or one mailbox with nine aliases: `name+1@`, `name+2@` are
  different addresses to Firebase), not "someone who paid for at least a
  month" — and delete-and-recreate still gives a confirmed account a fresh
  choice. Raising it further means App Check on the function or a per-IP
  limit. Neither is built.
- **The accounts that were here before the rule** each keep one free area
  without confirming. That is the choice they already had; the set cannot
  grow (see "Two owner decisions, 7 Oct 2026").
- A paying account saving its own areas; content already on a device; the
  public pictures and hotspot polygons.
- The index gives away each structure's name, areas, relations (`jointId`,
  `parentBoneId`) and which kinds of fact it has.
- The diagnostic's papers give away which fifteen structures each asks
  about and in which way, and no fact (decision 7).
- In a `bundled` build, everything: the guest gate and the paywall are the
  app declining to show what is in the downloaded files.

## Verified on 6 Oct 2026

*Superseded in part that night: a guest is now refused every area, an
account that has not chosen is served none, and the diagnostic is ten
papers. What follows is what was measured at the time.*

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

*The fixed public paper described here (version 2) was replaced the same
night and never released; see decision 7. Defects 3 and 4 stand.*

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

## Three owner decisions, 6 Oct 2026 (night)

Built on top of the evening's pass: papers by access (decision 7), a real
account for the free area (decision 9), full access for teaching (decision
8). Emulators only; nothing deployed to production; no rules deployed.

**Checks.** `vitest`: 2,232 passed, 1 skipped (the question dump),
166 files — the evening had 2,035. `test:rules`: 101 passed, in
two files — the evening had 63. `tsc` on the app and the functions: clean.
`eslint` on the files touched: no errors (three fast-refresh warnings).
`validate-content`: 0 errors. `npm run papers:check`: 10 papers, 150
questions, all as published. `check:bundle` on a `server` build: 70
files read, 462 descriptions looked for, none found — **with no exception
for the diagnostic**. The question dump is still `629965d3…9a06bb`: ordinary
sessions and the version-1 draw are byte-identical to `581dfe1`.

**Sizes.** Entry chunk, limit 2,097,152 B: `bundled` with production's
`.env` 2,000,555 B (96,597 B under; the evening was
1,982,439), `server` 1,779,830 B, `build:demo` 1,407,741 B. The
papers are their own chunk (30,943 B), and so is the screen a guest
sees (2,480 B); neither is in the entry chunk.

**The function, over real HTTP with emulator-minted tokens** (the evening's
matrix with these rows changed or added; 54 rows, the same ten "failures" as
before, all of them the script's own: nine payload checks that read a field
the index does not have, verified separately as identical to the generated
files, and the in-memory refusal count, which `netlify dev` resets on every
call):

| Caller | Answer |
| --- | --- |
| A guest with no profile | 403, every area |
| A guest with a profile and no free area | 403, every area |
| A guest whose document holds a free area from before | 403, every area, that one included |
| A guest who joined a licensed class before | 403, every area |
| A guest whose document holds an entitlement | 403, every area |
| That guest after creating an account (linked, same uid) | their free area 200, the other eight 403 |
| An account that has not chosen its free area | 403, every area (no default) |
| An account with no profile document | 403, every area |
| A guest asking 31 times in a row | 403 each time; nothing read, nothing counted on their document |
| Every other row | as the evening measured |

**The rules, in the emulator** (`rules-tests/`): a guest refused a free area
on a new profile, on an existing one, and the change; a guest's stored
choice and other writes left alone; the same uid allowed once linked; Google
and other providers counted as accounts. Creating a class: free refused
(no entitlement, a stored free tier, no profile, a guest); paid allowed;
expired refused; the days of grace allowed and refused once over;
complimentary and institutional allowed; a delayed start refused until it
begins; refunded refused; cancelled allowed until the paid time ends; admin
allowed by claim and by role document; a member of a licensed class refused;
a date with no time read as the start of that day; an unreadable date
refused. A lapsed educator: reads everything, may delete, cannot create,
set, invite, rename or archive; students' membership and writes untouched;
the owner of a licensed class may run it and not start another. And the nine
replays of the live bundle's writes (see "Rollout").

**In a browser** (Chromium, a fresh profile each time, no reload first, 1280
px and 390 px, the Firestore and Auth emulators), on a `server` build and
again on a `bundled` one:

- *A new visitor.* Lands on "Create your free account", step one of four,
  with no Skip. As a guest, every address that revises (`/`, `/study`,
  `/study/setup`, `/session`, `/atlas`, `/structure/…`, `/progress`,
  `/diagnostic`, `/achievements`) returns them there with no fact on screen;
  the app asks the server for nothing; asked directly with the guest's
  token, the function answers 403. The prices stay open. A refused sign-up
  is said in the alert region and the form stays. Account made: the same
  uid, "Pick your free area", no Skip, the button waits. Picks the knee,
  reads the two notes, starts: on the account `freeArea` is the knee, unused,
  and the profile is an account. **Exactly one area is fetched — the knee —
  and no default** (the evening's "a brand-new guest is sent two areas" is
  gone). A knee card shows its facts; the first session starts.
- *An existing guest*, seeded the way the live site stores one (an anonymous
  account; the free area on the device only, with no owner; six mastery
  rows, twelve answers, a session, 180 XP). Next load: "Create a free
  account to keep going", "Your progress and your free area come with you.
  Your free area is Knee." Every address that revises shows it; nothing is
  asked of the server; nothing is written for them. The account screen shows
  their twelve answers and the way to an account, and no class field,
  subscription block or downloads. They create the account **with no
  reload**: the gate is gone, the same uid, the knee on the account as an
  unused first pick, the profile an account, all six mastery rows, twelve
  answers and 180 XP still there, one fetch of the knee, Progress showing
  their work.
- *An offline guest.* The gate opens from the cache and says an account
  needs a connection and that nothing on the device is lost; trying anyway
  is answered "You seem to be offline…"; the account screen opens; nothing
  thrown.
- *A free account tries to create a class.* The account screen's Teaching
  block and `/educator` and `/educator/new` all show "Teaching tools need
  full access" with the way to the plans; no class is created.
- *A class.* An account made a subscriber in the emulator signs in at step
  one and goes straight in, holding nine areas; creates a class; the
  assignment form counts real questions (no "up to N"). A free student
  (new visitor → account → knee) joins by the code, is offered the baseline
  with the new copy, and sits **the knee paper** end to end: fifteen
  questions, four different choices each, eight pictures drawn, no area
  asked for during the sitting, and the words and the order of the choices
  on screen exactly the paper built from the seed; stored as version 3,
  paper `knee`. A paid student sits **the whole-body paper** the same way;
  stored as paper `whole-body`.
- *Follow-ups*, with `takenAt` moved back 75 days: each asked exactly what
  its baseline asked and is stored on the same paper; nothing is offered
  after. A subscriber whose access lapsed in between is not offered the
  whole-body follow-up in a server build, and its address says why; in a
  bundled build it is offered. A free student whose area changed (knee →
  hip) is not offered the knee follow-up in a server build, its address
  says "…which were about the knee, and this account does not have that
  area now", and nothing is stored; in a bundled build they sit the knee
  paper. A free student who has since subscribed sits the knee paper, not
  the whole-body one.
- *The educator's access lapses.* `/educator`, the class, its students, its
  assignments and `/educator/new` all show the panel with "Your class, …, is
  kept exactly as it is, and your students are still in it"; the account
  screen still lists the class; the four members and the class document are
  untouched.
- *The class report*, the real `scripts/cohortReport.ts` run against the
  emulator: "3 students sat the knee paper, 1 sat the whole-body paper.
  These are different tests. Each is reported on its own below; no figure
  covers the class as a whole." and then each paper with its own counts and
  its own "NOT QUOTABLE: under 8 students sat this paper twice".

All twelve runs (three journeys, two widths, two builds) were repeated on
the last commit. No console errors beyond the refusals the scripts
themselves asked for, with one exception: in both runs of the class journey
on the bundled build the Firestore emulator answered one `Listen/channel`
request with 400, once on the paid student's screen and once on the
educator's. Nothing on screen or in the stored data was affected, and the
same journey on the server build was clean. It is recorded as unexplained
rather than dismissed: it was not chased further.

*Not browser-tested:* Google sign-in (the emulator has no popup;
unit-tested); iOS Safari and an installed PWA; a real update prompt from the
live bundle to this one; a follow-up to a version-1 baseline (unit-tested);
"no focus on first load" under a real pointer (Playwright counts a scripted
load as untouched, which is the case that was checked).

**Found and fixed on the way** (all in the night's commits):

1. A guest who creates an account keeps their uid, and the entitlement hook
   called that account "already read". For a moment it reported a settled
   answer holding an area the account did not yet have on the server, and
   the area was fetched twice.
2. Headings took focus as their screen opened, drawing a focus ring on a
   first load. The app's route-focus hook did the same on the redirect a new
   visitor gets to onboarding; that is fixed with it.
3. Onboarding saved the chosen areas through a filter of the areas held
   before the choice (paywall trace finding 14).
4. `lastActiveAt` is a Firestore timestamp and was read as a string: the
   class report counted nobody as active, and the educator's student list
   could not print the date.
5. Creating a class told a refused account "Could not allocate a join code.
   Please try again."

**The two "defect 5" items of the evening, re-evaluated.**

- *"A brand-new guest is sent two areas"*: gone. A guest is sent none, and
  an account that has not chosen is sent none; a new student's device
  fetches one area, the one they pick (seen in the browser).
- *"An account with no free area inherits the device's stored choice on a
  shared computer"*: fixed for every copy written from now on, which
  carries the uid it was written for; a different account does not see it.
  **What remains:** a copy written by the live bundle has no owner, and is
  taken to belong to whoever is signed in on that device the first time
  this build looks. That is right for the person who has been using the
  device, and wrong only if somebody else signs in on it first after the
  update.

**The draft** was redeployed from this state in `bundled` mode (never to
production): `https://content-server--mskanatomyrevision.netlify.app`, entry
`assets/index-DlKKpuSG.js`. `paddle-portal` 405, `paddle-webhook` 405,
`renewal-reminders` 403, `content-area` with no token 401.
Production served `assets/index-BCjoSWbO.js` before and after. **The draft
shares production's Firebase project and production's rules, which are the
OLD rules:** on the draft the app's own gates apply (a guest is asked for an
account, a free account sees the teaching panel), but nothing is enforced by
the database until step 1 of the rollout.

**Left open by this.**

- The 150 questions are the owner's to review (docs/DIAGNOSTIC-PAPERS.md)
  before the first sitting of each paper. After that, only as a new version.
  *(7 Oct: approved, on condition that they match the Atlas; they do.)*
- Email is not verified (decision 9). *(7 Oct: it now is.)*
- A free student in an unlicensed class is measured on one area, and such a
  class is unlikely to reach a quotable figure on any paper (docs/CLAIMS.md).
- /privacy still does not mention the diagnostic, and students are not told
  class-level figures may be reported outside their course (docs/CLAIMS.md);
  both are needed before a pilot's first baseline.
- Today has no heading, so after a guest creates an account focus goes to
  the page's main region rather than to a title.
- The owner of a licensed class with no entitlement of their own can run
  that class but not create another, and the app reads "see the plans" to
  them at `/educator/new`. If that case is real, grant the account access.

## Two owner decisions, 7 Oct 2026

Built on top of the night's pass, through the evening of 7 Oct and into the
early hours of the 8th: the papers checked against the Atlas, and a
confirmed email address before the free area. Emulators only. Nothing was
deployed to production, no rules were deployed, nothing was changed in the
Firebase console, and **no email was sent to anyone**: the Auth emulator
lists the links it would have sent, and the tests follow those.

### 1. "Approved, provided they are all the same as the answers in the Atlas"

**They are, and a test now holds them to it.** All 150 questions were built
by the real builder twice — from a bundled build's facts, and from what a
server build is sent for that paper's area — and the answer each marks
correct was set beside what the Atlas shows for that structure and fact: the
Atlas table's column (`lib/atlasFacts.ts atlasRow`) and the structure's card
as it renders, desktop and phone.

| | Questions | Result |
| --- | --- | --- |
| Origin, insertion, action | 49 | all word for word what the Atlas table and the card show |
| Nerve | 16 | 15 word for word. **1 differed in punctuation**: sternocleidomastoid (cervical spine, question 1). The paper, like every ordinary question, reads "Spinal accessory nerve (CN XI); C2–C3 (sensory)"; the card joined the two with a comma. **Fixed on the card**, which now joins nerves the way it always joined origins and insertions |
| Functional role | 2 (one fact: latissimus dorsi, whole body 1 and shoulder 8) | **The Atlas showed nothing to compare with.** The paper marks "Powerful shoulder extension and adduction, e.g. a pull-up, swimming's freestyle pull, or climbing." and no card printed that line. **The cards now print it**, as "Functional role", for the sixteen structures that have one (ten muscles and six joints of the shoulder and elbow) |
| Name the picture | 80 | the right answer is the structure's name, which is the card's heading. Every picture is one of that structure's own, linked to it, with the structure picked out (drawn in colour on 44, outlined by the app on 36). 79 show the same picture as the card; **1 shows a different picture of the same structure**: the costovertebral joint (thoracic spine, question 11) is asked on its joint plate, a close view of the ribcage that the student can turn, where the card shows the older three-view panel |
| Injury vignette | 3 | the right answer is the structure's name. The vignette's own sentence (the prompt) is not shown anywhere in the Atlas; that was not part of the condition, and is said here so that it is known |

No paper and no fact changed. The lock is byte-identical, `papers:check`
passes, and docs/DIAGNOSTIC-PAPERS.md was regenerated only to say the test
exists. The test is `components/__tests__/diagnosticPapersAtlas.test.tsx`;
it prints the paper, the question and both wordings when they differ, and
was seen to fail that way when the card's comma was put back.

**The odd extra clause on some action answers is in the data, and the Atlas
shows the same sentence.** Hip 2 (gluteus medius, "…; arises from the outer
surface of the ilium…"), knee 7 (semitendinosus, "…; inserts on the proximal
medial surface of the tibia (pes anserinus).") and thoracic 6 (spinalis, "…;
inserts on the spinous processes of upper thoracic & cervical vertebrae.")
are `actionText` in the seed, and the card and the Atlas table print
`actionText`. So the paper matches the Atlas and the condition is met.

Where the clause comes from: `scripts/deriveActionText.mjs` (commit
`fb01b58`, "Cut the muscle dataset free of the lecture deck", refined in
`d80ab98`). Every action sentence was rebuilt from the muscle's own action
tags, and where two muscles have the same tags the script appends one of the
muscle's own attachments **on purpose**, so that the two sentences differ and
"what is the action of X?" does not offer the same answer twice. **50 of the
122 muscles carry such a clause** (a 51st, vastus lateralis, has a
hand-written one: "…arising from the lateral femur"). In all 50 the clause is
a copy of the first entry of that muscle's own `origin` or `insertion`.

**It was not removed**, because it is not an error to be removed: take it
away and the muscles below are left with identical action sentences in pairs
and fours, and choosing what should tell them apart instead is anatomy for
the owner, not for this pass. Several read badly and are worth the owner's
eye whatever is decided: "arises from the superior: ischial spine" (the
gemelli, where the head's label was copied with it), "inserts on the ribs
10–12" and "inserts on the digits 2–4" (a stray "the"), "Extends the toes;
inserts on the proximal phalanx of digit 1" (extensor hallucis brevis extends
the big toe, which the tag cannot say), and longissimus's "inserts on the
ribs" (the first of three insertions).

| Without the clause, this sentence would be shared by | Muscles (each followed by what was appended) |
| --- | --- |
| Extends the hip; flexes and internally rotates the knee. | Semitendinosus (inserts on the proximal medial surface of the tibia (pes anserinus)); Semimembranosus (inserts on the medial condyle of the tibia) |
| Abducts and internally rotates the hip; stabilises the pelvis. | Gluteus Medius (arises from the outer surface of the ilium (between the anterior and posterior gluteal lines)); Gluteus Minimus (arises from the outer surface of the ilium, just below the gluteus medius) |
| Adducts and flexes the hip. | Adductor Longus (arises from the pubis near the symphysis); Adductor Brevis (arises from the body of the pubis) |
| Externally rotates and stabilises the hip. | Piriformis (arises from the sacrum); Gemelli (arises from the superior: ischial spine); Obturator Internus (arises from the obturator membrane); Quadratus Femoris (arises from the ischial tuberosity) |
| Extends the knee. | Vastus Intermedius (arises from the anterior and lateral surfaces of the femur) — against the two hand-written vasti |
| Externally rotates the shoulder and stabilises the glenohumeral joint. | Infraspinatus (arises from the infraspinous fossa of scapula); Teres Minor (arises from the lateral border of scapula) |
| Retracts and downwardly rotates the scapula. | Rhomboid Minor (inserts on the medial border of scapula (at level of the spine)); Rhomboid Major (inserts on the medial border of scapula, below the spine) |
| Adducts, internally rotates and extends the shoulder (the same three actions in another order). | Teres Major (inserts on the medial lip of intertubercular sulcus of humerus); Latissimus Dorsi (inserts on the floor of intertubercular sulcus of humerus) |
| Laterally flexes the neck and assists inspiration. | Scalene Anterior (arises from the transverse processes C3–C6); Scalene Middle (… C2–C7); Scalene Posterior (… C4–C6) |
| Extends, rotates and laterally flexes the neck. | Splenius Capitis (inserts on the mastoid process); Splenius Cervicis (inserts on the transverse processes C1–C3) |
| Extends the spine and laterally flexes the trunk. | Iliocostalis (inserts on the angles of ribs); Longissimus (inserts on the ribs) |
| Extends the spine. | Spinalis (inserts on the spinous processes of upper thoracic & cervical vertebrae); Interspinales (inserts on the adjacent spinous processes) |
| Rotates and laterally flexes the trunk; stabilises the core. | External Oblique (inserts on the linea alba); Internal Oblique (inserts on the ribs 10–12) |
| Extends the toes and dorsiflexes the ankle. | Extensor Hallucis Longus (inserts on the base of distal phalanx of big toe); Extensor Digitorum Longus (inserts on the distal phalanges of toes 2–5) |
| Everts the foot and plantarflexes the ankle. | Peroneus Longus (inserts on the medial cuneiform) — against the hand-written peroneus brevis |
| Extends the toes. | Extensor Digitorum Brevis (inserts on the digits 2–4); Extensor Hallucis Brevis (inserts on the proximal phalanx of digit 1) |
| Flexes the toes. | Flexor Digitorum Brevis (inserts on the middle phalanges of toes 2–5); Flexor Hallucis Brevis (inserts on the medial and lateral sides of the base of the proximal phalanx of the big toe); Flexor Digiti Minimi Brevis, foot (inserts on the base of proximal phalanx of 5th toe); Opponens Digiti Minimi, foot (inserts on the lateral part of 5th metatarsal) |
| Abducts and flexes the toes. | Abductor Hallucis (inserts on the medial side of base of proximal phalanx of big toe); Abductor Digiti Minimi, foot (inserts on the lateral side of base of proximal phalanx of 5th toe) |
| Flexes the thumb. | Flexor Pollicis Longus (inserts on the distal phalanx of the thumb); Flexor Pollicis Brevis (inserts on the base of proximal phalanx of thumb) |
| Extends and radially deviates the wrist. | Extensor Carpi Radialis Longus (inserts on the base of 2nd metacarpal); Extensor Carpi Radialis Brevis (inserts on the base of 3rd metacarpal) |
| Extends the fingers. | Extensor Digitorum (inserts on the extensor expansions of digits 2–5); Extensor Digiti Minimi (inserts on the extensor expansion of digit 5); Extensor Indicis (inserts on the extensor expansion of digit 2) |
| Extends the thumb. | Extensor Pollicis Brevis (inserts on the base of proximal phalanx of thumb); Extensor Pollicis Longus (inserts on the base of distal phalanx of thumb) |
| Abducts the fingers. | Abductor Digiti Minimi, hand (inserts on the proximal phalanx of digit 5); Dorsal Interossei, hand (inserts on the extensor expansions of digits 2–4) |

Three of the 150 marked answers carry one (the three above). If the owner
rewrites any of these sentences, the papers have not been sat, so the lock is
published again (`npm run papers:publish -- --force`) rather than a new
version cut; the Atlas test then passes by itself, because the card prints
the same field.

### 2. A confirmed email address before the free area

**Owner, 7 Oct 2026: a real, confirmed email is needed before a student can
pick a free area, open facts or start a session.** Nine made-up addresses
were nine free areas.

**The rule** (`lib/emailVerification.ts`, which the rules, the function and
the app each apply):

1. **Full access is never held back by it.** A subscriber, a complimentary or
   institutional account, a member of a licensed class: served and shown
   everything they hold, confirmed or not. Confirmation gates the free area
   and nothing else.
2. An account that has not confirmed may not **choose** a free area, may not
   **change** one, and is not **served** one —
3. — except an account that was **here before the rule**, which keeps the one
   free area it has and goes on being served it, and confirms only to change
   it.

Google's sign-in arrives confirmed and never sees the step. The app checks
`emailVerified` on the account rather than assuming it from the provider.

**Why the exception, and why it had to be built this way.** The task assumed
an existing free account's area is on its account. It is not: the live app
keeps the free area **on the device** and writes nothing about it to the
database (that is why old clients were unaffected by the last round of
rules). So for every existing free account, "keep what you have" needs a
WRITE — the new app moving the device's choice up to the account — and for
the database that is the account's first choice. A rule that simply said
"no free area without a confirmed address" would have refused it, and every
existing email-and-password student would have opened the app to "Check your
inbox" with no warning: option (b) by accident.

So the database is told who was here first. A profile's `createdAt` is the
server's time of its first write, the live app has always stamped it, and
the rules now pin it (it may be left alone or set to NOW, never to a date of
the client's choosing). A profile first written before
`VERIFICATION_STARTS` (**7 Oct 2026, 00:00 UTC**; `verificationStarts()` in
the rules, held equal by a test) may make its FIRST free-area write
unconfirmed. A change always needs a confirmed address. The function reads
the same field. Nobody can give themselves an old date after the fact, and a
profile deleted and made again is new, so the set of accounts this covers is
closed.

**Option (a) was implemented, not (b).** (a): an existing unconfirmed free
account keeps its area and is asked to confirm before it can change it. (b):
it must confirm to carry on. The owner's aim is to stop multiple free areas;
(a) meets it for existing accounts, each of which keeps exactly the one area
it had, while (b) risks losing real students mid-term to an email in a junk
folder. **What (a) gives up:** somebody who made several accounts with
made-up addresses BEFORE the rule keeps those areas. The rule cannot reach
back without (b).

**What the database cannot tell apart, and the app does instead.** A guest
whose profile is from before the rule, creating an account after it, looks
to the database like an existing account. The owner asked for such a guest
to confirm like any new sign-up. The APP does that: it is the one creating
the account, notes on the device that this account must confirm, and
withholds the free-area write until it has. A guest who went round the app
could have their one device area written unconfirmed; they get one area,
which they had as a guest before, and the set is closed. Said plainly rather
than papered over.

**When the app cannot tell** — the profile could not be read (offline) and
nothing is remembered on the device — an unconfirmed account is given the
benefit of the doubt, like every other gate here that has to choose between
locking out a student in a tunnel and showing what is in the downloaded
files anyway. The server never guesses: it reads the profile.

#### Who experiences what

The words in quotation marks are what is on screen.

| Who | What they meet |
| --- | --- |
| **A new visitor, email and password** | Landing → Start free → "Create your free account" (step one of four) → **"Check your inbox"**, still step one: "Your free area needs a confirmed email address. It takes a minute, and nothing you have done is lost." In the panel: "We sent a link to *address*. Open it to confirm your email address, then come back here." · button **"I've confirmed — continue"** · "If it does not arrive, check your spam or junk folder, resend it, or use a different address." · **"Resend the email"** · **"Use a different email"**. Nothing that revises can be reached; the function answers their token 403. They follow the link; the tab they left notices when they come back to it and moves on by itself to "Pick your free area". Five screens where there were four |
| …who presses "I've confirmed" too early | "That address is not confirmed yet. Open the link in the email we sent to *address*, then try again." |
| …who resends | "Sent again to *address*. It can take a minute or two to arrive." Inside a minute of the last one, nothing is sent: "We sent one less than a minute ago. Give it a moment to arrive, then try again." If Firebase's own limit is reached: "Too many emails have been sent to this address for now. Wait a few minutes, then try again. The last link we sent still works." |
| …who mistyped their address | "Use a different email" takes the address off the account and shows the sign-up form again. The same account (same uid) is given the new address, and a link goes to it |
| …who is offline | "You are offline. Confirming your email address needs a connection. Everything you have done is still on this device." Pressing anyway: "We could not check. You seem to be offline. Connect and try again. Nothing on this device has been lost." |
| …who opens the link on another device | Firebase's page confirms the address and offers "Continue" back to the app, where a line across the top says "Your email address is confirmed. Go back to the app or the tab where you created your account and choose "I've confirmed — continue", or sign in here." |
| **A new visitor, Google** | Straight from "Create your free account" to "Pick your free area". No email, no extra step |
| **An existing guest** (progress, a free area on the device) | As before: "Create a free account to keep going — Your progress and your free area come with you." They create it, and then: **"Check your inbox"** — "Your free area needs a confirmed email address. It takes a minute, and nothing you have done is lost. Your free area is Knee, and your progress is waiting for you." Their account screen still shows their numbers, and says "Free: confirm your email address to open your free area." They confirm, press "I've confirmed — continue", and are on Today with the same uid, the area moved up unused, and every answer intact. **Two steps where the last round asked for one** |
| **An existing free student, email and password, never confirmed** (every such account on the live site) | **Nothing is asked.** On the first load their device's free area is moved up to their account and they carry on. On the account screen, under the area: "This is your free area, and it stays yours. To change it — once, 30 days after you picked it — confirm your email address first." with **"Send me the link"** ("We will send a link to *address*…"). Where a locked area used to say when they could change, it says "— or confirm your email address, from your account, to change your free area." Asking for the link does not lock them out of anything. Once confirmed, the ordinary thirty-day rule is all that is left |
| **An existing free student with Google** | Nothing, as before |
| **A paying student** (or complimentary, or in a licensed class), confirmed or not | **Nothing. Ever.** No step, no notice on the account screen, every area served |
| **An educator** | With full access: nothing; teaching needs full access, not a confirmed address. An educator who is a free account (the owner of a licensed class) is a free student for this purpose: here before the rule, so nothing is asked |
| **A subscriber whose subscription later ends**, unconfirmed | A free account from that moment: if their profile is from before the rule, they keep one free area; if not, "Check your inbox" before it |

#### Existing accounts, first load after the update

There are 372 user documents on the live site. What each kind experiences:

| Who | `bundled`, online | `bundled`, offline | `server`, online | `server`, offline |
| --- | --- | --- | --- | --- |
| Paying, complimentary, licensed class | everything as before; never asked | as before | nine areas fetched, all 200 | names and pictures; "connect to load" (risk 12), as for anyone |
| Free, Google | area moved to the account (as the last round); never asked | as before; the move waits | one fetch, 200 | "connect to load" |
| Free, email and password, unconfirmed, profile from before the rule | area moved to the account, dated that day; never asked; "confirm to change" on the account screen | studies as before (the facts are in the bundle); the move waits for a connection | the same, then one fetch, 200 | "connect to load" |
| …the same, but the profile has no `createdAt`, or was first written on or after 7 Oct | **"Check your inbox"**; the link is emailed as the screen opens; area and progress wait, untouched | given the benefit of the doubt: studies as before, and is asked when next online | "Check your inbox"; nothing fetched; the function would answer 403 | nothing saved to show; asked when next online |
| Free, never chose (skipped, and was given the shoulder) | asked to choose (as the last round); may choose unconfirmed if here before the rule | the app's old default no longer applies: asked when online | asked to choose | asked when online |
| A guest | "Create a free account to keep going", then "Check your inbox" | the gate opens and says an account needs a connection | the same; nothing fetched | the same |

`npm run admin:verification-report` (read-only) counts each of these against
the real project, so that the fourth row is a number before it is a support
email.

#### How it is enforced

- **Rules** (`firestore.rules`). `users/{uid}.freeArea`: a first choice needs
  a real account AND (`email_verified == true` OR a profile from before the
  rule); a change needs a real account AND `email_verified == true`; a new
  profile arriving with a choice needs both outright. `createdAt` on create
  is the server's time or absent; on update it is unchanged or the server's
  time. Nothing else consults the claim: entitlements, classes, answers and
  teaching are untouched.
- **Function** (`content-area`). Google's lookup of the token's account says
  whether the address is confirmed NOW (not the token's claim, which is up
  to an hour old): a student who has just confirmed is served on the token
  they already hold, and an account whose address has since been changed is
  unconfirmed at once. An unconfirmed account asking for its free area is
  answered **403 "Confirm your email address to open your free area"**,
  unless its profile predates the rule; an account with full access is
  served everything. The decision is `areaAccess`'s, shared with the app.
- **App** (`hooks/useEntitlement.ts`). `needsEmailConfirmation`: the account
  holds no area, nothing is written for it and nothing is asked of the
  server. `switchNeedsConfirmation`: an account from before the rule may not
  change its area until confirmed.
- **The token.** The rules read `email_verified` on the ID token, which is
  minted before the link is followed. "I've confirmed — continue" reloads the
  account and replaces the token (`user.reload()`, `getIdToken(true)`) before
  any screen is told; on every load the same is done if the two disagree.

**A confirmed account whose address is later changed** is unconfirmed again:
the rules refuse it a change, and the function refuses it its area, until the
new address is confirmed. (Otherwise one real address could confirm account
after account.) Firebase also stops honouring the tokens issued before the
change. The app offers no way to change a confirmed address; this is what
happens to somebody who does it through Firebase directly.

#### The email, and the way back

Firebase sends the email (`sendEmailVerification`) and **Firebase's own page
confirms the address**: no handler page was built. The link carries a
continue address on the app's own origin, `/onboarding?emailConfirmed=1`,
which Firebase's page offers as "Continue" once the address is confirmed. If
the Firebase project does not list the app's domain as authorised, Firebase
refuses the continue address; the app then sends the email **without** it
rather than not at all, and the waiting tab still notices.

"Use a different email" **takes the email sign-in off the account**
(`unlink`), leaving the same uid with everything under it and no way of
signing in — a guest again — and the sign-up form links the new address to
it. Firebase can change an address in place only by emailing the new one and
then signing the account out everywhere, which would throw a student out in
the middle of signing up.

#### Builds with no accounts

The demo (`build:demo`) and a dev server with no Firebase project
(`VITE_PERSISTENCE=local`) are unchanged. Their one user is reported as
confirmed (`AuthProvider`), the hook applies none of this unless the free
area is kept on an account (`freeAreaIsOnTheAccount()`), and the panel is
never loaded (in the demo `SubscriptionSummary` does not reference it at
all). Held by tests.

#### Old clients (the live bundle, `581dfe1`) against these rules

`rules-tests/oldClient.rules.test.ts`, now fifteen tests. Every account in
it signs in with an email and password and has NOT confirmed, because that is
every such account on the live site. (It replays `581dfe1`, and the one new
write of the bundle production moved to on 7 Oct, `9566d21`.) **No write the live bundle makes is
refused**: guests, guests who create an account from the old screen,
signed-in students in and out of a class, a paying educator creating a class
and setting work. The live bundle never writes a free area (shown refused
for a new unconfirmed account, so the sentence has something under it), and
writes `createdAt` exactly once, as the server's time — including the one way
it writes it twice, two tabs opening at the same moment, which the pin allows
because moving the date to now gains nothing. **No tolerant transition rule
and no change of rollout order was needed.**

### Checks

`vitest`: 2,365 passed, 1 skipped (the question dump), 172 files —
the night had 2,232. `test:rules`: 126 passed in two files — the night
had 101. `tsc` on the app and the functions: clean. `eslint` on the files
touched: no errors (fast-refresh warnings only). `validate-content`:
0 errors. `papers:check`: 10 papers, 150 questions, all as published.
`check:bundle` on a `server` build: 76 files read, 462 descriptions looked for, none found, with no exception for the diagnostic. The question dump is
still `629965d3…9a06bb`: ordinary sessions and the version-1 draw are byte-identical to `581dfe1`.

**Sizes.** Entry chunk, limit 2,097,152 B:

| Build | At the start of this pass | Now | Under the limit by |
| --- | --- | --- | --- |
| `bundled`, production's `.env` | 2,000,555 B | 1,995,433 B | 101,719 B |
| `server` (emulator settings) | 1,779,830 B | 1,774,708 B | |
| `build:demo` | 1,407,741 B | 1,396,069 B | |

The step itself is three small files loaded only when needed: the panel
(5,322 B), the screen that stands in for revision (1,612 B) and the
Firebase calls (1,238 B). What had to stay in the entry chunk (the rule,
what the provider and the gate hook do about it, the onboarding's wiring)
came to about 11.7 kB before anything was moved. **Moved out to pay for
it:** the diagnostic's screens (12,270 B) and the two achievements screens
(2,399 B and 2,398 B), which almost no page view needs, are now loaded when
opened; each is its own precached file, so nothing is lost offline. Net: the
entry chunk is 5,122 B smaller than it was at the start. (Production's own
entry chunk is 1,977,530 B since main moved on 7 Oct; merging main into
this branch will add about 6 kB to the figure here.)

**The function, over real HTTP with emulator-minted tokens.** 71 rows, 70 as expected. The one that is not is the in-memory count of refusals, which `netlify dev` resets on every call and which a unit test covers instead (as before). The nine payload rows the earlier script failed, by reading a field the index does not have, now read each structure's areas from the seed and pass. The
new rows:

| Caller | Answer |
| --- | --- |
| Unconfirmed email and password, new since the rule, its document naming the knee | 403, every area (the knee: "Confirm your email address to open your free area") |
| Unconfirmed, new, not chosen · no `createdAt` on the profile · no profile at all | 403, every area |
| The same account once confirmed, **on the token it already held** | the knee 200 |
| Google | its free area 200 |
| Unconfirmed, profile from before the rule, a free area chosen | that area 200, the other eight 403 |
| Unconfirmed, from before the rule, not chosen | 403, every area |
| Unconfirmed and paying · inside the days of grace · complimentary · member of a licensed class | all nine 200 |
| Unconfirmed, subscription ended, new | 403, every area |
| Unconfirmed, subscription ended, from before the rule | its free area 200 |
| A confirmed account whose address is then changed | the old token 401; signed in again, 403 until the new address is confirmed, then 200 |
| A guest → creates an account (same uid) → confirms | 403 as a guest, 403 unconfirmed, its free area once confirmed |
| A guest from before the rule → account, unconfirmed, nothing moved up yet | 403, every area |

**The rules, in the emulator.** An unconfirmed account refused a first
choice (on an existing profile, by merge, and on a new profile); allowed the
moment it is confirmed; Google allowed; a guest refused; a token with no
claim refused; a confirmed account that changed its address refused the
change until confirmed again. An account from before the rule: its first
choice allowed unconfirmed, used or unused; keeps what it has; must confirm
to change, even thirty days on; still one choice only. Nobody can make
themselves old: a chosen `createdAt` refused on create and on update, alone
or beside the choice it would unlock; a missing or non-timestamp date is
new; delete-and-recreate is new; setting it to now is allowed and gains
nothing. Full access: a paying unconfirmed account writes its profile, its
answers, joins a class and creates one; a member of a licensed class reads
and writes as a member.

**In a browser** (Chromium, a fresh profile each time, no reload first, 1280
px and 390 px, the Firestore and Auth emulators), on a `server` build and
again on a `bundled` one — twenty runs (five journeys, two widths, two builds), 536 checks, all passing, on the source as committed:

- *A new visitor.* Creates an account with an email → "Check your inbox",
  still step one of four, the address named, focus on the heading, one link
  issued, the profile an account with no free area. Every address that
  revises returns them to it with no fact on screen; the app asks the server
  for nothing; asked directly with their token, the function answers 403.
  "I've confirmed" too early is answered in the status region; resend inside
  the minute sends nothing and says why; after the minute a second link is
  issued. Tab reaches the three buttons in order, and Enter works. With the
  network cut: the offline line, the alert when they press, nothing thrown.
  "Use a different email": the form is back under its own heading, the same
  uid, the first address off the account; the second address gets its own
  link. The way back opened where nobody is signed in says the address is
  confirmed and where to go. The link is followed in a second tab, which
  returns to the app and says "Your email address is confirmed."; the first
  tab, come back to and with nothing pressed, moves on to "Pick your free
  area". They pick the knee: on the account, one fetch (server), a card's
  facts, the first session.
- *A Google account*, made through the Auth emulator's own sign-in window
  (the first time this journey has been driven in a browser): straight to
  "Pick your free area", confirmed, no link issued, one fetch.
- *An existing guest* with progress, profile from before the rule, the area
  on the device only. The gate, then the account, then "Check your inbox"
  naming their area and that their progress is waiting; the free area NOT
  written; the account screen showing their twelve answers and "Free:
  confirm your email address to open your free area."; a reload still on the
  step with no second email. Link followed, "I've confirmed — continue":
  Today with no reload, the same uid, the knee moved up unused, six mastery
  rows, twelve answers and 180 XP intact.
- *An existing unconfirmed free account* (profile from before the rule, the
  area on the device with no owner, progress). First load: Today, never the
  step; nobody emailed; the knee moved up; served 200 (server). The account
  screen keeps its area, disabled, with the sentence and "Send me the link";
  nothing sent until asked; one link when asked; the card still shows its
  facts afterwards and after a reload; offline reload still Today (bundled).
  Confirmed in the other tab and noticed by itself: the request is gone.
  With the stored date moved back thirty-one days the picker opens and the
  one change is made and counted.
- *A paying account*, unconfirmed, made since the rule: signs in and is
  straight in. No step, nobody emailed, nine areas served (server), cards in
  three areas, Study, Atlas and Progress open, the account screen says full
  access and nothing about confirming, the class form opens.

No console errors beyond the refusals the scripts themselves asked for.

*Not browser-tested:* **a real email** (the emulator sends none: arrival,
the junk folder, Firebase's own confirmation page and its "Continue" button
are all untested, and are the first thing to try on the draft); "Use a
different email" against the real Firebase service (the emulator behaves as
the documentation says the service does); Firebase's own limit on emails
(unit-tested: the wording); iOS Safari and an installed PWA, where a link
opened from the Mail app lands in Safari and not in the installed app
(handled by the notice above, in a desktop browser only); a screen reader;
a real update prompt from the live bundle to this one.

### Before you deploy

In order. The first three are in the Firebase console and can be done days
ahead: they change nothing until an email is sent.

1. **Name the sender.** Firebase console → Authentication → Templates →
   *Email address verification* → the pencil. Set **Sender name** to
   `LocusMSK`, and **Reply-to** to an address that is read. (Firebase does
   not let the message body of this template be edited, to stop it being
   used for spam; the subject can be.) *If skipped:*
   the email arrives from "noreply@<project-id>.firebaseapp.com" with no
   name a student recognises, and is far more likely to be ignored or
   filed as junk.
2. **Name the app.** Project settings (the cog) → General → **Public-facing
   name**: `LocusMSK`. It is the `%APP_NAME%` in the subject and the body.
   *If skipped:* the email says "Verify your email for project-1234567890".
3. **Check the authorised domains.** Authentication → Settings → Authorised
   domains must list every address the app is used from: the live domain,
   and `content-server--mskanatomyrevision.netlify.app` if the draft is to
   be tried. (The live domain is almost certainly there already: Google
   sign-in needs it.) *If skipped for a domain:* nothing breaks. Firebase
   refuses the way back, the app sends the email without it, the link still
   confirms the address, and the student returns to the app by themselves;
   Firebase's page just has no "Continue" button.
4. **Optional, and worth it before a class joins:** send from your own
   domain (Templates → *customise domain*), which needs DNS records. Email
   from Firebase's shared address is what university mail filters distrust.
5. **Count who will be asked.** With the service account key:
   `npm run admin:verification-report` (it reads, and writes nothing).
   The line that matters is the last: free, unconfirmed accounts NOT
   recognisable as here before the rule. If they are real students who
   signed up after 7 Oct on the old app, move the start date to the day of
   the release — `VERIFICATION_STARTS` in `lib/emailVerification.ts` and
   `verificationStarts()` in `firestore.rules`, together (a test fails if
   they differ) — and deploy the rules and the app on that day. **Never a
   date in the future.** Otherwise leave it.
6. **Try it once with a real address, on the draft**, before production:
   sign up with an address you own. Does the email arrive, and where? Does
   the link confirm? Does "Continue" come back? Does "Use a different
   email" work? The draft shares production's Firebase project, so this
   makes one real account, which can be deleted from its account screen.
7. Firebase's free plan limits how many of these emails can be sent in a
   day (the figure is on Firebase's *Authentication limits* page; it was in
   the hundreds to a thousand when this was written). A whole year group
   signing up in one lecture is the day to know it.

### Rollout, as it now stands

The order of "Rollout — recommended order" above is unchanged; this is what
each step now carries, and its way back.

| Step | What | What changes for people | The way back |
| --- | --- | --- | --- |
| 0 | `admin:verification-report` and `admin:cohort-report` (read-only); the console steps above; the real-address trial on the draft | nothing | nothing to undo |
| 1 | **Rules**: `npm run deploy:rules` | Nothing, for anybody on the live bundle (replayed: fifteen tests). From this moment no client can write a free area for a guest or for a new unconfirmed account, and only full access creates a class | redeploy the previous rules (`git show 581dfe1:firestore.rules`). Nothing written under the new rules is invalid under the old |
| 2 | **Client and functions, still `bundled`** | As each accepts the update: a new visitor confirms their email before their free area; an existing guest is asked for an account and then to confirm; an existing email-and-password student notices nothing unless they go to change their area; a paying student and an educator notice nothing; Google notices nothing | publish the previous deploy from Netlify's list. Accounts stay accounts and confirmed addresses stay confirmed, both of which the old bundle ignores; a guest who took their address off again is a guest again, which the old bundle handles as it always did |
| 3 | **`server` on a draft** | nothing in production. Try, as well as the list above: a new account before confirming (no area, 403 in the function log as "its email address is not confirmed"), after confirming, and an existing unconfirmed account | a draft is deleted or ignored |
| 4 | Decide what is left of the eleven | — | — |
| 5 | **Switch**: `VITE_CONTENT_SOURCE=server` | as "Rollout" above | unset the variable and redeploy |

**Production moved while this was being built, and this branch does not
have what it moved to.** When this pass began production served
`assets/index-BCjoSWbO.js` (`581dfe1`). By 22:50 UTC on 7 Oct it served
`assets/index-CJEBZZy_.js` (1,977,530 B): main at `9566d21`, two commits
further on — the accuracy filter on the account screen, and the demo
account's history — released by somebody else. This branch still starts from
`581dfe1`. **Deploying it as it is would take the accuracy filter away.**
`git merge-tree` reports that main merges into this branch with no conflict.
It has NOT been merged here, because everything in this section was measured
without it. So, before step 2: merge main, run the checks again, and expect
the entry chunk to be about 6 kB larger than the figure above (what main's
two commits added to production's). Those two commits change one thing a
client writes — an answer record may carry `hints` — which the old-client
replay now includes.

Rules first is still the right order, and for the same reason: nothing the
live bundle does is refused, and there is no window in which the app's rule
is not also the database's. The other order also works (the new app holds
an unconfirmed account back whatever the rules say), but leaves it
unenforced in between.

**The draft** was redeployed from this state in `bundled` mode (never to
production): `https://content-server--mskanatomyrevision.netlify.app`, entry
`assets/index-CpF5cyMs.js`. `paddle-portal` 405, `paddle-webhook` 405, `renewal-reminders` 403, `content-area` with no token 401 (`private, no-store`), with a token Google rejects 401, an unknown area 400, POST 405, another site's `Origin` 403; the new files (the panel, the Firebase calls, the diagnostic) are served. Production served
`assets/index-CJEBZZy_.js` immediately before and after the deploy — which
is not the bundle it served when this pass began; see above. **The draft shares production's
Firebase project and production's rules, which are the OLD rules**, and the
real Firebase service: on the draft a sign-up sends a REAL email. Nothing on
it is enforced by the database until step 1.

### Left open by this

- A real email has not been sent. Steps 1 to 3 and 6 of "Before you deploy".
- Whether every existing profile carries `createdAt` (risk 19) can only be
  counted against production.
- One working mailbox can still be nine accounts by alias (`name+1@…`).
  Firebase treats them as nine addresses. Not addressed.
- The 50 action sentences with an attachment appended are the owner's to
  reword or leave (section 1).
- The vignette and functional questions exist only for the shoulder and
  elbow; the Atlas now shows the functional line and still does not show the
  vignettes.
- A lapsed subscriber who never confirmed is asked to at the moment their
  access ends (risk 18).
- The screen has not been used with a screen reader; the accessibility
  statement says so.

## Found on the way, not fixed

- Adaptive mode builds each MCQ from a pool of one structure, so its name
  distractors have nothing to draw from (from the earlier status note; still
  true).
- `tsc -p tsconfig.node.json` fails on `caches` in `pwa/anatomyCache.ts` and
  `offline/swPlugin.ts`; it did before this work.
- `eslint .` reports 21 errors in `src/scripts/` (explicit `any`); none in
  files this work touched.
- Today has no `<h1>`, so the route-focus hook has nothing to land on
  there (it now falls back to the main region when a stand-in gives way).
- The educator sidebar still offers "+ New class" to an account that will
  be shown the panel.
- `HotspotEditorApp` is lazy-loaded without a build-time guard, unlike
  `DevRoutes`; it no longer imports the seed, so it carries no facts either way.
- (7 Oct) The strip across the top while offline says "revision still works"
  to a guest and to an account waiting on its email, neither of whom can
  revise yet; and the account screen's downloads block says "Your free area
  can be downloaded" to an account that has no free area until it confirms.
- (7 Oct) The Firestore EMULATOR answered one `Listen/channel` request with
  400 in one run of the journey that signs IN to an existing account. This
  is the "unexplained" 400 of the night's pass: it appears only where a
  guest's session is replaced by an account's, which is when the client
  tears one listen channel down and opens another. Nothing on screen or in
  the stored data is affected. Still not chased to its cause.
- (7 Oct) A structure's card shows its functional line now, and still shows
  nothing of a joint's type and movements, which only the Atlas table has.
