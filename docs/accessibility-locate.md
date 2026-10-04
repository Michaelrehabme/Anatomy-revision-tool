# What a locate question offers someone who cannot see the plate

A proposal, 4 October 2026. **The owner decides; nothing here is built** except
two repairs to the existing list route, noted below.

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
