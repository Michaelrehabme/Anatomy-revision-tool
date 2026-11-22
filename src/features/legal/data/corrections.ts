/**
 * The public log behind /corrections: every content correction that has gone
 * live, newest first.
 *
 * WHY IT IS PUBLIC. The terms promise that reported errors are checked and
 * corrected for everyone. A dated record of what changed is the evidence that
 * the promise is kept, and it is what a course leader or a university's
 * procurement team asks to see before recommending the app.
 *
 * THE RULE: add an entry in the same pull request as the fix, never before it
 * merges (merging main publishes the site, so the log and the fix go live
 * together). List what a student sees change, in plain words, and the source
 * it was checked against. Never name the student who reported it.
 */

export type CorrectionKind = 'Fact' | 'Picture';

export interface Correction {
  /** ISO date the fix went live. */
  date: string;
  structure: string;
  kind: CorrectionKind;
  /** What changed, as a student would notice it. */
  change: string;
  /** The published work it was checked against, when one was recorded. */
  source?: string;
  /** How it came to light. */
  found: 'Student report' | 'Accuracy review';
}

export const CORRECTIONS: readonly Correction[] = [
  {
    date: '2026-11-13',
    structure: 'Annular ligament of the radius',
    kind: 'Picture',
    change: 'Redrawn so the ligament wraps around the head of the radius and attaches to the ulna.',
    found: 'Student report',
  },
  {
    date: '2026-11-13',
    structure: 'Radioscaphocapitate ligament',
    kind: 'Picture',
    change: 'Redrawn as a band about 7 mm wide running from the radial styloid, across the scaphoid, to the capitate. It previously missed the radius.',
    source: 'Zumstein et al., J Wrist Surg 2013',
    found: 'Student report',
  },
  {
    date: '2026-11-13',
    structure: 'Palmar interossei',
    kind: 'Picture',
    change: 'All three palmar interossei are now shown. Previously only the third was drawn.',
    found: 'Student report',
  },
  {
    date: '2026-11-13',
    structure: 'Transverse acetabular ligament',
    kind: 'Picture',
    change: 'Redrawn so the ligament can be seen; neighbouring structures that hid it are now see-through.',
    found: 'Student report',
  },
  {
    date: '2026-11-12',
    structure: 'Psoas major',
    kind: 'Fact',
    change: 'Origin corrected to the bodies of T12–L4 and their discs, and the transverse processes of all lumbar vertebrae.',
    source: 'Kenhub',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Gemelli',
    kind: 'Fact',
    change: 'Nerve supply split: superior gemellus by the nerve to obturator internus, inferior gemellus by the nerve to quadratus femoris.',
    source: 'Kenhub',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Longus colli',
    kind: 'Fact',
    change: 'Origin and insertion corrected to the attachments of its three parts.',
    source: 'Gray’s Anatomy',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Fifth metatarsal',
    kind: 'Fact',
    change: 'A Jones fracture is now described as slightly distal to a tuberosity avulsion, not proximal.',
    source: 'WikiSM',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Transverse foramen',
    kind: 'Fact',
    change: 'Now says the vertebral artery passes through C1–C6, and C7’s foramen usually carries only an accessory vein.',
    source: 'Gray’s Anatomy',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Sustentaculum tali',
    kind: 'Fact',
    change: 'The deltoid ligament attachment is its superficial (tibiocalcaneal) part, not its deep part.',
    source: 'Gray’s Anatomy',
    found: 'Accuracy review',
  },
  {
    date: '2026-11-12',
    structure: 'Ribs',
    kind: 'Fact',
    change: 'False ribs corrected to 8–12, with 11–12 also called floating ribs.',
    found: 'Accuracy review',
  },
];
