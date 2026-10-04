# Accessibility audit — 4 October 2026

Second pass towards WCAG 2.1 AA, following
[ACCESSIBILITY-AUDIT-2026-09-28.md](ACCESSIBILITY-AUDIT-2026-09-28.md). Three
of that document's open items: the keyboard pass (desktop **and** phone
width), what locate offers without sight
([accessibility-locate.md](accessibility-locate.md) — a proposal, undecided),
and long descriptions for the plates.

**Still not done, and not claimed:** a run with a real screen reader. Everything
below about what a screen reader "is given" is the accessibility tree read back
by script, not NVDA or VoiceOver speaking.

## Method

- A production build (`vite build`, `VITE_PERSISTENCE=local`, so no Firebase)
  served locally and driven in Chromium by Playwright using **keyboard input
  only** — Tab, Shift+Tab, Enter, Space, arrows, Escape. No clicks. At
  1440×900 and at 390×844 (touch, mobile UA). The dev server is not usable for
  this: under React StrictMode the end of a session redirects to Today instead
  of the results page, which a production build does not do.
- At each stop: is it reachable, what is its accessible name and state, does
  it have a focus indicator (computed `outline` / `box-shadow`, plus
  screenshots), and where is focus after the action.
- axe-core 4.10.2 (`wcag2a wcag2aa wcag21a wcag21aa`) on every question type
  before and after answering, the results page, and each route visited.
- Every question format through a whole session to the results page: multiple
  choice (identify, facts, clinical, blood supply), type answer (including
  ligament attachment boxes), flashcard, multi-select, locate, OINA cards
  (learn card, select, typed), in Study mode and in Exam mode.
- Rotate, zoom and reset on the viewer; Hard / Medium / Easy by Enter and by
  Space.
- Atlas (filters, search, opening and leaving a card), Account (theme, high
  contrast), the locked-area and pricing path, onboarding, End session.
- `prefers-reduced-motion`: running Web Animations counted on three routes
  with the preference off and on.

**Not reached in a browser:** fill-the-blank (in no picker — fixed by reading,
see below); the update prompt (needs a second deployed service worker); the
diagnostic (gated in local mode); account deletion's confirmation row and the
signed-in half of checkout (no auth in local mode). These four are assessed
from the code only.

## Findings

Result is for the build **before** this branch's fixes. "Fixed" means fixed
here and re-run in the browser; every fix has a test.

| Screen / question type | Result | What was wrong | Fixed or recommended |
|---|---|---|---|
| Identify pictures — multiple choice, type answer, flashcard front (both widths) | **Fail** 1.1.1, and it broke the question | The picture's accessible name and `alt` were its title, which begins with its subject: on "Which structure is shown?" a screen reader was given "Deltoid — Anterolateral View (highlighted)" | **Fixed.** `lib/plateLabel.ts`: while the name is the answer the picture is "Anatomy image — anterolateral view, 300°". Never revealed in an exam |
| Multi-select and OINA select (both widths) | **Fail** 4.1.2, 1.3.1 | Options exposed no chosen/not-chosen state (the only signal was a "✓" glyph that became part of the name), sat in no group, and ignored the arrow keys multiple choice answers to | **Fixed.** `aria-pressed`, a named group, arrows move focus, the glyph is hidden from the name |
| Multi-select, checked (both widths) | **Fail** 1.4.1 | Which options were right was shown by border colour and dash alone | **Fixed.** Each option says "(correct)", "(correct, not chosen)" or "(wrong)" as hidden text |
| Multi-select, desktop | **Fail** 2.4.3, 4.1.3 | Check answer left focus on the page body; the verdict was a `<span>` and was never read | **Fixed.** The verdict is the focused heading, as in every other format |
| Locate from the list (both widths) | **Fail** 2.4.3 | Answering disabled every button and dropped focus to the body | **Fixed.** Verdict takes focus (desktop; the phone sheet already did) |
| Locate from the list (both widths) | **Fail** — gives the answer | Names were in hotspot order, which is target-first on every muscle and ligament plate: the right answer was always the first button | **Fixed.** Alphabetical |
| Locate from the list — landmark and joint plates | **Fail** — gives the answer | 212 of 586 locate questions offer a list of one name | **Recommended** — see accessibility-locate.md (options A/B) |
| Locate on the picture | **Fail** 2.1.1 for the picture itself | The picture cannot be operated from a keyboard; it had `role="button"` but could not be focused. The list is the only keyboard route and is a different exercise | Role corrected to `group` (**fixed**); a keyboard crosshair **recommended** (option C) |
| Locate toggle, desktop | **Fail** 2.5.3 | Visible "Answer from a list instead", accessible name "Answer from a list of names instead of…" — the name did not contain the label, so voice control could not press it | **Fixed** |
| Locate toggle and list, phone | **Fail** 1.3.1 | No hidden note that a list route exists; list was not a group | **Fixed** |
| Flashcard and OINA learn card (both widths) | **Fail** 2.4.3 | Reveal moved focus to the question wrapper ("Question 3 of 10"), not the answer | **Fixed.** Focus goes to the answer text |
| Viewer — rotate, tilt, zoom (both widths) | Pass, one **fail** 2.4.3 | All reachable, named, ringed. "Reset zoom" removed itself and took focus to the body | **Fixed.** Focus returns to Zoom in |
| Results page (both widths) | **Fail** 2.4.3, 1.3.1 | Opened with focus on the body and no heading: nothing announced the score | **Fixed.** "Session complete" is the `<h1>`, takes focus, reads "7 of 10 correct" |
| Atlas → card → back; "Unlock every region" (both widths) | **Fail** 2.4.3 | Each navigation left focus on the body; on desktop that is five nav buttons to tab past again | **Fixed.** `shared/useRouteFocus.ts`: when a navigation loses focus it goes to the new page's `<h1>` |
| Atlas filter drawer, phone | **Fail** 2.4.3 (says `aria-modal`, was not) | Tab walked out of the dialog into the tab bar under the scrim. Escape, focus-in and focus-return all worked | **Fixed.** Tab wraps inside the drawer |
| End session, phone | **Fail** 4.1.2 | The control's whole name was "×" | **Fixed.** "End session" |
| OINA, phone | **Fail** 1.4.3 (axe) | Check answer was white on `--acc` (the only primary button not on `--acc-fill`); the "· 1/4 cards" count was dimmed by opacity | **Fixed** |
| Fill the blank (not offered in any picker) | **Fail** 4.1.2, 2.4.7 | Text box had no name and switched its focus outline off | **Fixed** by reading; not reachable to test |
| Multiple choice, type answer, typed OINA — answering, checking, rating, Next | Pass | Reachable in order; ring on every stop; arrows move between options; verdict focused and read; focus returns to the question or the text box | — |
| Exam mode, all formats (both widths) | Pass | "Answer recorded" and nothing more; the picture never names its subject | — |
| Setup, area picker, Today, Progress, Account, pricing, onboarding | Pass (axe clean) | — | See recommendations 3–5 |
| `prefers-reduced-motion` (motion added in cb3128f) | Pass | Peak running animations 13 / 36 / 148 on Today / Progress / Atlas with the preference off; **0 / 0 / 0** with it on; a 2 s CSS transition computes to 0.00001 s | — |
| Keyboard traps | Pass | None found on any screen | — |
| Achievements; phone Progress | **Fail** 1.4.3 (axe, 27 nodes) | Unearned achievements are dimmed below 4.5:1 | **Recommended** — contrast is tracked separately; these were not in the September scan's routes at phone width |

## Recommended, not done

1. **Decide locate** — [accessibility-locate.md](accessibility-locate.md).
   Until then a third of locate questions answer themselves from the list.
2. **End session has no confirmation** and sits one Tab from the answers. A
   stray Enter ends the session (it happened to the test driver). Ask before
   ending a session with answers in it, or make it undoable.
3. **Radio groups are groups of buttons**: theme (Light / Dark / Follow
   device) and the plan choice use `role="radio"` on separate tab stops and
   do not answer to the arrow keys. Operable, but not the pattern a screen
   reader user expects of something announced as a radio button.
4. **Today has no `<h1>`**, so the route-focus fix has nothing to land on
   there (after End session or after onboarding, focus is on the body).
5. **The area picker has each body region twice** (the figure, then the list)
   — nine extra stops with the same names.
6. **No skip link.** 2.4.1 is met by landmarks and headings; a skip link
   would still save five stops on every desktop page.
7. **Verdict headings take focus with no visible outline** — deliberate for a
   non-interactive target, and the next Tab is visible, but a sighted keyboard
   user sees focus vanish for one keypress.

## Long descriptions (1.1.1)

How pictures were described before: `alt` and `aria-label` both set to
`slideTitle`, nothing else.

Now every picture in a session has a long description as visually hidden text
in the figure (`<figcaption>`), pointed at by `aria-describedby` — not a long
`alt`. They are **generated** (`lib/plateDescription.ts`), not hand-written:
there are 5,130 pictures and everything a description needs is already in the
seed.

| Part | Comes from |
|---|---|
| View, camera angle, tilt | `image.view`, the `-aNNN-` / `uNNN` / `dNNN` id segment |
| Area | `image.subregion` |
| How it is drawn | the plate family (id prefix) and `image.layer` |
| What is in frame | the plate's hotspots (a highlight plate reads its context twin's) |
| Where the subject lies, how big | its hotspot's centroid and area |
| What is beside it | the nearest hotspots' centroids — in the picture's left/right, never medial/lateral |
| What it attaches to | `origin`/`insertion`; reviewed `attachmentStructureIds` + `jointId`; `parentBoneId` + `attachments`; `articulatingStructureIds` + `jointType`; `articulations` |

It states no anatomy the seed does not hold, and no attachment of a ligament
whose attachments are unreviewed. A test runs it over every image.

An open question's description does not answer it: on identify it names
nothing (not the subject, and not its neighbours, which are the likely
distractors); on locate it lists what is in frame and places none of it. The
full description appears once the question is answered. A test asserts both
over all 5,130 images.

The generator is a separate 7 kB chunk loaded on first use. Entry chunk:
1,902,615 → 1,906,827 bytes (+4.2 kB), limit 2,097,152.

One per family, verbatim, as shown after answering:

- **Muscle turntable** (`muscle-deltoid-a000-highlight`): "Anterior view of the
  shoulder. One muscle is picked out in bright cyan; the muscles around it are
  drawn pale over the skeleton. Deltoid is the structure in cyan. It lies at
  the centre of the picture, covering about 14% of it. In this view,
  Pectoralis Major is below it and to the left, Biceps Brachii is below it and
  Serratus Anterior is below it and to the left. Origin: Lateral 1/3 clavicle;
  Acromion; Spine of scapula. Insertion: Deltoid tuberosity of humerus. Also
  in frame: Pectoralis Major, Biceps Brachii, External Oblique, Latissimus
  Dorsi, Trapezius, Serratus Anterior, Sternocleidomastoid, Triceps Brachii
  and 6 more."
- **Ligament plate** (`ligament-coracohumeral-ligament-a000-context`):
  "Anterior view of the shoulder. The bones are drawn plainly with every
  ligament of the joint in the same pale blue; none is picked out.
  Coracohumeral ligament is the structure in question. It lies at the centre
  of the picture, covering about 1% of it. In this view, Acromioclavicular
  ligament is above it and Transverse humeral ligament is to its right. It
  attaches to the humerus and scapula. It belongs to the Glenohumeral Joint.
  Also in frame: Transverse humeral ligament and Acromioclavicular ligament."
- **Joint plate** (`joint-glenohumeral-joint-a000-plate`): "Anterior view of
  the shoulder. The skeleton is drawn plainly and framed on one joint; nothing
  is coloured or marked on the picture itself. Glenohumeral Joint is the
  structure in question. It lies at the centre of the picture, covering about
  1% of it. It is a ball-and-socket joint formed by the humerus and glenoid
  cavity."
- **Landmark plate** (`landmark-acromion-anterior`): "Anterior view of the
  shoulder. The bones are drawn plainly and framed on one bony landmark;
  nothing is coloured on the picture itself. Acromion is the structure in
  question. It lies at the centre of the picture, covering about 5% of it. It
  is part of the scapula. Attached here: Deltoid origin (acromial part);
  Trapezius insertion (upper fibres)."
- **Bone plate** (`bone-shoulder-arm-anterior`, subject scapula): "Anterior
  view of the skeleton of the shoulder. Every bone is drawn in the same plain
  bone colour; none is picked out. Scapula is the structure in question. It
  lies in the upper middle of the picture, covering about 2% of it. In this
  view, Clavicle is above it and Humerus is below it. It forms: Shoulder
  (glenohumeral) joint with the humerus; Acromioclavicular joint with the
  clavicle. Also in frame: Humerus and Clavicle."
- **Sub-region plate** (`sub-wrist-hand-a000-plate`, subject scaphoid): "Close
  anterior view of the wrist and hand. The bones are drawn plainly, with any
  muscles in view in red, close enough for the small structures to be told
  apart; none is picked out. Scaphoid is the structure in question. It lies in
  the upper middle of the picture, and is small at this scale. In this view,
  Capitate is below it, Lunate is to its left and Hamate is below it and to
  the left. It is part of the carpals. Also in frame: Flexor Pollicis Brevis,
  Lumbricals (Hand), Middle Phalanges of the Hand, Dorsal Interossei (Hand),
  Distal Phalanges of the Hand, Flexor Digiti Minimi Brevis (Hand), Capitate,
  Lunate and 3 more."
- **Card panel** (`panel-clavicle`): "A card picture of the shoulder: the
  skeleton shown from more than one side, set side by side, with one structure
  picked out in blue. Clavicle is picked out in blue. It forms:
  Sternoclavicular joint with the manubrium of the sternum; Acromioclavicular
  joint with the acromion of the scapula."

And the same muscle plate **while the question is open**: "Anterior view of
the shoulder. One muscle is picked out in bright cyan; the muscles around it
are drawn pale over the skeleton. Naming that structure is the question, so it
is not described here; a full description is given once you have answered."

### Limits, to be said in the statement

- **Session pictures only.** The structure card and the Atlas use a plain
  `<img alt="Deltoid">` and have no long description yet. Wiring them is a
  provider and a `<PlateDescription>` on two screens.
- **Position is on a three-by-three grid** and neighbours are by centroid. It
  says "at the centre", not "wrapping the shoulder from front to back". It is
  a description a student can orient by, not a substitute for the picture.
- **A card panel gets no view name**: the seed records `posterior` for all 61
  and most are two or three views side by side.
- **Nobody has listened to one.** Whether several sentences on
  `aria-describedby` are read usefully by VoiceOver on a phone is exactly what
  the owner's screen-reader run needs to settle; if not, the same text should
  move behind a "Describe this picture" disclosure.

## Proposed changes to the accessibility statement

Proposals for `src/features/legal/AccessibilityPage.tsx`; not applied.

**Updated date:** 4 October 2026.

**"What works" — replace the first paragraph with:**

> Every question format can be answered from the keyboard alone, at desktop
> and phone width. On 4 October 2026 we worked through a whole session of each
> format — multiple choice, typed answers, flashcards, multi-select, locate
> and OINA cards, in study and in exam mode — in a browser using only the
> keyboard, through to the results page. Options are buttons reached by Tab,
> moved between with the arrow keys and chosen with Enter or Space; a chosen
> option is announced as chosen; the focused control is outlined.

**"What works" — add:**

> When you check an answer, reveal a card, finish a session or open a page,
> focus moves to what has just appeared — the result, the answer, the score,
> the page's heading — rather than back to the top.
>
> Pictures in a session have a text description: the view, what is in frame,
> what is highlighted, where it lies and what it attaches to. While a question
> is open the description leaves out whatever would answer it, and is given in
> full once you have answered.

**"What works" — correct the locate paragraph.** "replaces the image with the
named structures visible on it" is true but, for about a third of locate
questions, that is one name. Until locate is decided:

> Locate questions can be answered without a pointer, from a list of the
> structures on the picture. For landmarks and joints that list has a single
> name in it — see below.

**"What does not work yet" — replace "The locate list is not equivalent" with:**

> **Locate has no equivalent without sight, and its keyboard route is
> weaker than it should be.** The picture itself cannot be operated from a
> keyboard; the keyboard route is a list of names. That is a different and
> easier exercise, and on landmark and joint pictures — about a third of
> locate questions — the list contains only the answer. We are deciding
> between asking the question in words ("which of these describes where it
> sits?") and a keyboard-driven pointer on the picture; neither is built.

**"What does not work yet" — replace "Anatomical images have no long
descriptions" with:**

> **Picture descriptions are generated, cover sessions only, and have not
> been heard on a screen reader.** They are written from the app's own data,
> not by hand, for every picture a question shows. The pictures on a structure
> card and in the Atlas have only a name. A description places a structure
> roughly — "upper middle of the picture, the clavicle above it" — which is
> enough to orient by and not a substitute for seeing it.

**"What does not work yet" — in "No independent audit", replace the sentence
beginning "We have not yet repeated the keyboard pass on a phone" with:**

> On 4 October 2026 we repeated the keyboard pass at phone width and extended
> it to every question format; what it found is fixed or listed here. We have
> not yet tested with NVDA or VoiceOver end to end, so anything said here
> about what a screen reader announces is what the app exposes, not what we
> have heard it say.

**Add to "What does not work yet":**

> **Ending a session has no confirmation.** The End session control is close
> to the answers in keyboard order, and pressing it ends the session at once.
>
> **Some small text is below the contrast minimum.** Achievements that have
> not been earned are dimmed below 4.5:1.

**"What we are doing about it":** drop "a keyboard pass on a phone" (done);
keep the NVDA and VoiceOver session; replace the alt-text paragraph with
"Descriptions for the pictures on structure cards and in the Atlas."

## Raw output

Not in the repo: the session scratchpad `a11y/` folder — `F-d*.log` and
`F-p*.log` (final keyboard runs, desktop and phone), `M-d.log` / `M-p.log`
(other screens), `d*.log` / `p*.log` (the same before the fixes), `shots/`.
