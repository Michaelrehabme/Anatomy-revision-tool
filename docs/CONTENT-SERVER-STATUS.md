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

**The rules on this branch are stricter than production's**, for guests and
for creating a class. "Rollout" says exactly what an installed copy of the
live bundle experiences once they are deployed: nothing, for a guest or a
student.

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

**Not stopped** (tested as a known limit): the owner may delete their profile
(erasure) and a new profile may carry a first pick — so delete-and-recreate
gives a fresh choice. So does a second account, and an email-and-password
account needs no verified address (decision 9). See "Risks".

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
| 9 | Guests / local builds | **owner, 6 Oct (night):** a guest is NOT an account and is served nothing; the free area needs a real account. Local builds get the fixture | `firestore.rules` `isRealAccount`, `hooks/useEntitlement.ts`, `netlify/functions/content-area.ts` |
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

**Email is not verified, and that is the remaining cheap route to several
free areas**: an email-and-password account needs only an address that looks
like one. To require it: send the verification email on sign-up
(`sendEmailVerification`), refuse `freeArea` in the rules unless
`request.auth.token.email_verified == true` (Google accounts arrive
verified), have the function refuse an unverified account, and add a "check
your inbox" step between creating the account and picking the area, with a
resend. A day's work, and a real cost in first-use friction; the owner has
not asked for it.

**What decision 11 costs.** Two of the demo's three set assignments are on
the shoulder and the ankle & foot. Built from the fixture, a visitor who
tries to sit those is told the area is not part of the demo. `hip` +
`shoulder` is the pair to pick if that matters more than dashboard density.
The demo's default is still `bundled`.

## Rollout — recommended order

Nothing below has been done. Each step is safe on its own and can stop there.

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

## What this still does not stop

- **Nine free accounts are nine areas.** A guest can no longer hold one
  (6 Oct, night): it takes an account. But sign-up is free and an
  email-and-password account needs no verified address, so the bar is
  "someone prepared to make up nine email addresses", not "someone who paid
  for at least a month" — and delete-and-recreate still gives a fresh
  choice. Closing it means verifying email (decision 9 says what that
  takes), App Check on the function, or a per-IP limit. None is built.
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
- Email is not verified (decision 9).
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
