# Public claims and their evidence

Every objective claim LocusMSK makes in public, and what backs it up. CR-033 item 18.

**Why this file exists.** Under the CAP code, evidence for an objective claim has to be held
*before* the claim is published, not produced when somebody challenges it. This is that evidence,
in one place, with a date against each row.

**The rule.** If you could not show a sceptical reader where a number came from inside five
minutes, do not publish it. If it is not in this file, it should not be on a public page.

## How the counts stay honest

Rows whose evidence reads `validate-content: <key>=<number>` are checked by
`npm run validate-content`, which counts the real content and **fails** if a published number has
drifted. Keys: `structures`, `muscles`, `joints`, `bones`, `landmarks`, `ligaments`, `areas`, `images`,
`locatablemuscles`, `sourcechecked`, `sourcechecked<family>s`, `sourceheld`, `citedworks`.

This is not bureaucracy. Every one of these had drifted before the file existed: the home page
said "five regions" weeks after the ninth shipped, the meta description said "309 structures" when
there were 345, and the README said "48 muscles have no locate question" long after every muscle
had one. Nobody noticed any of them. Now the build does.

To add a claim: put it in the table with that evidence format, and the check starts working.

## Product and content

| Claim | Where it appears | Evidence | Last verified |
|---|---|---|---|
| "122 muscles" | MarketingHome (hero, FAQ, price cards, figures) | `validate-content: muscles=122` | 2026-09-20 |
| "nine regions" | MarketingHome (FAQ, price cards, figures) | `validate-content: areas=9` | 2026-09-20 |
| "486 structures" | MarketingHome (FAQ), index.html meta, manifest | `validate-content: structures=486` | 2026-10-08 |
| "Learn every muscle by where it lives" / "drilled until you can locate them" | MarketingHome H1, index.html meta | `validate-content: locatablemuscles=122` — every muscle has a locate hotspot. **If that check ever fails, this headline becomes false and must change.** | 2026-09-20 |
| "origin, insertion, nerve supply and action for every muscle" | index.html meta, manifest | `validateOina()` fails if any muscle lacks an answerable value for any prompt kind | 2026-09-20 |
| "cross-referenced against Terminologia Anatomica" | index.html meta, manifest | `ta2-mapping.resolved.json` maps all 122 muscle ids to TA2 identifiers | 2026-09-20 |
| "three question types — locate, identify and OINA" | MarketingHome (hero, sample, figures) | The three generators in `lib/questionGenerators/` | 2026-09-20 |
| "10, 20 or 40 questions a session" | MarketingHome (figures) | `LENGTHS` in RevisionSetup.tsx | 2026-09-20 |
| "the same renders the app uses, with the labels hidden" | MarketingHome (FAQ, sample) | The sample on the home page is the real locate component | 2026-09-20 |
| "works offline" / "Works offline on the train" | MarketingHome (FAQ, price cards, hero strip) | The PWA service worker and precached content. Note /terms disclaims any *availability* promise — these are consistent (offline capability vs uptime guarantee) but do not strengthen the offline wording | 2026-09-20 |

## Price and commercial terms

| Claim | Where it appears | Evidence | Last verified |
|---|---|---|---|
| "£4.99 a month", "£29.99 a year" | MarketingHome (`PRICING`), /pricing (`PLANS`) | The two Paddle price records. **These are kept in step with Paddle by hand** — see the note in `checkout.ts`. Re-check both after any price change | 2026-09-20 |
| "Prices include VAT" | /pricing, MarketingHome | Paddle is merchant of record and handles VAT — CR-033 item 9 | 2026-09-20 |
| "£2.50 a month" / "about the price of a coffee a month" | MarketingHome, /pricing | £29.99 ÷ 12 = £2.499, against a high-street coffee at £3–£4. A claim about our own price, not a competitor's | 2026-09-20 |
| "Annual · best value" | MarketingHome price card | £29.99/yr vs £59.88/yr at the monthly rate — true against our own prices only, which is all it claims | 2026-09-20 |
| "one free region, forever, no card" | MarketingHome (FAQ, hero, price card), /pricing | `FREE_AREAS` / `freeAreasFor` in entitlement.ts; checkout is never reached without a deliberate click | 2026-09-20 |
| "change your free area once after 30 days" | MarketingHome (FAQ), account screen | The 30-day rule in the free-area change logic | 2026-09-20 |
| "cancel whenever you like, no fee, access to the end of the paid period" | /refunds, /pricing, MarketingHome | Paddle customer portal cancellation + `actionForEvent` granting to `current_billing_period.ends_at` | 2026-09-20 |
| "A substantial part of LocusMSK is free and always will be" | /refunds | An open-ended commitment. It binds you: honour it or change the page before, not after | 2026-09-20 |
| 14-day cancellation wording and the waiver | /refunds, checkout | Consumer Contracts Regulations 2013; the waiver is recorded per subscription with its wording version | 2026-09-20 |

## Licensing and provenance

| Claim | Where it appears | Evidence | Last verified |
|---|---|---|---|
| "Most anatomical renders derive from Z-Anatomy … CC BY-SA 4.0" | /attributions, /terms | Per-image `licence` and `credit` fields; `validate-content` warns on any unconfirmed licence. **No AI-generated imagery ships any more** (CR-033 item 8), so "most" is now conservative | 2026-09-20 |
| "{n} images currently shipped, grouped by source" | /attributions | Computed at runtime from the seed — self-substantiating | 2026-09-20 |
| Muscle data derives from "ALL_Muscles_of_the_body" (Vinnie Maynard, University of Salford), cross-referenced against TA2, and the deck itself drew on Visible Body | /attributions, /sources | The dataset provenance note (CR-033 item 4). The clinical sentences were removed and action text rewritten to common-knowledge terms. `validate-content: sourcecheckedmuscles=122`. **The Visible Body link was missing until 23 Sep 2026 — see Corrected, below** | 2026-09-23 |
| "Content is drafted with AI assistance, then checked against published works" | /sources, /terms | A statement about our own process, so self-substantiating — but it **binds**. If a family is ever authored by hand instead, the page changes first | 2026-09-23 |
| "{n} of {total} structures rest on a named source" | /sources | Derived at render time from `provenance.generated.ts`; `validateProvenance()` fails the build if that file and the root `*-source-review` JSONs disagree. **Deliberately NOT a counted key**: the figure moves with every tranche, and a frozen number here would add churn without adding safety — the page states no typed number, so there is nothing to drift | 2026-09-23 |
| "32 bones / 133 landmarks / 165 ligaments" | /sources | `validate-content: bones=32`, `validate-content: landmarks=133`, `validate-content: ligaments=165` | 2026-10-08 |
| "{n} of the 143 ligaments have been checked against published works" | /sources | Derived and guarded by `validateProvenance()`; **not a counted key**, it moves with every tranche. Scope is **attachments only** — the page says so, and that caveat is the difference between this row and a false one | 2026-09-24 |
| Per-family check progress, e.g. "22 of the 34 joints have been checked" | /sources | Derived per family from `provenance.generated.ts` and guarded by `validateProvenance()`. **Deliberately NOT counted keys**: these move with every tranche. They were frozen at 0 on 23 Sep and were stale within a day — the page, which counts rather than states, was right throughout | 2026-09-24 |
| Works named on /sources are the works actually cited | /sources | `validateProvenance()` fails if any work on the excluded list (`EXCLUDED_WORKS`) still carries a citation. Dropping a name from the page while the record rests on it would make the work-set incomplete | 2026-09-23 |

## Competitor comparison (/compare — DRAFT, unlinked, noindex)

The page is drafted but **not published**: nothing links to it, it carries `noindex` (a meta tag
and an `X-Robots-Tag` header in netlify.toml), and it says "Draft" at the top. It becomes public
only when the owner approves it — at which point re-read every row below against the live pages
first, because these captures are from 28 Sep 2026.

Every row is one entry in `src/features/site/data/comparison.ts`, whose type makes the evidence
file mandatory. `comparison.test.tsx` fails if a row's screenshot is not on file, if its URL is not
the one the capture log (the folder's README) records for that file, if the page renders a row
without its "As of" date, or if a row is missing from this table.

| Claim | Where it appears | Evidence | Last verified |
|---|---|---|---|
| TeachMeAnatomy: £25/month; £45 per 3 months; £96 per 12 months; £195 lifetime; a "Basic" column of 4 articles a month and 600 questions; 3D models, dissection atlas, audio lectures and flashcards in the paid column | /compare | `docs/evidence/competitors-2026-09-28/teachmeanatomy-pricing.png` | 2026-09-28 |
| Kenhub: £25/month; £57 per 3 months; £190 lifetime against a struck-through £300; a "Free" column with atlas, articles and terminology; video tutorials and quizzes in the paid column | /compare | `docs/evidence/competitors-2026-09-28/kenhub-pricing.png` | 2026-09-28 |
| Complete Anatomy: Student £34.99 first year (annual, struck-through £69.99); Professional £94.99 annual; "Access on all devices" | /compare | `docs/evidence/competitors-2026-09-28/completeanatomy-pricing.png` | 2026-09-28 |
| Visible Body Suite: Student $34.99/year; Classroom/Professional $199/year, in US dollars | /compare | `docs/evidence/competitors-2026-09-28/visiblebody-pricing.png` | 2026-09-28 |
| RemNote: Free US$0; Pro US$96 billed yearly; Pro with AI US$216 billed yearly, in US dollars | /compare | `docs/evidence/competitors-2026-09-28/remnote-pricing.png` (Yearly tab only) | 2026-09-28 |
| LocusMSK's own figures on the page: structure count, region count, prices | /compare | Derived at render time from `provenance.generated.ts`, `AREAS` and `PLANS`; no typed number | 2026-10-04 |
| "What LocusMSK does not have: free-rotating 3D models, video or audio lectures, articles, dissection images, or any anatomy outside the musculoskeletal system of the limbs and spine" | /compare | A statement against ourselves. True of the app as built: plates are fixed 12-frame turntables, and the five structure families are all musculoskeletal. Revisit if any of those ships | 2026-10-04 |

**What the page deliberately does not say.** No "cheaper than", no ranking, nothing about any
competitor's quality, accuracy or results — the screenshots show prices and plan contents and
that is all they can support. Quizlet is absent (its capture is a bot-check page). No
institutional price is given for anyone (none is shown). The Complete Anatomy "3-day free trial"
and the money-back guarantees in the folder's README were read from page text and are left off
the page to keep it to prices.

## Privacy and security

These are the claims a university's DPO will test, and each names the thing that enforces it.
The full set lives in docs/DATA-PROCESSING.md; the load-bearing ones are:

| Claim | Where it appears | Evidence | Last verified |
|---|---|---|---|
| "A class owner cannot see your individual answers … enforced by the database's own permission rules" | /privacy, DATA-PROCESSING.md | `firestore.rules` — `attemptEvents` carries no cohort-owner read permission | 2026-09-20 |
| "No special category data … no health information about you" | /privacy, DATA-PROCESSING.md | The stored fields; it is a study tool | 2026-09-20 |
| "no advertising SDK, no tracking, no third-party analytics" | /privacy, DATA-PROCESSING.md, store declarations | `grep -rhoE "from 'firebase/[a-z]+'" src` returns app, auth and firestore only | 2026-09-20 |
| "deleted after 24 months of inactivity" | /privacy, DATA-PROCESSING.md | `retention.ts` + `scripts/deleteDormantAccounts.ts` | 2026-09-20 |
| "Delete your account … all of it goes immediately" | /privacy | `AccountDataControls` + the account-lifecycle deletion covering every subcollection | 2026-09-20 |
| "ICO registration ZC247309" | /privacy, DATA-PROCESSING.md | The ICO register entry | 2026-09-20 |
| "No private key, service-account credential, API secret or access token … none in its history" | DATA-PROCESSING.md | History scan of every blob in all 187 commits, 20 September 2026: no private keys, no service accounts, no API secrets. The only `.env` files ever committed are `.env.example` and `.env.educator-demo`, both of which hold flags, not values. The Firebase **web** API key is in the history and ships in the client — public by design, and the doc now says so rather than leaving a reviewer to find it | 2026-09-20 |
| "reply within one month" | /privacy, /refunds, /accessibility | UK GDPR response window; a commitment you have to meet | 2026-09-20 |
| WCAG 2.2 AA, "partially compliant", no independent audit; automated scan and desktop keyboard pass on 28–29 Sep | /accessibility | Own testing, stated as such on the page; method, fixes and open items in docs/ACCESSIBILITY-AUDIT-2026-09-28.md; contrast pairs and the accent-as-text rule are asserted in lib/__tests__/contrast.test.ts | 2026-09-29 |

## What a pilot needs before an outcome claim goes public

No outcome figure is public today, and none may be until every line in this section is met. The
thresholds are **proposed** (4 Oct 2026) and become the rule when the owner accepts them; until
then the rule is the stricter one above: no outcome claim at all.

**What the measurement is.** Each student in a class sits 15 questions twice: a baseline within
28 days of joining and a follow-up from 70 days later (`lib/diagnostic.ts`,
`lib/diagnosticPrompt.ts`). No feedback is given, and it never touches mastery or the class
counters. Only students with both sittings, on the same paper, questions and version, are counted
(`pairDiagnostics`). There is no comparison group. That last sentence limits everything below.

**Which 15: a class can sit more than one paper.** Until October 2026 each class drew its own
fifteen from the whole dataset (version 1). From version 3 there are ten written papers
(`lib/diagnosticPapers.ts`; the questions are listed in docs/DIAGNOSTIC-PAPERS.md), and which one
a student sits depends on what their account holds: **a student with every area sits the
whole-body paper; a student on a free account sits the paper for their free area.** The
follow-up is always the paper the baseline was. (Version 2, one public paper, was never
released.) So one class can hold a whole-body group and several single-area groups, and those are
different tests.

**A quotable figure needs ONE paper.** Scores on different papers are never averaged together:
`scripts/cohortReport.ts` reports each paper on its own ("3 students sat the whole-body paper,
2 sat the knee paper"), has no line for the class as a whole, and asks its floor (`MIN_PAIRED`)
of each paper separately. Every threshold below is counted **on one paper**. In practice that
means a **licensed class**: its members all hold every area, so they all sit the whole-body
paper, and the class is one group. An unlicensed class of free accounts is as many small groups
as its students chose free areas, and is unlikely to reach a quotable number on any of them. A
class that started under version 1 and gained members later sat the class's own paper and a
written one: quote each only on its own.

The papers hold no answers and publish no facts, but they are fixed: every class that sits the
whole-body paper sits the same fifteen, every year, until the paper is replaced by a new version.
A figure from a later class cannot rule out that the questions were passed on, which is one more
reason the number may flatter us.

**Before a figure is quoted in public**

1. **Size.** At least 20 students with both sittings, in one class **and on one paper**. The code's own floor
   (`MIN_PAIRED = 8`) is for showing a course lead their own class in private; it is too few for
   a public number.
2. **Completion.** At least 60% of the students who sat the baseline also sat the follow-up.
   Below that, the people who finished are mostly the keen ones and the figure describes them,
   not the class.
3. **A real class.** Students enrolled on a real module, who joined through a class code. Not
   the owner, friends, testers or the demo cohort.
4. **Both ends in window.** Baselines inside the 28 days; at least 70 days between sittings.
5. **Every figure travels with its counts**: how many joined, how many sat the baseline, how
   many sat both, and the dates. A percentage without its n is not quotable.

**What the figure may be called.** A change in score on our own 15-question test, among students
who chose to sit it twice. Say "scored", "answered", "went from … to …". Report it in percentage
points, with both means.

**What it may not be called.** Anything causal. An uncontrolled before-and-after cannot separate
the app from the lectures, practicals and other revision that happened in the same ten weeks.
Two further reasons the number flatters us, which must be stated wherever it appears:

- **Practice effect.** They sat the same 15 questions twice. Some of the gain is from having
  seen the paper, even without feedback.
- **Self-selection.** Nobody is made to use the app or to sit the follow-up. Students who do
  both are likely to be those who revise more anyway.

So never: "improves", "boosts", "because of", "thanks to", "proven", "effective", "learn faster",
"better grades", "X% improvement" (a percentage of a percentage), or any link to exam or module
marks. The diagnostic does not measure marks.

**How dose is reported.** As what the class did, next to the score and not as its cause: median
questions answered per active student and median days used (`scripts/cohortReport.ts`, "USE"),
with the number of students who never opened the app. Do **not** split the gain by heavy and
light users in public. The heavier users chose to be, so that split is self-selection drawn as
a result. `outcomeComparison.ts` makes that split for the admin screen; it stays there.

**Consent and anonymity**

- Students were told, before the baseline, that class-level results may be reported outside
  their course. **They are told from the release that carries the 11 Oct 2026 wording, and not
  before it.** Both cards now say that one overall figure for the class, with no names in it,
  "may be shared with your course leader and may be used outside your course", and link to
  /privacy, which has a section on the test ("The before-and-after test": what a sitting keeps,
  who can see a score, the floor of 8 for telling a course leader anything, the conditions
  below for using a figure outside the course, and how to have the scores deleted). Until then
  the baseline card said only that the figure "may be shared with your course leader" and
  /privacy did not mention the test. **A baseline sat before that release was sat without
  being told, and its class cannot be quoted in public** — check each baseline's `takenAt`
  against the date the wording went live, and write that date in this file when it does.
  The section commits to two numbers a student can now hold us to: no class figure to anyone
  under 8 paired students on one paper (`MIN_PAIRED`), and none outside the course under 20
  (condition 1 above, still marked "proposed" — the page states it, so lowering it means
  changing the page first). /privacy states **no lawful basis** for the test: which of the
  page's three covers the class figure and its use outside the course is undecided, and is
  the owner's to settle before a pilot's first baseline.
- Class totals only. No names, no per-student rows, no quote from a student without their own
  written permission. Educators see class results only; a public claim cannot show more than
  an educator can.
- No figure for any group under 8, and no breakdown (by region, by tutor group) that would let
  one student be picked out.
- The university and module are named only with the course lead's written permission. If the
  university treats publication as research, its ethics process comes first. Ask; do not assume.

**Who signs off.** The owner, and the course lead of that class, both in writing, on the exact
sentence. Then the sentence, the counts, the date and the `cohortReport` output it came from go
in a row in this file **before** it is published. One class supports a sentence about that
class, not about "students" in general.

**Allowed, once all of the above is met** (the numbers here are made up):

- "In one first-year class in autumn 2026, 24 students sat our 15-question test at the start and
  end of term. Their average score went from 41% to 63%. There was no comparison group, they sat
  the same questions twice, and they also had a term of teaching, so this does not show the app
  caused the change."
- "41 students joined, 34 sat the first test and 24 sat both. Students who used the app answered
  a median of 310 questions over 12 days."

**Not allowed, whatever the numbers**

- "Students who use LocusMSK score 22 points higher."
- "LocusMSK improves anatomy scores by 54%."
- "Proven to help students pass."
- "The more you use it, the more you improve."
- "Used at <university>" without written permission.

**Closed gaps (6 Oct 2026).** `scripts/cohortReport.ts` used to pair sittings more loosely than
`pairDiagnostics`: it did not check the version or that the same questions were asked. It now
pairs with `pairDiagnostics` itself. And it used to print one mean for the class; it now prints
each paper on its own, counts the students who sat both sittings but on different papers and so
are not in any figure, and marks a paper under the private floor as not quotable however many
sat the class's other papers.

## Claims NOT to make until there is evidence

- **Any outcome claim** — "students who used it scored higher", "learn faster", "X% improvement".
  The baseline/follow-up diagnostic (CR-033 item 14) is what will eventually evidence this, and it
  needs a real cohort with both sittings completed before a single number goes on a page — the
  conditions are in "What a pilot needs before an outcome claim goes public", above. This is
  the claim most likely to be made carelessly in the February pitch, and the one most likely to be
  challenged.
- **Comparative claims about competitors** — prices, features, coverage. These need a dated
  screenshot taken at the time of publishing, and re-checking every quarter, because a competitor
  changing their price turns your true claim into a false one without you touching anything. The
  comparison page (CR-033 item 17) is drafted at /compare, unlinked and noindexed; its rows are
  in "Competitor comparison" above, and it must not be linked or indexed with stale ones. The competitor figures in docs/BACKLOG-STORE-MONETISATION.md are dated 8 September 2026
  and are **not** evidence for anything published later than that.

  **Evidence on file:** `docs/evidence/competitors-2026-09-28/` — dated full-page captures of the
  pricing pages of TeachMeAnatomy (and its institutional page), Kenhub, Complete Anatomy, Visible
  Body and RemNote, taken 28 Sep 2026, with the prices read off each in its README. Quizlet
  blocked automated capture and still needs one taken by hand. These support a comparison
  published on or shortly after that date; re-capture before any later publication, and at the
  latest by 28 Dec 2026. Note Complete Anatomy's UK price is in pounds (£34.99 first year, then
  £69.99), not the dollar figure the backlog quotes.
- **"The most complete", "the only", "the best"** — superlatives need evidence covering the whole
  market, which is not realistically obtainable. Say what the product has instead.

## Corrected, and why

| Claim | Where it was | What happened |
|---|---|---|
| "9 min median session" | MarketingHome figures | No analysis behind it anywhere. Replaced with the session lengths the app offers |
| "five regions" | MarketingHome, FAQ, price cards | True when written, wrong once the areas split to nine |
| "309 structures" | index.html meta, manifest | Stale count; the content holds 345 |
| "verified origin, insertion…" | index.html meta, manifest | /terms disclaims accuracy, so "verified" overstated it. Now says what was actually done: cross-referenced against Terminologia Anatomica |
| "The shoulder is free in the meantime" | /pricing | The free region is the student's own choice |
| "48 of the 122 muscles have no locate question" | README | Stale: every muscle now has one. Now checked by the validator |
| "14 atlas slides … All rights reserved" | README licensing section | Those slides were removed; nothing AI-generated ships |
| "No purchase history — there is no purchasing" | STORE-DATA-DECLARATIONS.md | Written before billing shipped. **Would have been a false store declaration** |
| "A test suite of 732 tests" | DATA-PROCESSING.md | 911 now; dated so a reader can tell how old it is |
| Muscle data "derives from ALL_Muscles_of_the_body by Vinnie Maynard" | /attributions | True, but it named the second link of a three-link chain as though it were the first: the deck itself drew on Visible Body (owner, 23 Sep 2026). Now states the whole chain, on /attributions and /sources |
| Anatomical content is "drawn from published teaching material and open anatomical models" | /terms | Incomplete once /sources existed to say more: it omitted that the content was AI-drafted and that three families were unchecked. Now says so and links to /sources |
| "Cheaper than one textbook" | MarketingHome pricing heading | A comparison that stops being true the longer somebody subscribes: three years at £29.99 passes a £60 textbook. Replaced with what does not expire — that it goes everywhere with you, which the offline support actually backs |

## Routine

- Re-verify competitor claims **quarterly**, and before each selling window.
- Re-date any row you re-check, even if the number has not moved. A stale date is a warning.
- Re-check the prices against Paddle after any price change — that pair is synced by hand.
- `npm run validate-content` covers the counts. Everything else is a human read of this table.
