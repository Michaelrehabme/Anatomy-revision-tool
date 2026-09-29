# Accessibility audit — 28 September 2026

First pass towards WCAG 2.1 AA (walkthrough card 6). Automated scan plus a manual
keyboard and screen-reader-semantics pass. **Not** a full conformance audit: no
real screen reader was driven, and the phone keyboard pass was not done.

## Method

- axe-core 4.10.2, tags `wcag2a wcag2aa wcag21a wcag21aa`, 58 scans: 11 routes
  (`/`, `/study`, `/study/setup`, `/atlas`, `/progress`, `/account`, `/pricing`,
  `/structure/deltoid`, `/onboarding`, `/sources`, `/privacy`) plus an MCQ and a
  typed-answer question before and after checking, at 1440×900 and 390×844, in
  light and dark.
- Keyboard-only pass on desktop: setup → one MCQ → rating.
- Live-region, landmark and heading inspection.
- `npm run check:contrast` (passes all four themes; see its gap below).

## Fixed on 28 Sep

| Finding | WCAG | Fix |
|---|---|---|
| Right/wrong announced only after the confidence rating on desktop, never on phone | 4.1.3 | The verdict takes focus as it appears (`shared/FeedbackHeading.tsx`), read with the right answer; the phone feedback sheet does the same |
| Focus dropped to `<body>` after Begin, Check answer and rating | 2.4.3 | Verdict focus as above; the session screens put focus back on the question when it is lost (`shared/useRecoverFocus.ts`), never stealing it from a typed-answer box |
| Phone spaced-repetition switch had no name, role or state | 4.1.2 | `role="switch"`, `aria-checked`, labelled by its text |
| High contrast switch had no name | 4.1.2 | Labelled by its text (51fad6c) |
| `aria-pressed` on a number input (custom session length) | 4.1.2 | Removed |
| Phone setup chips (length, session type, timer) had no state | 4.1.2 | `aria-pressed`, as desktop already had |
| 10px uppercase labels in `--acc` at 3.46:1 | 1.4.3 | `--accd` (5.51:1) everywhere that pattern appears, phone twins included |
| Atlas filter counts dimmed to 3.2–4.0:1 by opacity | 1.4.3 | Opacity removed |
| Links in body text distinguished by colour alone (1.34:1 light, 1.06:1 dark) | 1.4.1 | Links inside `p`, `li`, `dd`, `td` are underlined (`src/index.css`) |

## Fixed on 29 Sep

| Finding | WCAG | Fix |
|---|---|---|
| Chosen MCQ option not exposed; arrow keys did nothing | 4.1.2 | `aria-pressed` on each option in a labelled group; arrows move focus between options without choosing (`shared/arrowFocus.ts`) — choosing on the phone submits, so an arrow that selected would answer by accident |
| Every route titled "LocusMSK" | 2.4.2 | `shared/PageTitle.tsx` names every route, legal pages included; a structure card names itself ("Deltoid · LocusMSK") |
| No `<main>`/`<nav>` at phone width; nothing marked the current page | 1.3.1 | Phone shell content is `<main>`, the tab bar a labelled `<nav>`; both navs set `aria-current="page"`; the full-screen phone pages and the legal layout are `<main>` |
| Plate viewer's label ignored | 4.1.2 | A labelled `role="group"` — not `img`, which would hide the controls inside it |
| Contrast script let small text in `--acc` through | 1.4.3 | A test fails if any component sets `--acc` as a text colour (`lib/__tests__/contrast.test.ts`) |
| App routes had no `<h1>` | 1.3.1 | The page names (Atlas, Progress, Account, Achievements) and a structure card's name are the page's `<h1>`, desktop and phone |

## Still open

1. **Locate questions have no non-visual route.** A decision, not a bug: offer an
   alternative question for the same structure, or state the limitation.
2. **Long descriptions for plates** — none yet.
3. **Focus ring on the pale selected-chip background** is about 3.1:1 —
   marginal; check by eye.
4. Phone keyboard pass, and a pass with NVDA and VoiceOver.

Raw scan output (not in the repo): the session scratchpad `a11y/` folder —
`results.json`, `results-session.json`, `structure.txt`, `contrast.txt`.
