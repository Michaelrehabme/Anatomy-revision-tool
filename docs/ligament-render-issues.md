# Ligament plates — open render issues

Raised 22 Sep 2026 from the second tranche's attachment cross-check, which read
each ligament's picture before judging its coded attachments. Kept apart from
the attachment work: these are re-renders, not seed edits.

## 1. Intra-articular ligament of the head of the rib — buried in its joint

The only genuine render fault of the five raised. It traced at two angles
(posterolateral and lateral) and its visibility survey score is 0.0: the
ligament runs inside the costovertebral joint, between the crest of the rib
head and the intervertebral disc, so every view looks through the rib and the
vertebral body at it.

It is the one seeded ligament with no locate question (`README.md`, "Image and
hotspot status"), and its identify picture is barely readable.

Options, in the order I would try them:

1. **Cut away the rib in front of it**, the way `tiltCutaway` already hides the
   tibia and fibula for the foot's dorsal views (`ligamentFraming.ts`,
   `FOOT_TILTS`). A `cutaway` list for the near rib and the vertebral body
   would let the joint be seen into.
2. **Frame one costovertebral joint tightly** rather than the thoracic cage, so
   the ligament is a usable fraction of the picture at all.
3. **Ghost the rib** instead of cutting it (ghosts are already drawn at alpha
   0.45), which keeps the landmark that names the place while letting the
   ligament read through it.

Until one of those is done the ligament is asked by name only, which is honest
but thin.

## 2. Four raised as wrong-aspect renders — NOT render faults (closed)

The cross-check reported three plantar ligaments shown from above
(plantar cuneonavicular, plantar intercuneiform, plantar tarsometatarsal) and
the posterior ligament of the fibular head shown from the front. The plates
themselves are right: each of those ligaments has a plate from its own side —
the plantar ones have `a000d090` and `a000d045` plantar views, the fibular head
has `a180` posterior.

What was wrong was the REVIEW PAGE, which picked each card's picture by largest
traced area. A plantar ligament traces largest through the foot from above,
because the camera sees more of the sheet edge-on. Fixed in
`renders/build-t2-review.ts`: the ligament's name now picks the aspect
(plantar, dorsal, palmar/anterior, posterior) and largest area decides only
within it. Worth remembering if another review page is built from plates:
biggest is not clearest.
