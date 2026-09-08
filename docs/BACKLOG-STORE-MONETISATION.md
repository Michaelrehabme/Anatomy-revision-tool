# LocusMSK — Store Readiness, Monetisation & Go-to-Market

Written against commit `db0f344` (8 September 2026).
Register numbering continues from CR-022.

**State:** 309 structures · 50 images · 2,391 questions · 428 tests passing · 4.2MB image payload · 36 of 50 images CC BY-SA (Z-Anatomy), 14 still AI-generated · 68 structures with no image (44 muscles, 23 joints, 1 bone).

**Part 0 verified against vendor sources on 8 September 2026.** Several figures in the first draft were wrong or had gone stale; the corrections are marked in place and the consequences are folded through Parts 1, 2 and CR-028. See "What the verification changed" at the end of Part 0.

---

# Part 0 — The competitive landscape

Prices are as listed by the vendor on 8 September 2026 and will drift; re-check before any pitch that quotes them. **Prices are given in GBP wherever the vendor lists GBP to a UK visitor**, because that is what your buyer actually pays and the first draft's USD figures materially overstated what a UK student is being charged.

Part 1 prices against the market and Part 2 tells you not to market breadth. Both arguments depend on knowing what is actually out there, so this section sets that out first. The short version: the market splits cleanly into products that show you anatomy and products that make you recall it, almost nobody does both well, and nobody at all does the second one for MSK routes specifically.

## Tier 1 — 3D atlases (visualisation-led)

These sell the model, not the learning. They are strongest exactly where LocusMSK is weakest (imagery) and weakest exactly where it is strongest (retrieval).

**Visible Body** — **the one-time purchase is gone.** The current product is **Visible Body Suite**, a subscription at **$34.99/year (student)** and **$199.99/year (professional)**, spanning iOS, Android and web. The old single-purchase apps have been consolidated into it: Muscle Premium is no longer a separate SKU, and its content now ships inside the Suite as the "Muscles & Kinesiology" module alongside Physiology & Pathology, Visible Biology, Anatomy & Physiology and Human Anatomy Atlas. Acquired by **Cengage Group, announced 13 January 2025** (from Capitala Group and Lineage Capital), with 24,000+ visual assets and 1,000+ institutions. The Muscles & Kinesiology pins — origin and insertion, innervation, blood supply, pronunciation — remain a direct functional overlap with the OINA dataset.

> *Corrected.* The first draft had "$24.99 one-time" and "acquired February 2025", and built a pricing argument in Part 1 on that one-time figure. Both are wrong: the price is a $34.99 annual subscription and the deal was announced in January. This is the single most consequential correction in the document — see Part 1.

**Complete Anatomy** (3D4Medical, owned by Elsevier) — student licence **$74.99/year, discounted to $39.99 for the first year**, full price from year two. Confirmed unchanged. Institutionally entrenched. The browser version is restricted to institutional subscribers, so individuals are pushed onto native apps.

**Primal Pictures / Anatomy.tv** — the one most likely already installed at a UK physio school. Trading 30+ years, **1,500+ institutions across 150+ countries**, part of Citeline, a Norstella company. Confirmed. It has a named **Physical/Physiotherapy & Sports Science** vertical, and its Functional Anatomy module carries **120+ fully interactive 3D models** performing functional and gross motor movements and goniometry technique, rotatable and zoomable while in motion. Free trials are institution-only; students are told to ask a librarian.

**BioDigital** — **acquired by Anatomage, announced 10 January 2025.** Freemium and browser-first. The **$19.99/year Personal Plus plan was retired on 1 May 2026**; the individual paid tier is now **$3.99/month** (~$48/year). The free tier gives 500+ Anatomy & Physiology models with tours and quizzes, capped at 10 model views per month and 5 saved models. Built for exploration rather than exam preparation.

> *Corrected.* The first draft had "premium around $20/year" and did not mention the acquisition. The annual-equivalent price has roughly doubled and the owner has changed.

**Anatomyka** — free access to the skeletal system and all tools; paid ATLAS and ATLAS PRO tiers **from $1.99/month** for the remaining systems. Descriptions drawn from Memorix Anatomy, with QR codes in the printed book opening the matching 3D model.

## Tier 2 — Learning platforms (the real competitor set)

**TeachMeAnatomy is the one to beat, not Kenhub.** This is the biggest change from the first draft. Verified UK pricing: **£25/month, £15/month quarterly (£45), £8/month annually (£96 total), or £195 lifetime**, with a 7-day money-back guarantee. Premium includes **1,700+ MCQs**, unlimited articles, **750+ interactive 3D models**, 120+ dissection images, audio lectures, ad-free access, **flashcards with spaced repetition**, and **quiz analytics** tracking strengths and weaknesses. It claims 12 million students and professionals a year, and it sells **institution-managed licences to educators** — the same channel Part 2 treats as uncontested.

> *Corrected.* The first draft said "1900+ MCQs" (it is 1,700+) and left the price as "subscription, low". £96/year is the number that matters: it is the realistic paid alternative for a UK student and it is only ~3x the proposed £29.99, not the ~10x gap the Kenhub framing implied.

**Kenhub** — permanently free tier, then Premium at **£25/month, £19/month on a 3-month plan (£57 total), or £190 one-time Lifetime, down from £300**, all with a 7-day money-back guarantee. Premium includes 141+ hours of video and 485+ quizzes running from beginner to clinical scenarios, custom exam-prep quizzes and a Latin/English terminology toggle. The engine is spaced repetition with adaptive quizzing that tracks gaps and serves questions accordingly. Reviewers consistently rate it the best *learning* tool rather than the best atlas, and consistently flag the same gap: no 3D models.

> *Corrected.* The first draft quoted the US listing ($29–39/month, $290 lifetime) and described 6- and 12-month plans that no longer exist. The UK-facing structure is Monthly / 3 Months / Lifetime. Kenhub is still the premium anchor, but at £25/month it is closer to TeachMeAnatomy's monthly rate than the draft implied — the two diverge on the annual and lifetime plans, where TMA is roughly half.

**Muscle & Motion** — four apps (Anatomy, Strength Training, Posture, Yoga) aimed squarely at personal trainers, physiotherapists, chiropractors, rehab professionals and university instructors, with 1,200+ exercises with anatomical analysis. **There is no single subscription covering all four** — each is bought separately, which is a friction point worth knowing. A free tier unlocks part of the content. Movement and biomechanics rather than attachment recall, so adjacent rather than head-on, but it owns mindshare in the sports-therapy end of your market.

## Tier 3 — Free and commodity

Quizlet, Brainscape and Anki already host thousands of user-made muscle origin/insertion/innervation decks with spaced repetition built in. **This is the real price anchor.** A student's alternative to paying you is not a £96 TeachMeAnatomy subscription, it is a free deck a classmate made last year. GetBodySmart is free. Physiopedia Plus sits in CPD rather than anatomy drilling, offers 600+ structured CPD modules, and gives students a **50% discount** and new graduates 30% — relevant to the Tier 3 CPD ambition in Part 2, not to the student product.

The category to watch is **AI note-to-flashcard tools**, and it has moved fast. The current field includes **RemNote, QuizRise, AnkiDecks, Studyglen and CogniGuide**, most with free tiers, several running **FSRS spaced repetition** natively. A student uploads a lecture PDF or slide deck and gets a scheduled flashcard deck back in one click. These commoditise content *generation* — the part of the dataset that took the most manual effort.

> *Corrected.* The first draft named "CollegeWard" and "okti"; neither is findable as a current product. The named tools above were verified in September 2026. The category threat is real and larger than the draft suggested — free tiers with proper FSRS scheduling are now table stakes in this segment.

## Positioning map

| Product | Price to a UK student | Channel | MSK depth | Retrieval loop | Cohort analytics |
|---|---|---|---|---|---|
| **TeachMeAnatomy** | **£8/mo annual (£96/yr), £195 lifetime** | Direct + **institutional** | Whole body, clinical | **SR flashcards + 1,700 MCQs** | **Individual analytics; cohort unconfirmed** |
| Kenhub | £25/mo, £57/3mo, £190 lifetime | Direct + bulk codes | Whole body, medical | **Strong** — adaptive SR | No |
| Complete Anatomy | $39.99 yr 1, $74.99 after | Direct + institutional | Whole body | Quizzes, not scheduled | Educator content tools |
| Visible Body Suite | **$34.99/yr** (no one-time) | Direct + library | **Strong MSK** (Muscles & Kinesiology) | Flashcards + quizzes | No |
| Primal / Anatomy.tv | Not purchasable | **Institution only** | **Strong**, physio vertical | Quizzes | Limited |
| BioDigital (Anatomage) | $3.99/mo | Freemium + institutional | Moderate | Exploration | No |
| Anatomyka | From $1.99/mo | Direct | Moderate | Atlas, not retrieval | No |
| AI flashcard tools | Free tier + Pro | Self-serve | Whatever you upload | **FSRS, automatic** | No |
| Quizlet / Anki decks | Free | Peer sharing | Variable, unverified | SR, self-rated | No |
| **LocusMSK** | **£4.99/mo, £29.99/yr** | Direct + institutional | **309 structures, MSK only** | **SR across objective types** | **Yes** |

## The gap, stated precisely

Nobody occupies all four of: MSK-only scope, mobile-first web, daily-habit gamification, and cohort analytics for the person teaching the module.

- Kenhub is whole-body and priced for medical students. £25/month is not a sports rehab undergraduate's spend.
- Primal owns the institutional physio channel but **cannot be bought by a student**, which is why students in Primal institutions still buy something else.
- Visible Body has better attachment visualisation than LocusMSK will have for years, and no learning loop, no scheduler, no cohort view.
- The free decks and the AI tools have the loop but no quality control, no verified data, no curated images and no structure.
- **TeachMeAnatomy is the closest thing to a direct competitor and the verification made it closer, not further.** It has the loop, the analytics, the institutional channel and a price a student will pay. What it does not have is MSK-only depth or a cohort dashboard for the module leader.

The defensible position is depth in a narrow domain plus retrieval mechanics: 309 structures with verified origin/insertion/nerve/function, pre-computed `byAction` and `byNerve` indexes generating question types nobody else offers ("select all muscles innervated by the ulnar nerve"), locate questions on real renders, and a price point where Quizlet users will actually convert.

## Six threats, honestly stated

**1. Images are table stakes and you don't have them.** Every Tier 1 competitor leads with visuals; TeachMeAnatomy ships 750+ 3D models at £8/month. 68 structures with no image at all, and 14 still AI-generated, is what a student judges in the first thirty seconds. This makes **CR-026 a competitive necessity, not polish** — and it sets the quality bar, which is a Visible Body screenshot, not "better than what we had".

**2. Spaced repetition is not a differentiator, and the verification made this worse.** Kenhub runs adaptive SR. **TeachMeAnatomy ships SR flashcards *and* quiz analytics at £96/year.** The AI flashcard tools ship FSRS on a free tier. The differentiator is not "we have SR", it is that the scheduler responds to objective question types rather than flashcard self-rating, and that the analytics roll up to a *cohort*. That distinction is invisible on a marketing page and only becomes real when CR-006 lands. Until then, do not claim it.

**3. The institutional channel is not empty.** Part 2 treats course-lead licensing as uncontested. Primal sells to exactly these institutions, and TeachMeAnatomy sells institution-managed licences to exactly these educators at a price a department will not blink at. If a school already holds an Anatomy.tv site licence, your pitch competes with a sunk budget line and a librarian who chose it. **Ask about existing subscriptions in the first pilot conversation** — and lead with the cohort dashboard, because that is the thing neither of them is known to provide.

**4. Free peer decks are the real substitute.** The £29.99 annual is not competing with £300-a-year Kenhub, it is competing with £0 and "good enough". The answer is verified data and the locate questions, both of which a Quizlet deck structurally cannot do.

**5. AI tooling is commoditising the question bank, faster than the draft assumed.** A student uploads a lecture PDF and gets an FSRS-scheduled deck back, free. The 2,391 questions are less of a moat each month. The moat that survives is the verified structured dataset, the objective-type scheduler, and the cohort analytics — which is the same conclusion the licence section of Part 1 reaches by a different route.

**6. New: the independent mid-market is being consolidated.** Visible Body went to Cengage and BioDigital went to Anatomage **in the same month** (January 2025), joining Complete Anatomy inside Elsevier and Primal inside Norstella. Four of the six Tier 1 products are now owned by education or medical-publishing conglomerates with textbook bundling and institutional sales forces. The practical risk is bundling: a 3D atlas thrown in free with a set textbook is not a product you can outsell on features. It also means an independent MSK tool with traction is an acquisition target, which is a strategic option rather than only a threat.

## What the verification changed

The five items below replace the first draft's "what this changes elsewhere" list. All have been applied to the document.

1. **Part 1, "What the market charges"** — rewritten. Kenhub's plan structure is Monthly / 3 Months / Lifetime at £25 / £57 / £190, not 6- and 12-month plans at $29–39. **TeachMeAnatomy at £96/year is inserted as the anchor that actually matters.** Applied.
2. **Part 1, one-time pricing — the draft's argument is void.** There is no $24.99 one-time Visible Body to price against; it is a $34.99 annual subscription. The one-time comparison set is now **Kenhub £190 and TeachMeAnatomy £195**, which makes a £59.99 three-year course pass look *better*, not worse. The Part 1 subsection has been rewritten accordingly, and the suggested lifetime-unlock price revised. Applied.
3. **Part 2, "Don't market breadth"** — correct, and the positioning map above is the evidence. Reuse the table on the educator page rather than writing new copy. Applied as a cross-reference.
4. **Part 2, pilot approach** — "do you currently subscribe to Anatomy.tv, Complete Anatomy or TeachMeAnatomy?" added to the first conversation. It changes the pitch entirely. Applied.
5. **CR-028 Part 3, marketing site** — the comparison table belongs on the educator page. Comparison pages also rank for competitor-name long-tail terms, which is winnable SEO in a way head keywords are not. Applied.

## Watchlist

Re-run quarterly, before each selling window. Cheap to check, expensive to be surprised by.

- **TeachMeAnatomy's institutional licence terms and whether it ships cohort/educator analytics** — promoted to the top of the list. This is now the single change that would remove the main differentiator, and it is the closest competitor on price, channel and feature set.
- Kenhub and TeachMeAnatomy plan structure and price — the anchors the whole pricing argument sits on, and both moved between drafting and verification
- Cengage's integration of Visible Body into its Higher Ed anatomy and physiology titles — a bundled 3D atlas inside a set textbook changes the institutional maths
- Anatomage's direction for BioDigital now the $19.99/year tier is retired — whether it moves up-market into institutional-only like Primal
- Primal's pricing moving down-market to individuals
- AI flashcard tools adding verified subject-specific datasets rather than only processing uploads — that is the point at which they stop being a generation tool and start being a competitor
- Any MSK-specific entrant aimed at physio, sports therapy or sport rehab, which is currently an empty category

## Sources

Verified 8 September 2026.

- [Kenhub pricing](https://www.kenhub.com/en/pricing)
- [TeachMeAnatomy Pro sign-up and pricing](https://teachmeanatomy.info/sign-up/) · [institutional licence](https://teachmeanatomy.info/teachmeanatomy-virtual-academy/)
- [Visible Body Suite on the App Store](https://apps.apple.com/us/app/visible-body-suite/id1594705297) · [Cengage acquisition announcement](https://www.cengagegroup.com/news/press-releases/2025/cengage-group-acquires-visible-body/)
- [Complete Anatomy pricing](https://store.3d4medical.com/)
- [Primal Pictures — Physiotherapy & Sports Science](https://primalpictures.com/physio-physical-therapy-sports-science/) · [Functional Anatomy](https://primalpictures.com/functional-anatomy/)
- [BioDigital May 2026 plan changes](https://support.biodigital.com/hc/en-us/articles/39657133675927-May-2026-Changes-to-Individual-Plans-and-Free-Trials) · [Anatomage acquisition](https://www.prnewswire.com/news-releases/anatomage-announces-acquisition-of-cloud-based-software-company-biodigital-302347603.html)
- [Anatomyka pricing](https://www.anatomyka.com/pricing/)
- [Muscle & Motion products](https://www.muscleandmotion.com/products-apps-courses/)
- [Physiopedia Plus student discount](https://members.physio-pedia.com/students/)

---

# Part 1 — Monetisation

## What the market charges

**TeachMeAnatomy is the anchor that matters**, and the September 2026 verification moved it to the front of this section. A UK student pays **£8/month on the annual plan (£96/year)**, £15/month quarterly, £25/month rolling, or £195 for lifetime access — and gets 1,700+ MCQs, 750+ 3D models, spaced-repetition flashcards and quiz analytics for it. That is the number a student will hold your £29.99 against.

**Kenhub** sits above it: a permanently free tier, then **£25/month, £19/month on a 3-month plan (£57 total), or £190 one-time Lifetime (down from £300)**, backed by a 7-day money-back guarantee. They also sell bulk unlock codes to institutions, redeemed against student accounts.

**The category as a whole is cheaper than either.** The average education app subscription is $8.13/month or $56.09/year. Across all subscription apps the median monthly price is $6.68, though $9.99 is the most common single price point — meaning anything at $9.99 sits in the top quartile, not the middle. Education ranks third of all categories for 12-month LTV at $45.10. Note that TeachMeAnatomy's £8/month annual rate lands almost exactly on the category average, which is a good indication of where the real market clears.

Kenhub is priced for medical students with medical-student budgets and a medical-school-sized problem. You are selling to physiotherapy, sports therapy, sport rehabilitation, osteopathy and chiropractic students — more price-sensitive, and with a narrower, deeper need. **Do not price near Kenhub.** You will lose on perceived breadth and win nothing. **Do price knowingly against TeachMeAnatomy**, because that is the comparison a student will actually make, and £29.99 against £96 is a strong position provided the depth argument lands.

## The models, assessed

### One-time £5–10 — the weakest option as specified

One-time purchases have weak retention because once the payment is made there's little incentive to keep coming back. That matters less for you than usual (a student genuinely does finish with the app after their exams), but the economics are the problem: £7 gross is roughly £6 after Apple's cut, against a category 12-month LTV of $45. Your costs — Firebase, hosting, content updates, support — are recurring while the revenue is not.

**If you want a one-time option, price it as a course pass at £39.99–59.99, not £5–10.**

> *Revised after verification.* The first draft recommended £24.99–34.99 on the basis that it would sit "directly on top of Visible Body's $24.99 one-time price". **That price no longer exists** — Visible Body is now a $34.99 annual subscription and the one-time SKU was retired in the Cengage consolidation. The surviving one-time comparators are **Kenhub Lifetime at £190 and TeachMeAnatomy Lifetime at £195**. Against those, £24.99 is needlessly cheap and anchors the product as trivial; a course pass in the £39.99–59.99 band is a quarter of the nearest rival's lifetime price and still reads as a serious purchase. This merges with the multi-year tier discussed below — do not ship two separate one-time products.

£5–10 anchors the whole product as trivial and should not be shipped at any point.

### Monthly subscription — best individual LTV, with a caveat

Subscriptions are the dominant model for consumer education apps and align revenue with ongoing value. The caveat specific to your audience: student usage is seasonal. They will subscribe in exam term and cancel in August. That's acceptable — just over half of education app subscribers renew after the first cycle, so plan for it rather than being surprised by it.

**Suggested: £4.99/month, £29.99/year.** The annual price is the one to push; it captures a full academic year and removes the monthly cancel decision. At £29.99 you are roughly a third of TeachMeAnatomy's annual price and a tenth of Kenhub's — a gap wide enough to survive a student comparing feature counts, which they will, and which you will lose.

### Freemium — right for this audience, slower to convert

The headline numbers look bad: hard paywalls convert at a median 10.7% by Day 35 against 2.1% for freemium, roughly a 5x advantage, and general consumer freemium conversion sits at 2–5%. But three things cut the other way for you.

First, **after a year, retention for both models is nearly identical** — the hard paywall advantage is about timing, not total volume.

Second, education is the outlier category. Education subscribers take longer to commit than users in any other category: they explore, return, and start trials weeks after installing. Freemium suits that behaviour, and hard-paywalling a student app you have no brand recognition for will simply stop them ever trying it.

Third, and new from the verification: **every serious competitor has a free tier.** Kenhub's is permanent, BioDigital's gives 500+ models, Anatomyka gives the whole skeletal system, and the AI flashcard tools give working FSRS scheduling for nothing. A hard paywall would make you the only product in the category a student cannot try.

### Ads — don't

Two arguments, either sufficient on its own.

**The economics don't work at your scale.** Ad revenue requires enormous volume. A few thousand physio students will generate a rounding error, while the ads themselves suppress the conversion to paid that's actually worth something.

**It contradicts the product.** This is a focus tool for revision. Interrupting a spaced-repetition session with an ad breaks the exact thing you're selling. And "pay to remove ads" anchors your product as something people want *less* of — the wrong frame entirely for a tool students should want to open daily. Note that TeachMeAnatomy advertises "completely ad-free" as a paid feature, which tells you how the category reads ads. It also adds a Play Data Safety declaration, an advertising-ID disclosure and age-rating complications you currently don't have.

### Institutional licensing — the option you didn't list, and the real business

You have already built educator mode: classes, join codes, cohort weakness analytics, student-vs-class accuracy. Nothing in the consumer anatomy market is known to offer this to physio course leads — though see the watchlist, because TeachMeAnatomy is closest to being able to.

A UK physiotherapy cohort is roughly 40–120 students. At £10–12 per student per year, that's **£400–1,400 per cohort per year**, sold once to one course leader, renewing annually, with near-zero marginal cost. Ten courses is £4,000–14,000 a year from ten conversations. Compare that to needing several hundred individual subscribers for the same revenue.

Three further advantages:
- **No platform cut.** Sold B2B outside the app, Apple and Google take nothing. Individual in-app subscriptions on iOS must use Apple's IAP, which is 30% falling to 15% under the Small Business Program.
- **Distribution.** Your background running programmes is the route in. This is a relationship sale, not an app-store-optimisation problem.
- **It compounds.** Each cohort that adopts brings 40–120 students who may keep individual access after graduating.

Kenhub validates the mechanism with bulk-purchase unlock codes redeemed on student accounts, and TeachMeAnatomy validates the institution-managed variant — build the same thing.

### Other options worth considering

- **Exam-term passes.** A 3-month pass priced near the annual rate matches how students actually revise, and captures people who won't commit to a year.
- **CPD tier for qualified clinicians.** Higher price point, no seasonality, and the clinical layer (CR-010) is what makes it saleable. Physiopedia Plus is the incumbent shape here.
- **Referral credit.** Kenhub gives both parties $7 per successful referral. Cheap acquisition in a tightly networked student population.
- **Content licensing is closed to you.** Kenhub sells image licences; you can't, because your renders derive from Z-Anatomy under CC BY-SA and must stay share-alike.

## The licence constraint, stated plainly

You can sell the app. What you cannot do is claim exclusive rights over the Z-Anatomy-derived images — they remain CC BY-SA 4.0, and anyone may redistribute them under the same terms.

This is not a problem, but it does determine where your moat is. **It is not the pictures.** It's the 2,391-question bank, the scheduling algorithm, the cohort analytics, and the educator relationships. Price and pitch accordingly, and don't build a strategy that assumes the imagery is defensible.

## Recommendation

| Tier | Price | Notes |
|---|---|---|
| Free | £0 | One complete area, forever. Not a trial — a real, permanently useful free product. Every competitor has a free tier; you cannot be the exception. |
| Individual monthly | £4.99/mo | For exam-term users who will cancel in August. |
| Individual annual | £29.99/yr | The plan to push. Half the monthly equivalent, and roughly a third of TeachMeAnatomy's £96. |
| Course pass (3 yr) | £39.99–59.99 | **Launch later, not at launch.** See below. Replaces the draft's separate lifetime-unlock idea. |
| Institution | £10–12/student/yr | Minimum 25 seats. Sold direct. **This is the business.** |

### On the multi-year tier

Don't ship it at launch. Its correct price depends entirely on your annual renewal rate, which you won't know until you've been through a full cycle. If retention comes in at 70%, £59.99 is too cheap; at 30% you've lost nothing but learned nothing either. Kenhub and TeachMeAnatomy can both price a lifetime tier because they have years of cohort data behind theirs.

When you do add it, call it a **course pass** rather than lifetime. A physio student needs this for two to three years and then stops, so "lifetime" overstates a liability you'll never actually carry, while a three-year pass priced against the length of the degree is honest and easier to sell. £59.99 is also roughly one anatomy textbook, and roughly a quarter of Kenhub's or TeachMeAnatomy's lifetime price — two comparisons students will make on their own, both of which land in your favour.

**Trial: 7 days, not 3.** Longer trials correlate with stronger conversion, and 55% of 3-day trial cancellations happen on Day 0. Note that both Kenhub and TeachMeAnatomy use a 7-day money-back guarantee rather than a trial; either shape works, but match the 7 days.

**Don't discount publicly.** Apps that show a discount on the main paywall train users to wait and bid against their own full-price offers. Reserve discounts for a post-close offer shown only to people who hit the paywall and didn't convert. (Both Kenhub and TeachMeAnatomy currently show struck-through lifetime prices on their public pricing pages. This is a thing incumbents with brand recognition can afford; you cannot yet.)

**The free tier must deliver the "aha" immediately.** The battle is won or lost in the first session. For you that moment is a locate question answered correctly on a real anatomical render — get a student there inside 90 seconds of opening the app.

---

# Part 2 — Go to market

## The unusual advantage: your market is a list

"Physio students" undersells the market. Every route that produces an MSK practitioner teaches the same 122 muscles, and most of them have *worse* anatomy resources than physiotherapy does, because they're smaller cohorts that the big publishers ignore.

### Tier 1 — Core MSK training routes

| Route | Providers | Notes |
|---|---|---|
| **Physiotherapy** (BSc + pre-reg MSc) | ~52–65 universities, 70–81 courses | Largest cohorts. Most competition for their attention. |
| **Sports therapy** (SST-accredited) | **34 universities** — 34 BSc, 6 MSc, 3 MSci | Plus two international. A single accrediting body with a published list. |
| **Sport rehabilitation** (BASRaT-accredited) | ~20+ universities | BASRaT explicitly frames its graduates as musculoskeletal healthcare professionals, with anatomy and MSK assessment as core content. Registered with the PSA. |
| **Osteopathy** (GOsC-recognised) | **9 institutions** | Anatomy plus 1,000+ hours of clinical training. Small, but anatomy-obsessed. |
| **Chiropractic** (GCC-approved) | **5 institutions** | Four-year degrees, heavy on spinal anatomy. |

That's roughly **120–135 institutions** across Tier 1, and every one of those accreditations comes with a **published list of approved providers**. SST and BASRaT both publish theirs. You don't have to guess who your customers are — the regulators have already compiled the list for you.

> These counts are carried over from the first draft and were **not** re-verified in the September 2026 pass, which covered competitors only. Confirm against the SST, BASRaT, GOsC and GCC published lists before building a target list from them.

### Tier 2 — Adjacent, worth approaching second

- **Podiatry** — MSK lower limb specialists, HCPC-registered, ~13 UK providers
- **Sport & exercise science / S&C** — large cohorts, anatomy modules, lower depth requirement
- **Soft tissue and sports massage therapy** (Level 4–5) — mostly private providers, high volume, no institutional budget but strong individual demand
- **Occupational therapy and paramedic science** — some MSK content
- **FE colleges running BTEC Sport Level 3** — very large volume, feeds Tier 1, and an early-brand-exposure play rather than a revenue one

### Tier 3 — Qualified practitioners

CPD is the non-seasonal revenue. NHS First Contact Practitioner roles have created real demand for demonstrable MSK competency among qualified physios, and osteopaths and chiropractors carry mandatory CPD obligations. This tier needs the clinical layer (CR-010) before it's saleable, but it has no summer trough and a much higher price tolerance. Physiopedia Plus, with 600+ structured CPD modules and society partnerships, is the shape to study before entering.

### Why the smaller routes may convert better

Counter-intuitively, **don't start with physiotherapy.** Sports therapy, sport rehab, osteopathy and chiropractic have smaller cohorts and smaller budgets, but:

- **Less competition for attention.** Kenhub and Complete Anatomy are built and sold for medical students; physio inherits those resources by proximity, but a sports therapy course leader has genuinely fewer options.
- **Fewer decision-makers.** A 40-student sports therapy course is often one course leader's call. A physio school may involve a programme director, a library budget and a procurement process.
- **Tighter accrediting bodies.** SST accredits 34 programmes and BASRaT a similar order. Get adopted by six and word travels through the accreditation network, which physiotherapy has no equivalent of.
- **They are exactly your app's scope.** Their curriculum is MSK. A medical student needs neuroanatomy, embryology and viscera; a sport rehabilitator needs the 122 muscles you've already built.

**Suggested order of attack:** sports therapy and sport rehab first (best fit, least competition, published lists), then osteopathy and chiropractic (small, anatomy-intensive, high willingness to pay), then physiotherapy (biggest prize, hardest sale, and by then you have references).

Each course is 40–120 students per year, every year, renewing.

## The academic calendar dictates everything

Get this wrong and you lose twelve months. Rough UK shape:

| Window | What happens | What you do |
|---|---|---|
| Sep–Nov | Term starts, students settle | Free pilots running; gather usage data |
| **Jan–Mar** | **Budgets set for next academic year** | **The sale. Convert pilots to POs.** |
| Jan & May | Exam periods | Peak individual conversion; peak word of mouth |
| Apr–Jun | Module planning for September | Get listed in module handbooks and reading lists |
| Jul–Aug | Dead. Nobody is reading email. | Build. Don't sell. |

Two consequences. First, the institutional sale has effectively one window a year, so a pilot must be running by autumn to convert in spring. Second, individual subscriptions will spike hard around January and May exams and trough over summer — plan cash flow for it rather than reading August as churn.

## The wedge: free cohort pilots

Don't sell a licence cold. Give a course leader a **free year for one cohort**, then let the product make the case.

The sales asset is the cohort weakness dashboard you already built. A module leader currently has no way to know that 60% of their second years can't distinguish supraspinatus from infraspinatus until they mark the exam. You can show them in week six, while there's still time to reteach it. That is a thing they genuinely want and cannot get anywhere else — not from Kenhub, not from TeachMeAnatomy, not from a textbook.

The pilot ask is small (a join code and one slide in a lecture), the risk is nil, and it generates exactly the evidence that unlocks a budget line in February.

**Target the module leader, not the head of school.** The person who teaches MSK anatomy feels the pain, and in most institutions can either authorise a small resource spend or credibly champion it upward.

### Qualify the incumbent in the first conversation

*Added from Part 0, threat 3.* Before pitching anything, ask:

> "Does the department currently subscribe to Anatomy.tv, Complete Anatomy or TeachMeAnatomy — and do the students actually use it?"

The answer changes the pitch entirely:

- **Anatomy.tv (Primal)** — there is a sunk site-licence budget line and a librarian who chose it. Do not attack it. Position LocusMSK as the retrieval layer on top: Primal shows them the anatomy, you make them recall it, and you tell the module leader who hasn't. The second half of that sentence is the sale.
- **Complete Anatomy** — same logic, plus they may already have educator content tools, so lead harder on cohort analytics rather than on content authoring.
- **TeachMeAnatomy institutional licence** — the hardest case, because it overlaps on question bank, spaced repetition, analytics and channel. Differentiate on MSK-only depth, locate questions on real renders, and the cohort dashboard. Establish early whether their licence exposes cohort-level data to the educator; if it does, this is a fight and you should spend your autumn on a different institution.
- **Nothing, or free Quizlet decks** — the ideal case. Pitch straight from the demo.

## Sequenced plan

**Phase 1 — Prove it works (now to launch)**
- Recruit 2–3 pilot cohorts through people you already know. Warm beats cold every time at this stage.
- Qualify the incumbent in every first conversation, per above.
- Instrument outcomes: sessions completed, structures mastered, and if a course leader will share anonymised marks, performance against non-users. That comparison is the single most valuable sentence in every later pitch.
- Fix what the pilots surface. Early cohorts are research, not revenue.

**Phase 2 — Student-led growth (launch onward)**
- Class join codes are already viral within a cohort — one student sharing a code recruits the group.
- Build a referral credit. Kenhub gives both parties $7 per successful referral, and a physio cohort is a dense enough network that this compounds fast.
- Placement is an under-appreciated vector: students on placement meet students from other universities. A shareable results card exists for this reason.

**Phase 3 — Institutional sale (spring)**
- Work the list in the order above: sports therapy and sport rehab, then osteopathy and chiropractic, then physiotherapy. Prioritise within each by warm connection, then cohort size.
- Lead with the cohort dashboard, not the question bank. Every competitor has questions, and two of them have more than you.
- Offer a departmental pilot as the default first step, never a cold price.
- Once you have three or four adoptions inside one accreditation network, approach **SST and BASRaT directly**. A member benefit or endorsement from an accrediting body reaches every one of their programmes at once, and is worth more than thirty individual approaches.

**Phase 4 — Broader reach (ongoing)**
- Short-form video. Anatomy revision content performs well on TikTok and Instagram, the physio and sports therapy student community is genuinely active there, and your locate questions on real renders are inherently visual. This is the highest-return content channel for this audience by a distance.
- University societies and student rep networks across all five routes, not just physio.
- CSP student community, SST and BASRaT student member networks, and cohort Facebook groups — participate, don't advertise; these communities punish marketing.
- Sports therapy and sport rehab students on placement work alongside physios, S&C coaches and club staff. That cross-pollination is a genuine acquisition channel and costs nothing.

## What not to do

**Don't buy app install ads.** With a £30 annual LTV and education CPIs, the maths does not close. Paid acquisition is for products with proven retention and higher LTV; you have neither yet.

**Don't fight for SEO against Kenhub and TeachMeAnatomy.** They have a decade of domain authority on exactly these keywords, and TeachMeAnatomy claims 12 million users a year. You will spend a year losing. Comparison pages targeting their brand names are the exception — see CR-028 Part 3.

**Don't launch to nobody.** Store page views convert to downloads at 34.4% on Google Play and 18.1% on iOS — but only if anyone sees the page. Have pilot cohorts lined up before you submit, so launch day has actual users rather than being the day you start looking for them.

**Don't market breadth.** You will lose to Complete Anatomy's 17,000 structures, TeachMeAnatomy's 750 3D models and Kenhub's 141 hours of video every time. Market the thing they don't have: MSK depth for physio, spaced repetition that adapts without self-reporting, and cohort analytics for the person teaching the module.

> **Use the Part 0 positioning map as the evidence for this, verbatim.** It is already written, it is sourced, and it makes the argument better than new marketing copy would. It belongs on the educator page (CR-028 Part 3), not in a slide deck you write from scratch.

## The proof you need

Before the spring selling window, you want one defensible sentence: *students who completed N sessions scored X% higher than those who didn't.*

Your analytics can generate it and no competitor is offering it to UK physio course leaders. That sentence is worth more than any amount of copy, and it takes a full academic term to earn — which is the real reason the pilots need to start this autumn.

---

# Part 3 — Roadmap

Written 8 September 2026. UK academic calendar drives everything below.

## The critical insight

**Store launch and market entry are separate events.** The web app already works — 2,391 questions, mobile UI, cohort analytics, class join codes. A free pilot needs none of CR-023, CR-024 or CR-027. A student opens a URL and enters a join code.

If you wait for store readiness before approaching anyone, you pitch in June — the worst month of the year for it — and land in the February 2028 budget round rather than February 2027. A year lost for no reason.

## Timeline

| When | Priority | What |
|---|---|---|
| **Sep, week 1–2** | **P0** | CR-025 (legal/privacy). Hard blocker on pilots — see below. |
| **Sep, week 2–4** | **P0** | Approach course leaders. Sports therapy and sport rehab first. Target 2–3 pilot cohorts before teaching starts. Deploy the educator demo build. |
| Sep–Oct | P1 | CR-028 (name, brand, marketing site). Needed for credibility in pilot conversations, but don't let it delay the approach — a personal email from a named practitioner outperforms a polished website at this stage. |
| Oct–Dec | P1 | Pilots run. Build CR-023 (PWA) and CR-026 (images) alongside. Weekly contact with pilot leads. |
| **January** | — | Exam period. First real usage spike and conversion signal. Second pilot window if September slipped. |
| **Feb–Mar** | **P0** | **The institutional sale.** Budgets set for 2027/28. Outcome data must exist by now. |
| Apr–Jun | P1 | Module handbook listings for September. Build CR-024 (Capacitor) and CR-027 (monetisation). Submit to both stores. |
| Jul–Aug | — | Dead for selling. Polish listings, fix pilot feedback. |
| **Sep 2027** | — | Launch into a new intake with paying institutions and a store presence. |

**Store launch target: summer 2027, aligned to the September 2027 intake. Pilot recruitment starts this month.**

## Why CR-025 gates everything

Not store compliance — UK GDPR. You cannot have named students generating performance data visible to a course leader without a privacy policy, a stated lawful basis and a deletion route. That applies to a free pilot exactly as it does to a paid product, and a university will ask. It is also the smallest CR in the file.

## The one sentence you are building toward

By February you want: *students who completed N sessions scored X% higher than those who didn't.*

Your analytics can produce it, no competitor offers it to UK MSK course leaders, and it takes a full teaching term to earn. That is the real reason pilots start this month rather than next.

## If September slips

January is a workable fallback, but you reach the February budget conversation with one term of data instead of two. Materially weaker. Treat the next three weeks as the deadline.

---

# Part 4 — Brand and commercial site

## The name: LocusMSK

**Decided September 2026.** Working names "Anatomy Revision" and "MSK Atlas Desktop" are retired.

*Locus* is Latin for a place or site — which is exactly the question the app asks. Where is this on the body? That works equally for a muscle, a bone, a landmark, a joint or a tendon, which matters because the app covers 309 structures and only 122 of them are muscles.

This is also why **OINA was rejected as the product name**. Origin, insertion, nerve and action describe muscles alone; bones, landmarks and joints have none of them, and the name would have boxed the product out of its own scope and out of the clinical layer (CR-010). **Keep OINA as the feature name** for OINA Cards (CR-022) — it is precise and well-chosen for the thing it actually describes. A strong feature name inside a broader brand is the right place for it.

### Why "MSK" and not the bare word

The unqualified "Locus" is not available in any practical sense:

- **Locus Map** — a subscription mobile navigation app on Google Play and iOS since 2010, with free and Premium tiers. A subscription app called "Locus" on the same stores is exactly what Apple's guideline 4.1 rejects.
- **Locus Robotics** — a $2B warehouse automation company holding LOCUS trademarks.
- **LocusLabs** — an indoor mapping platform, acquired by Acuity Brands.

Qualifying solves all three at once. Trademark protection is sector-specific, so robotics and outdoor navigation do not block an anatomy education mark in classes 9 and 41. It also clears the store collision and the domain problem.

"MSK" earns its place rather than merely disambiguating — it is the term the entire target market uses, across physiotherapy, sports therapy, sport rehabilitation, osteopathy and chiropractic. Eight characters, so no home-screen truncation.

### Store listing

```
Name:     LocusMSK
Subtitle: Anatomy revision for MSK students
```

Brand carries memorability; the 30-character subtitle carries description and search keywords. Kenhub is not called AnatomyQuiz. Optimise the two separately — the subtitle is what actually drives store search, so treat those 30 characters as a keyword decision, not a tagline.

### One flag to test

In health sciences, "locus" most commonly means a position on a chromosome — it is genetics vocabulary first. The general Latin sense is correct and the "MSK" qualifier resolves it immediately in context, but test the name on a handful of students and one academic before registering. If people hesitate, that is worth knowing now rather than after the trademark filing.

### Clearance checks — run all four on "LocusMSK", not on "Locus"

1. UK IPO trademark search, classes 9 (software) and 41 (education)
2. Domains: locusmsk.com and locusmsk.co.uk
3. App Store and Play Store name search — guideline 4.1 rejects confusingly similar names
4. Companies House, if incorporating

Register the mark once cleared and in use, before store submission. A registered mark is your defence if someone files against you later.

### Rename scope

The name appears in `index.html` (title), `package.json`, the README, the PWA manifest (CR-023), store listings, and throughout the marketing site. Do the rename as one commit before CR-023, so the manifest and icon set are generated under the final name rather than migrated afterwards.

## Logo

Brief it, don't over-invest. £200–500 on a competent freelancer beats both a DIY logo and a £3,000 brand agency at this stage.

- Must work at 48px (favicon) and as a maskable 512px app icon on both light and dark backgrounds
- Avoid anatomical illustration in the mark. Every competitor uses a muscle or skeleton; it reads generic and it renders as mush at small sizes.
- Deliverables: SVG master, full icon set for CR-023, and a one-page usage guide

## The commercial site

**Build it separately from the app.** A static site (Astro or plain HTML) on its own Netlify deploy. Reasons: the app is a client-rendered SPA that search engines see as an empty shell — you cannot do SEO from inside it — and you do not want marketing changes triggering app rebuilds.

Structure:
```
locusmsk.com          marketing site (static)
app.locusmsk.com      the existing Vite SPA
demo.locusmsk.com     the educator demo build
```

## Two audiences, two demos — and one already exists

**Students** don't want a demo, they want the product. Send them straight to the free area with no sign-up. The paywall handles the rest.

**Course leaders** need to see the cohort dashboard populated with realistic data — an empty dashboard sells nothing.

**You have already built this.** `vite --mode educator-demo` produces a fully seeded educator experience from `src/features/educator/demo/`. Deploy that build to `demo.locusmsk.com` as a separate Netlify site from the same repo, no auth, sample cohort loaded. It becomes the single link you put in every approach email. This is close to zero work for your highest-leverage sales asset — do it before the marketing site.

---

# Part 5 — Change requests

| ID | Title | Priority | Effort | Depends on |
|---|---|---|---|---|
| CR-023 | PWA foundation and offline revision | P0 | L | — |
| CR-024 | Capacitor native shell and review notifications | P0 | L | CR-023 |
| CR-025 | Legal, privacy and store compliance | P0 | M | — |
| CR-026 | Image coverage completion; retire AI illustrations | P1 | L | — |
| CR-027 | Monetisation: entitlements, paywall, institutional licences | P1 | L | CR-025 |
| CR-028 | Demo deploy, brand and commercial site | P1 | M | — |

Order by calendar, not by number: **CR-025 first** (gates pilots), then CR-028's demo deploy (one command), then CR-023 → CR-026 → CR-024 → CR-027. See Part 3.

---

# CR-023 — PWA foundation and offline revision

**Priority P0 · Effort L**

**Why.** The app is a Vite SPA with no manifest, no service worker and no icons. Beyond store requirements, offline is the single most valuable missing feature for the actual audience: physio students revise on placement, on public transport and in hospital basements with no signal. TeachMeAnatomy already advertises offline storage of everything, so this is a parity feature as well as a product one. Build it as a product feature and the compliance benefit follows.

```
Convert this Vite 6 + React 19 + TypeScript app into an installable, offline-capable PWA.

CURRENT STATE
- Vite 6 SPA deployed to Netlify. public/ contains only _redirects and anatomy/.
- No manifest, no service worker, no app icons, no offline handling anywhere.
- index.html loads Newsreader, IBM Plex Sans and IBM Plex Mono from the Google Fonts CDN.
- 4.2MB of WebP under public/anatomy/ across atlas/, panels/, regions/ and figure/.
- Firebase 11 for auth and Firestore. Content (309 structures, 50 images, 2,391 questions)
  is entirely static in seed modules and never fetched from Firestore.
- Build output: index chunk 804kB (198kB gzip), plus lazy chunks for AdminApp,
  EducatorApp, HotspotEditorApp and ActiveUsersChart.

WHAT TO BUILD
1. SELF-HOST THE FONTS. Download the three families, serve from public/fonts/, and
   remove the Google Fonts <link>. Two reasons: the CDN request fails offline and blocks
   first paint, and transferring user IP addresses to Google has been found to breach
   GDPR in EU case law. Use font-display: swap and preload the two weights used above
   the fold.

2. WEB APP MANIFEST at public/manifest.webmanifest:
   name, short_name ("LocusMSK"), start_url "/", display "standalone",
   background_color and theme_color drawn from the existing CSS custom properties in
   src/index.css, and icons at 192, 256, 384 and 512px plus a maskable 512px variant.
   Add apple-touch-icon and theme-color meta tags to index.html, and a real description
   meta tag — there is currently none.

3. SERVICE WORKER via vite-plugin-pwa with Workbox:
   - Precache the app shell, JS, CSS and fonts.
   - Runtime-cache /anatomy/** images with CacheFirst and a 30-day expiry.
   - NetworkFirst for Firestore, falling back to cache.
   - An update prompt when a new version is available; do not silently reload mid-session
     and lose a student's answers.

4. OFFLINE REVISION — the actual feature.
   - Enable Firestore offline persistence (persistentLocalCache with multi-tab support)
     so attempts, mastery and session summaries queue locally and sync on reconnect.
     Verify the existing repository layer tolerates a write that resolves from cache.
   - An explicit "download for offline" action per area, precaching that area's images.
     Show size before download and allow removal.
   - An offline indicator in the shell, and grey out actions that genuinely require the
     network (sign-in, class join) rather than letting them fail silently.
   - Because all content is static in the bundle, questions already work offline once the
     shell is cached. Make sure nothing in the session path awaits a Firestore read
     before rendering a question.

5. BUNDLE. Split the 804kB index chunk — Firebase is the bulk of it. Configure
   manualChunks so firebase/auth and firebase/firestore are separate, and lazy-load
   Firestore so a student can start revising before it resolves.

CONSTRAINTS
- Offline must degrade gracefully, never blank-screen. A white screen on lost connection
  is the exact failure mode app reviewers look for.
- Do not cache Firebase auth tokens in the service worker.
- All 428 existing tests must pass. Add tests for the offline queue-and-sync path.

ACCEPTANCE
- npm run build passes; Lighthouse PWA audit passes installability.
- With the network disabled after first load, a full revision session can be completed
  and the results sync when the connection returns.
```

---

# CR-024 — Capacitor native shell and review notifications

**Priority P0 · Effort L · Depends on CR-023**

**Why.** Minimum functionality (guideline 4.2) is the most common App Store rejection reason, and Apple uses it specifically to filter out web wrappers. A wrapper with no native integration gets rejected; one with genuine native capability does not. Note that this bar is real — developers have been rejected even with offline downloads and push notifications, on the grounds the app didn't differ enough from the website. Ship real native capability, and say so explicitly in the review notes.

```
Package this Vite 6 + React 19 PWA as native iOS and Android apps using Capacitor, with
genuine native functionality rather than a webview wrapper.

CURRENT STATE
- Installable PWA with service worker and offline support (CR-023 complete).
- Firebase 11 auth (Google + email/password) and Firestore.
- react-router-dom 7; routes include /, /study, /session, /atlas, /structure/:id,
  /progress, /account, /achievements, /admin/*, /educator/*.
- Mobile UI already exists as React components under components/mobile/ with a
  MobileTabBar and MobileShell.

WHAT TO BUILD
1. Capacitor with ios/ and android/ projects. Bundle the web assets locally — do NOT
   point a webview at the Netlify URL. An app that loads a remote URL and does nothing
   else is the definition of the rejection case.

2. NATIVE CAPABILITIES — each of these must be genuinely functional, not stubs:
   - LOCAL NOTIFICATIONS for due reviews, scheduled from the existing mastery data.
     This is the strongest single justification: the website cannot remind a student that
     14 structures are due this morning. Schedule locally so it works offline. Include a
     settings screen for time-of-day and opt-out.
   - OFFLINE AREA DOWNLOADS backed by the native filesystem rather than the browser
     cache, so they survive storage pressure. Show downloaded size and allow removal.
   - NATIVE STATUS BAR, SPLASH SCREEN and safe-area insets.
   - HAPTIC FEEDBACK on answer submission — small, but it is the kind of thing reviewers
     register as native.
   - SHARE SHEET for sharing a structure or a results card.
   - BIOMETRIC UNLOCK is optional; skip unless it is quick.

3. NATIVE AUTH. Use Capacitor's Firebase Authentication plugin so Google sign-in uses the
   native flow rather than a web popup. Sign in with Apple is REQUIRED on iOS if you offer
   any third-party sign-in.

4. Hide /admin/* and /educator/* from the native builds unless you intend to ship them.
   Unreachable UI in a binary can trigger a hidden-features rejection under 2.3.1.

5. REVIEW NOTES. Write a REVIEW-NOTES.md listing every native capability with the exact
   steps to exercise it, plus a demo account with seeded progress. Reviewers reject what
   they cannot find. State plainly what the app does that the website cannot.

CONSTRAINTS
- Keep one codebase. No forked native UI.
- Never load remote code at runtime; Apple's guideline 2.5.2 prohibits executing code
  review has not inspected.
- Test on a real device, not only a simulator.

ACCEPTANCE
- Both platforms build and run from a clean checkout.
- A due-review notification fires with the device in airplane mode.
- A downloaded area is fully revisable offline after a cold app start.
```

---

# CR-025 — Legal, privacy and store compliance

**Priority P0 · Effort M**

**Why.** There is no privacy policy anywhere in the codebase, and you collect authenticated student performance data that educators can view. Both stores require a published policy. Apple additionally cross-references the data types you declare against the access patterns it detects in the binary, so an inaccurate declaration is itself a rejection under 5.1.1.

```
Add the legal and privacy infrastructure this app needs before app store submission.

CURRENT STATE
- Firebase Auth (Google, email/password, anonymous) and Firestore storing per-user
  attempts, mastery, session summaries and profiles.
- An educator feature where class owners view named students' accuracy and weakest
  structures.
- No privacy policy, terms of service, cookie notice or data-deletion path anywhere.
- Images carry per-asset credit and licence fields: 36 are 'CC BY-SA 4.0' (Z-Anatomy),
  14 are 'All rights reserved' (AI-generated). AttributionBadge.tsx renders these.
- Muscle content derives from "ALL_Muscles_of_the_body.pdf" by Vinnie Maynard, Salford.

WHAT TO BUILD
1. PRIVACY POLICY at /privacy, publicly reachable without sign-in and linked from the
   footer, account screen and both store listings. It must state: what is collected
   (email, display name, answer-level performance data, device identifiers), the lawful
   basis under UK GDPR, that class owners can see named performance data for students who
   join their class, retention periods, third-party processors (Google Firebase), and
   how to exercise access, rectification, erasure and portability rights.

2. TERMS OF SERVICE at /terms. Must include a clear statement that the app is an
   educational revision tool and not a clinical or diagnostic resource, and carries no
   warranty of anatomical accuracy for clinical decision-making.

3. ACCOUNT DELETION, in-app, reachable in at most two taps from the account screen. Both
   stores require this for any app with account creation. It must delete the profile,
   attempts, mastery, session summaries and class membership, not merely deactivate.
   Implement server-side so it cannot be partially completed.

4. DATA EXPORT — a JSON download of the user's own data. Cheap to build alongside
   deletion, and it satisfies portability.

5. EDUCATOR CONSENT. Joining a class must present, before joining, exactly what the class
   owner will be able to see. Leaving must be one action and must stop further visibility.
   Educators must see aggregate and summary performance, never a keystroke-level record of
   an individual's session.

6. AGE. Set an appropriate age rating (17+ / Teen) and add a date-of-birth or
   over-16 confirmation at sign-up. If under-16s can register you inherit UK GDPR
   children's provisions and Google Play Families policy; avoid that deliberately rather
   than by accident.

7. ATTRIBUTIONS PAGE at /attributions listing every image credit and licence, the
   Z-Anatomy attribution with a link to the source and the CC BY-SA 4.0 deed, the muscle
   dataset source, and open-source licences. CC BY-SA requires attribution and
   same-licence redistribution — a licence field rendered on a badge is not sufficient on
   its own for a shipped commercial product.

8. Prepare the Play Data Safety declaration and Apple privacy labels as a checked-in
   markdown file so they match the code rather than being filled in from memory at
   submission.

ACCEPTANCE
- /privacy, /terms and /attributions render without authentication.
- Account deletion removes every trace of a test user from Firestore, verified by query.
```

---

# CR-026 — Image coverage completion; retire AI illustrations

**Priority P1 · Effort L**

**Why.** Image coverage regressed from 9 unimaged structures to 68 — 44 muscles, 23 joints, 1 bone — as AI atlas slides were retired without full replacement. Separately, 14 AI-generated images remain. Apple's 2026 guidance requires AI-generated content to include moderation and follow IP rules, and for an app teaching muscle attachments, AI anatomy is the content most likely to be confidently wrong.

**Escalated by Part 0.** This is a competitive necessity, not polish. Every Tier 1 competitor leads with visuals, and TeachMeAnatomy ships 750+ 3D models and 120+ dissection images at £8/month. Image coverage is what a student judges in the first thirty seconds, and the quality bar is a Visible Body screenshot.

```
Complete image coverage and remove the remaining AI-generated illustrations from this
anatomy app.

CURRENT STATE
- 309 structures, 50 images. 68 structures have no linked image: 44 muscles, 23 joints,
  1 bone. Joints are a newer category and have no imagery at all.
- 36 images are Z-Anatomy renders (CC BY-SA 4.0); 14 remain AI-generated, credited
  'Rory Neary (AI-generated illustration)' / 'All rights reserved'.
- The Z-Anatomy Blender pipeline is working and documented, having produced the 15
  region renders in public/anatomy/regions/ at 1400x1400.
- Hotspots exist on 15 images totalling 107 structure-polygons; locate generates 107
  questions.
- lib/linkImages.ts auto-links via name and alias matching against panelStructureNames.
  Never hand-edit imageIds.

WHAT TO BUILD
1. Run the existing pipeline for the 44 uncovered muscles. Match the established render
   settings so the library stays visually consistent.

2. JOINTS need a different treatment from muscles — an articulation is a relationship
   between bones, not an isolated object. Render each joint showing its articulating
   surfaces with the relevant ligaments, from the view that best shows the articulation.
   Decide and document the convention before rendering 23 of them.

3. Retire each of the 14 AI images as a Z-Anatomy equivalent lands. Where no equivalent
   is practical, remove the image rather than shipping it — a structure with no image
   degrades gracefully; one with a wrong image teaches something false.

4. Author hotspots for every new render via the existing editor so locate coverage grows
   with image coverage. Target: locate questions for the substantial majority of the 122
   muscles.

5. Re-run the audit afterwards and record the numbers in the README: structures without
   images, images by licence, questions by type.

CONSTRAINTS
- Every new image needs accurate credit and licence fields — 'Z-Anatomy
  (https://github.com/Z-Anatomy/Models-of-human-anatomy)' and 'CC BY-SA 4.0'.
- Run npm run validate-content after integration.

ACCEPTANCE
- Zero structures with no linked image, or a documented list of deliberate exceptions.
- Zero images with licence 'All rights reserved'.
- npm run test, npm run build and npm run validate-content all pass.
```

---

# CR-027 — Monetisation: entitlements, paywall and institutional licences

**Priority P1 · Effort L · Depends on CR-025**

**Why.** See Part 1. The individual subscription pays the bills; the institutional licence is the business. Build the entitlement layer once so both routes and all future pricing experiments run through it.

```
Add monetisation to this Vite 6 + React 19 + Firebase 11 anatomy app, supporting both
individual subscriptions and institutional licences.

CURRENT STATE
- Firebase Auth with real accounts; users/{uid} profile documents with a cohort field.
- Educator feature with classes, join codes and cohort analytics already built.
- Admin section gated by a Firebase custom claim { admin: true }.
- Content is 309 structures across five areas, entirely static in seed modules.
- Deployed as a web app; native builds via Capacitor are planned (CR-024).

WHAT TO BUILD
1. ENTITLEMENT LAYER — build this first and route everything through it.
   An `entitlement` on the user document: { tier, source, expiresAt, seatId }, where tier
   is 'free' | 'individual' | 'institutional' and source is 'web' | 'apple' | 'google' |
   'licence'. A single useEntitlement() hook and a matching Firestore rules helper.
   Every gate in the app checks the entitlement, never the payment provider. This is what
   lets you change pricing, run experiments and add providers without touching feature
   code.

2. FREE TIER — one complete area, permanently free, with every question type available
   within it. Not a trial and not a crippled demo. Students explore and return before
   committing, and a genuinely useful free product is what earns the return visit. Every
   competitor in the category has a free tier; you cannot be the exception.
   Make the area configurable rather than hardcoded.

3. PAYWALL, triggered on reaching locked content, never mid-session — do not interrupt a
   student part-way through answering. Plans: monthly, annual (default-selected and
   marked best value), and a three-year course pass once retention data justifies it.
   Show the annual saving against monthly.
   7-day free trial, not 3 days.
   Do NOT display a discount on the main paywall; implement a post-close offer shown only
   to users who dismissed it without converting.

4. WEB PAYMENTS via Stripe Checkout with a webhook (Cloud Function) writing the
   entitlement. Handle renewal, cancellation, payment failure and refund events. Never let
   the client write its own entitlement — enforce in Firestore rules.

5. NATIVE PAYMENTS. On iOS and Android, in-app subscriptions MUST use platform IAP;
   Apple's guideline 3.1.1 makes this mandatory for digital goods and Stripe is not
   permitted for it. Use RevenueCat to normalise both stores and reconcile with the same
   entitlement document. Register for Apple's Small Business Program — 15% rather than
   30% below $1M annual revenue.

6. INSTITUTIONAL LICENCES — the highest-value part.
   - A licences collection: { id, institution, seats, seatsUsed, validFrom, validUntil,
     code, ownerEmail }.
   - Redemption: a student enters the code in account settings, which grants the
     institutional entitlement for the licence period and increments seatsUsed. Refuse
     when seats are exhausted.
   - Admin screens to issue, extend, revoke and monitor licences, showing seat usage.
   - Auto-link redeemers to the institution's class where one exists, so cohort analytics
     populate without the educator chasing anyone.
   - Sold direct and invoiced outside the app, so no platform commission applies.

7. Do not build ads, an ad-removal purchase, or any ad SDK.

CONSTRAINTS
- Entitlement writes are server-side only, enforced in firestore.rules.
- The app must remain fully usable offline for an entitled user; do not gate content
  behind a network check that fails on a train.
- A lapsed subscriber keeps their history and their free area — never delete progress.
- Add Vitest coverage for entitlement resolution, including expiry, seat exhaustion and
  the precedence rule when a user holds both an individual and an institutional
  entitlement.

ACCEPTANCE
- npm run test and npm run build pass.
- A user with no entitlement can complete a full session in the free area and is
  paywalled on a second area.
- A licence code grants access, increments seat usage, and is refused when seats run out.
```

---

# CR-028 — Demo deploy, brand and commercial site

**Priority P1 · Effort M**

**Why.** Three separable pieces, listed in order of value per hour. Do part 1 this week — it is close to zero work and it is the asset every pilot approach depends on. Parts 2 and 3 can follow through October.

## Part 1 — Deploy the educator demo (do first, today if possible)

```
Deploy the existing educator demo build of this Vite 6 + React 19 app as a standalone
public site.

CURRENT STATE
- package.json has "dev:educator-demo": "vite --mode educator-demo".
- src/features/educator/demo/ contains demoData.ts, cohortsRepository.demo.ts,
  cohortAnalytics.demo.ts, assignmentsRepository.demo.ts, authDemo.ts, adminDemo.tsx and
  RequireEducator.demo.tsx — a fully seeded educator experience requiring no Firebase.
- vite.config.ts and src/vite-env.d.ts already branch on the educator-demo mode.
- The app deploys to Netlify from this repo.

WHAT TO BUILD
1. A production build script for the demo mode (e.g. "build:demo": "vite build --mode
   educator-demo --outDir dist-demo") and a second Netlify site pointed at the same repo
   with that build command, served at demo.locusmsk.com.
2. Verify no Firebase credentials are required and no real user data is reachable. This
   site will be public and unauthenticated — check that admin routes are absent from the
   demo build, not merely hidden.
3. Seed data must be realistic and defensible: plausible cohort size (40-80), a believable
   accuracy spread, and confusion pairs that a real MSK educator would recognise
   (supraspinatus/infraspinatus, the wrist extensors, the hamstring group). An obviously
   fake dashboard undermines the pitch it exists to support.
4. A dismissible banner making clear this is sample data.
5. Add a "reset demo" action so a visitor who clicks through everything can start over.

ACCEPTANCE
- The demo site loads with no authentication and no Firebase project configured.
- No route in the demo build can reach real Firestore data.
```

## Part 2 — Trademark and logo

Not a coding task. Sequence:

1. Name decided: **LocusMSK**. See Part 4 for rationale.
2. Clear it: UK IPO trademark search (classes 9 and 41), locusmsk.com and locusmsk.co.uk, App Store and Play Store name search, Companies House.
3. Commission the logo (£200–500). Brief: works at 48px and as a 512px maskable icon, light and dark; no anatomical illustration — every competitor uses a muscle or skeleton and it renders as mush at small sizes; SVG master plus full PWA icon set for CR-023. A mark built on the idea of a located point or site suits the name.
4. Rename the codebase in one commit BEFORE CR-023, so the PWA manifest and icon set are generated under the final name rather than migrated afterwards.
5. Register the trademark once the name is cleared and in use. Do this before store submission — Apple rejects confusingly similar names under guideline 4.1, and a registered mark is your defence if someone else files first.

## Part 3 — Commercial site

```
Build a static marketing and commercial site for this MSK anatomy revision app.

CONTEXT
- The app is a Vite 6 + React 19 SPA deployed on Netlify. It renders client-side, so
  search engines see an empty shell — SEO cannot be done from within it. This site must
  be separate and statically rendered.
- An educator demo is deployed at demo.locusmsk.com (Part 1).
- Target domains: locusmsk.com for marketing, app.locusmsk.com for the SPA.

WHAT TO BUILD
A static site using Astro (or plain HTML if simpler), deployed as its own Netlify site.

1. PAGES
   - Home: what it is, who it's for, primary CTA to try the free area, secondary CTA to
     the educator demo.
   - For students: question types, spaced repetition, offline, pricing.
   - For educators: the cohort dashboard, pilot offer, link to demo.<domain>, contact form.
     This page matters more than the student one — it is what you send course leaders.
     PUT THE PART 0 POSITIONING MAP ON THIS PAGE, largely verbatim. It is already written
     and sourced, and it makes the "we are not trying to be Complete Anatomy" argument
     better than new copy would.
   - Pricing: the tiers from Part 1 of this document, with institutional as "contact us"
     rather than a listed price. Never publish a discount here.
   - Legal: privacy, terms, attributions. These can link through to the app's own pages
     (CR-025) rather than being duplicated.

2. TWO DISTINCT AUDIENCES. Students want to start immediately — send them straight into
   the free area with no sign-up. Educators want evidence and want to talk to a person.
   Do not funnel both through the same CTA.

3. PAYMENTS. Stripe Checkout for individual plans, writing entitlements via the CR-027
   webhook. Institutional licences are a contact form and an invoice, not a checkout —
   universities pay by purchase order, and a card-only flow will lose the sale. Route
   institutional enquiries to email with cohort size and institution captured.

4. SEO. Server-rendered or static HTML, real meta descriptions, Open Graph images, a
   sitemap. Target long-tail MSK terms rather than competing with Kenhub and
   TeachMeAnatomy on head keywords — "muscles of the rotator cuff quiz" is winnable,
   "anatomy quiz" is not.
   COMPARISON PAGES ARE THE EXCEPTION AND ARE WORTH WRITING: "LocusMSK vs Kenhub",
   "LocusMSK vs TeachMeAnatomy", "best anatomy app for physiotherapy students". These
   rank for competitor-brand long-tail terms, which is winnable in a way head keywords
   are not, and the Part 0 research is the source material. Be scrupulously accurate
   about competitor prices and features and date every claim — these pages age badly and
   an out-of-date comparison damages credibility more than no page at all.

5. Keep it small. Five pages done well beats twenty. The demo site and a personal email
   do more selling than any amount of marketing copy at this stage.

ACCEPTANCE
- Lighthouse SEO and performance above 90.
- A student can reach a working question within two clicks of the homepage.
- An educator can reach the populated demo dashboard within one click.
```
