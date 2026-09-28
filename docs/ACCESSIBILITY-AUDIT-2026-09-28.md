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

## Still open

1. **MCQ options don't expose which is chosen, and arrow keys do nothing** (4.1.2).
   Options are plain buttons; make them a radiogroup on desktop and phone.
2. **Every route is titled "LocusMSK"** (2.4.2). Set `document.title` per route.
3. **Landmarks and headings** (1.3.1): no `<main>`/`<nav>` at phone width
   (`MobileShell.tsx`), the tab bar is a `<div>` with no `aria-current`, the legal
   and pricing pages have no `<main>`, and app routes have no `<h1>`.
4. **The plate viewer's label is ignored**: a `<div aria-label>` with no role.
   `role="img"` is wrong here — it would hide the zoom and turn controls inside
   it (tried; five viewer tests caught it). Give the picture itself the label,
   or wrap the viewer in a labelled `role="group"`.
5. **Locate questions have no non-visual route.** A decision, not a bug: offer an
   alternative question for the same structure, or state the limitation.
6. **Long descriptions for plates** — none yet.
7. **The contrast script's blind spot**: it treats `--acc` on the page as
   non-text only, so small text in `--acc` passes it. Add a text check for
   `--acc` or forbid it for text under 18px.
8. **Focus ring on the pale selected-chip background** is about 3.1:1 —
   marginal; check by eye.
9. Phone keyboard pass, and a pass with NVDA and VoiceOver.

Raw scan output (not in the repo): the session scratchpad `a11y/` folder —
`results.json`, `results-session.json`, `structure.txt`, `contrast.txt`.
