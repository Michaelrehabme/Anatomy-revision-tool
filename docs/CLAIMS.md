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
drifted. Keys: `structures`, `muscles`, `joints`, `areas`, `images`, `locatablemuscles`.

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
| "345 structures" | MarketingHome (FAQ), index.html meta, manifest | `validate-content: structures=345` | 2026-09-20 |
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
| Muscle data derives from "ALL_Muscles_of_the_body" (Vinnie Maynard, University of Salford), cross-referenced against TA2 | /attributions | The dataset provenance note (CR-033 item 4). The clinical sentences were removed and action text rewritten to common-knowledge terms | 2026-09-20 |

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
| WCAG 2.2 AA, "partially compliant", no independent audit | /accessibility | Own testing, stated as such on the page | 2026-09-20 |

## Claims NOT to make until there is evidence

- **Any outcome claim** — "students who used it scored higher", "learn faster", "X% improvement".
  The baseline/follow-up diagnostic (CR-033 item 14) is what will eventually evidence this, and it
  needs a real cohort with both sittings completed before a single number goes on a page. This is
  the claim most likely to be made carelessly in the February pitch, and the one most likely to be
  challenged.
- **Comparative claims about competitors** — prices, features, coverage. These need a dated
  screenshot taken at the time of publishing, and re-checking every quarter, because a competitor
  changing their price turns your true claim into a false one without you touching anything. The
  comparison page (CR-033 item 17) does not exist yet; it must not ship without its rows added
  here. The competitor figures in docs/BACKLOG-STORE-MONETISATION.md are dated 8 September 2026
  and are **not** evidence for anything published later than that.
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
| "Cheaper than one textbook" | MarketingHome pricing heading | A comparison that stops being true the longer somebody subscribes: three years at £29.99 passes a £60 textbook. Replaced with what does not expire — that it goes everywhere with you, which the offline support actually backs |

## Routine

- Re-verify competitor claims **quarterly**, and before each selling window.
- Re-date any row you re-check, even if the number has not moved. A stale date is a warning.
- Re-check the prices against Paddle after any price change — that pair is synced by hand.
- `npm run validate-content` covers the counts. Everything else is a human read of this table.
