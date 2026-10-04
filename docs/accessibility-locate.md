# What a locate question offers someone who cannot see the plate

Proposed on 4 October 2026; **the owner accepted the recommendation — B and C,
with A as the fallback — and all three are now built** (branch `a11y-locate`).
The first half of this document says what was built and what is still not
equivalent. The proposal as it was put follows it, unchanged, because its
reasoning is why the code looks the way it does.

## What was built

### C — the picture answers to the keyboard

`shared/ImageViewer.tsx`, `lib/hotspot/keyboardCrosshair.ts`.

Where a picture takes a tap, it is a focus stop. With focus on it:

| Key | Does |
|---|---|
| Arrow keys | Move a crosshair over the picture, 0.5% of the picture's width a press |
| Shift + arrow | Ten times as far (twenty presses cross the picture) |
| Enter or Space | Taps where the crosshair is. The first one is the answer |
| + and − | Zoom in and out about the crosshair |

- **It is graded by the code a click is graded by.** Enter turns the crosshair
  into the point on screen it sits on and hands that to the function a click
  calls — the same normalisation against the transformed picture, the same hit
  test, the same `TAP_SLACK`, the same ring score. There is no second grading
  path to drift. `keyboardCrosshair.parity.test.tsx` answers the same question
  both ways and compares the two results whole: on an outline target, on a
  scored landmark, zoomed and panned, on a turned plate, on the carpal gap
  plate, and with the second render showing.
- **The crosshair lives on the screen, not on the picture**, so it stays in
  view whatever is done underneath it: zoom, another angle, the other render.
  Zoomed in, it pushes the picture along once it nears the edge, so every
  point of the picture can be reached at any zoom from the keyboard alone.
- **It is a separate focus stop** from rotate, tilt, zoom and the render
  switch, which keep their own keys. Tab leaves it; nothing traps focus. It
  stays drawn while focus is on those controls, so a student who tabs down to
  turn the plate can see where they were.
- **It knows nothing about what is under it.** No hotspot is focusable, none
  is named, nothing is announced as it moves. That is deliberate (see "Not
  acceptable" below) and a test holds it.
- **What can be seen:** the app's ordinary focus ring on the picture; a
  crosshair drawn white under black, so one stroke or the other stands out
  against bone, muscle, the white ground and the dark theme alike; a line of
  instructions under the picture while the crosshair is showing. The same
  instructions are always part of the picture's description for a screen
  reader, and the stage is `role="application"` while it takes a tap, so the
  arrow keys are passed through.
- A stage focused by a click shows no crosshair. Enter then shows it rather
  than answering at a point the student has not been shown.

### B — the question asked in words

`lib/questionGenerators/describedRegion.ts`, `LocateStructureSession/LocateWords.tsx`.

"Answer without the picture" on a locate question asks instead: **"Which of
these describes where the Acromion sits?"** with four options, one true.

Every option is a label and values the seed already holds, printed as stored —
nothing is written:

| Family | Labels | From |
|---|---|---|
| Muscle | `Origin: …. Insertion: ….` | `origin`, `insertion` |
| Ligament | `Attaches to: …` | reviewed `attachmentStructureIds` (never a `needsReview` one) |
| Landmark | `Part of: …. Attached here: …. Articulates: ….` | `parentBoneId`, `attachments`, `articulations` |
| Joint | `Formed by: …` | `articulatingStructureIds` |
| Bone | `Articulations: …` | `articulations` |

Region and sub-region are not used: every plausible wrong option shares them,
so they separate nothing.

The wrong options are the same fields of other structures of the same
category, nearest first: sharing a bone or a muscle group with the asked
structure, then its area, then its region, then anywhere. Three rules keep the
question honest, each tested over every locate question:

1. **Not answerable from the name.** A value that shares a distinctive word
   with the structure's name is left out ("Deltoid tuberosity" from the
   deltoid's insertion; "Tibia" from "Medial Condyle of Tibia"), and so is any
   wrong option that mentions the asked structure.
2. **Not answerable by shape.** All four options carry the same labels; wrong
   options are within 2.6 times the right one's length; the right one is the
   longest of its four 16% of the time and the shortest 25% (chance is 25%).
3. **Only one is true.** A wrong option is dropped if everything it claims is
   also true of the asked structure.

**Coverage, measured on this branch (487 structures, 595 locate questions):
575 of 595 (96.6%).**

| Family | Locate questions | Asked in words |
|---|---|---|
| Muscle | 124 | 124 |
| Ligament | 151 | 150 |
| Landmark | 202 | 192 |
| Joint | 34 | 34 |
| Bone | 84 | 75 |

The twenty not covered, which fall back to the list (A):

- **No data (2 questions):** External intercostal membrane (no attachments in
  the seed), Pedicle (no parent bone, attachment or articulation).
- **Everything the seed holds is in the name (18 questions, 8 structures):**
  Neck of Fibula and Surgical Neck of Humerus (only "part of the fibula /
  humerus"); Vertebral Body and Intervertebral Disc (every value names the
  vertebral body or the disc); the middle and distal phalanges of hand and
  foot (every articulation names the phalanges; nine questions, because each
  appears on several plates).

(The proposal estimated 573 of 586. The seed has since grown by eight
ligaments, and the estimate did not allow for the name rule.)

**With one area's facts loaded** (`docs/CONTENT-SERVER-STATUS.md`): it builds
from that area alone and never describes a structure whose facts are not
loaded; names of bones in other areas come from the bundled index. Coverage
falls to 489 of 661 area-questions, because an area with two bones cannot
supply three wrong descriptions of a bone (elbow 8 of 35, lumbar spine 42 of
78, wrist and hand 93 of 102). Those fall back to the list, which needs no
facts. A test builds each of the nine areas this way.

### A — the list, never shorter than four

`lib/questionGenerators/locateList.ts`.

Where a question cannot be asked in words, "Answer without the picture" opens
the list of names. It was every structure the plate carries a hotspot for:
one name on 212 questions, under four on 246. Now a short list is made up to
four with other structures of the same category — the asked structure's area
first (over nine in ten of the names added), then its region, then anywhere —
drawn with a seed from the question's id, in name order. A plate that already
shows four or more keeps exactly the list it had. Names are index data, so the
pool is never short. `locateList.test.ts` enforces "no list under four" over
all 595.

### The setting

Account → Accessibility → **"Answer locate questions without the picture"**.
Off by default; stored on the device with the other preferences
(`lib/preferences.ts`). On, a locate question opens in words (or the list);
"Answer on the picture" is one button away. It changes how a question is
answered and never which questions are asked: the same seeds build the same
sets, byte for byte, with it on or off.

### How an answer in words is recorded

`lib/answerRoute.ts`. **It is never recorded as a locate success.**

- The stored attempt has `questionType: 'mcq'`, `promptKind:
  'described-region'`, with the description chosen and the right one. A cohort
  report can always tell it from a tap.
- Its progress and review schedule are a fact row of its own
  (`described-region`), like any other fact asked as multiple choice. The
  structure's own row — which a tap moves — is untouched, and the row is not
  one a structure's level is computed from. It earns multiple-choice XP.
- A tap by crosshair, and a name from the list, are recorded as the locate
  question, as before.

**The owner has not decided whether it should count.** To make it count, set
`DESCRIBED_REGION_COUNTS_AS_LOCATE = true` in `lib/answerRoute.ts`: it is then
credited exactly as a tap is (the structure's row, locate XP), and the attempt
row still says what it was, so nothing recorded before or after the change is
lost. Both settings are tested.

One consequence of keeping them apart: a `described-region` row has a review
date like any fact row, and the Progress forecast counts it, but session
building weights a locate question by the structure's own row. A student who
only ever answers in words is therefore re-asked locate questions on the
structure's schedule, not on the schedule of their answers in words. Counting
it as a locate removes that.

### The long descriptions

`lib/plateDescription.ts` changed in one respect: a landmark's description now
gives its articulations once the question is answered, because the right
option in words gives them and the description would otherwise say less than
the answer just given. While a locate question is open the description still
places nothing and states no relation; a test checks both directions over
every locate question.

## What is still not equivalent

- **B is a different exercise.** It tests whether a student knows where a
  structure is as a set of relations — what it joins, lies on, sits between.
  It does not test finding it on a picture, and no text version can. It is
  recorded apart for that reason. The statement should go on saying so.
- **About a third of ligament and joint questions in words can be read off
  the name.** The anterior talofibular ligament attaches to the talus and the
  fibula. The name rule catches a whole word, not a Latin root, and for 47 of
  150 ligaments and 11 of 34 joints every value of the right option has its
  root in the name. Reading a name that way is real anatomy knowledge, and a
  sighted student has it on the picture too, but those questions are easier
  than the tap they replace.
- **Many of the options are short.** A ligament with one reviewed attachment
  is "Attaches to: Scapula." That is all the seed holds.
- **A structure whose description is cut by the name rule is asked about less
  than the whole of it** — the deltoid by its origin alone.
- **Wrong options from far away are easy to rule out.** A category with few
  members near the asked structure borrows from other regions: the femur is
  offered an articulation of the axis.
- **A is still name recognition**, and the prompt has given the name. It is
  there so no question is unanswerable without the picture, for the twenty it
  covers today and for more once facts are served by area.
- **C is for someone who can see the plate.** It does nothing for a
  screen-reader user, and is not meant to.
- **Nobody has used any of it with a screen reader or a switch.** It has been
  driven in Chromium from the keyboard alone, at 1440 and 390 pixels wide, and
  axe-core finds no violations in the new screens; what NVDA, VoiceOver or
  TalkBack make of `role="application"` on the picture, and of four long
  options read in a row, is not known.
- **A crosshair needs a keyboard.** Switch access that sends key presses
  works; a switch that scans focusable elements reaches the picture and then
  needs its arrow keys.
- **On the phone the verdict heading says only "Correct" or "Not quite"**;
  the right description is in the sheet under it, not in the heading's own
  label as on the desktop. That is how the sheet works for every format.

What the accessibility statement can now say: every locate question can be
answered on the picture from the keyboard; a student who cannot see the
picture is asked where the structure is in words, or — for twenty questions
the app's data cannot describe — chooses its name from at least four. What it
cannot say: that the words and the picture are the same test.

---

# The proposal, as put

What follows was written before anything was built, except two repairs to the
list route noted below. Its options A, B and C are what the section above
reports on.

## What exists today, and what the audit found

A locate question shows a plate and asks the student to tap a structure on it.
The route for anyone not using a pointer is a toggle — "Answer from a list
instead" (desktop), "Can't tap precisely? Choose from a list" (phone) — that
replaces the picture with a button for every structure the plate carries a
hotspot for.

Measured over the 586 locate questions the seed generates:

| What the list offers | Questions |
|---|---|
| **One name** — the answer, and nothing else | **212 (36%)** |
| Two or three names | 34 |
| Four or more (median 6, largest 68) | 340 |

The 212 are the landmark and joint plates: each is framed on one structure and
carries one hotspot. "Tap the acromion" becomes a single button labelled
"Acromion". That is not an easier question; it is not a question.

Two further faults in the list were plain defects and are fixed in this
branch: the names were listed in hotspot order, which is target-first on every
muscle and ligament plate, so the right answer was always the first button
(now alphabetical); and answering from the list dropped keyboard focus to the
page body, so the verdict was never read out (it now takes focus).

Even where the list is a fair size, it tests **recognising a name among the
structures on one plate** — and the prompt has just given the name. It tests
nothing about where the structure is.

## What WCAG requires, exactly

Success Criterion 1.1.1 Non-text Content (Level A), from
<https://www.w3.org/TR/WCAG21/#non-text-content>, fetched 4 October 2026:

> All non-text content that is presented to the user has a text alternative
> that serves the equivalent purpose, except for the situations listed below.
>
> **Test:** If non-text content is a test or exercise that would be invalid if
> presented in text, then text alternatives at least provide descriptive
> identification of the non-text content.
>
> **Sensory:** If non-text content is primarily intended to create a specific
> sensory experience, then text alternatives at least provide descriptive
> identification of the non-text content.

The exception that applies is **Test**, not Sensory. (The glossary defines a
specific sensory experience as one "that is not purely decorative and does not
primarily convey important information or perform a function" — a symphony, a
painting. A plate that performs the function of an exam question is not that.)
A locate plate is a test that is invalid in text: a description of where the
acromion is, is the answer. So 1.1.1 asks only that the plate be *identified*
— and it now is: the picture's name, and a description that says what view it
is and what is in frame but not where anything lies
(`lib/plateDescription.ts`, `conceal: 'place'`).

And 2.1.1 Keyboard (Level A):

> All functionality of the content is operable through a keyboard interface
> without requiring specific timings for individual keystrokes, except where
> the underlying function requires input that depends on the path of the
> user's movement and not just the endpoints.

A tap is an endpoint, not a path, so **the exception does not cover locate**.
The list route is what makes locate keyboard-operable today, and for a sighted
keyboard user it substitutes a different, easier exercise. Option C closes
that properly.

So the app can conform with the picture untouched. What conformance does not
give is an exercise of equal value, and that is the real question here.

## Options

### A. Keep the list, repaired

Stop offering the list when it has fewer than four names, and pad it with
same-category structures from the same area (the distractor pool multiple
choice already uses).

- **Tests:** name recognition. Not location.
- **Cost:** about half a day. No new content.
- **Honest label:** an accommodation that keeps the session moving, not an
  alternative form of the question.

### B. A described-region question — "Which of these describes where X sits?"

When locate is answered without the picture, ask the same structure a spatial
question in words: four descriptions, one true, built from fields the seed
already holds and already grades against.

| Family | The true option is built from | Locate questions with the data |
|---|---|---|
| Muscle | `origin` → `insertion` ("from the lateral third of the clavicle, acromion and spine of the scapula to the deltoid tuberosity") | 124 of 124 |
| Ligament | reviewed `attachmentStructureIds` + `jointId` | 141 of 142 |
| Landmark | `parentBoneId` + `attachments` ("on the scapula; deltoid origin, trapezius insertion") | 190 of 202 |
| Joint | `articulatingStructureIds` ("between the head of the humerus and the glenoid cavity") | 34 of 34 |
| Bone | `articulations` | 84 of 84 |

573 of 586 (98%). Distractors are the same fields of other structures in the
same area and category, which is how the existing attachment and origin
multiple-choice questions are built — this is that generator pointed the other
way, so the anatomy is not new and nothing is invented. The thirteen without
data fall back to option A.

- **Tests:** where the structure is, as a set of relations — which is what a
  blind anatomy student is actually examined on, and what "locate" means
  without a picture. It does not test recognising it by eye.
- **Cost:** two to three days. A generator beside `questionGenerators/mcq.ts`,
  a branch in the two locate screens, tests. One product decision: whether a
  correct described-region answer counts towards the **locate** rung of the
  mastery ladder (recommended: yes, recorded with a flag, so a student who
  cannot see is not locked out of mastery, and the flag keeps cohort analytics
  honest).
- **Risk:** it overlaps the attachment/origin MCQs a session may already
  contain. Acceptable — it is the same fact approached from the structure
  rather than from the attachment.

### C. A keyboard crosshair on the plate (for sighted keyboard and switch users)

Make the picture focusable; arrow keys move a visible crosshair (Shift for
finer steps), Enter places the tap. Same question, same hit test, same
accuracy rings.

- **Tests:** exactly what the pointer version tests. This is the only option
  that is *equivalent* — but only for someone who can see the plate.
- **Cost:** about a day in `shared/ImageViewer.tsx`, plus a line of
  instruction. (Deliberately not built in this branch: another branch is
  editing that file.)
- **What it is not:** an answer for screen-reader users.

### Not acceptable: tabbing between hotspots with spoken names

Making each hotspot a focusable element named after its structure looks like
the obvious accessible build, and it gives the answer away: the student tabs
until they hear "Acromion" and presses Enter. It is the one-name list with
more steps. Unnamed hotspots ("region 3 of 15") are no better — a blind
student is then guessing among unlabelled regions. Neither should be built.

## Recommendation

**B and C together, with A as the fallback.** They serve different people:

1. **C** for anyone who can see the plate but cannot use a pointer — the same
   exercise, properly keyboard-operable.
2. **B** as what "Answer in words instead" opens, replacing the list wherever
   the seed has the data (98%).
3. **A**, padded to at least four names, for the remainder.
4. A **setting** on the Account screen — "Ask locate questions in words" — so
   someone who needs B is not pressing a toggle on every question.

## What cannot be made equivalent, said plainly

Finding a structure on a picture by looking at it is a visual skill, and no
text version tests it. B tests the knowledge underneath — what the structure
joins and sits between — which is the part that transfers to palpation and to
a written exam, but it is a different exercise and the statement should go on
saying so. A cohort report that compares locate accuracy across students
should be able to tell the two apart.

What the statement can honestly claim after B and C: every locate question can
be answered from the keyboard on the picture itself; a student who cannot see
the picture is asked where the structure is in words; the picture is described
once answered. What it cannot claim: that the two are the same test.
