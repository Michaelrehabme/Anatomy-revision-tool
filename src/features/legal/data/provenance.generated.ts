/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/generateProvenance.ts
 *
 * What /sources states about where each family's content came from, reduced
 * from the root *-source-review JSONs. Counts and distinct works only: the
 * per-fact quotes stay in those files, out of the bundle. See that script.
 */
import type { Category } from '../../anatomy-revision/types/structure';

export interface ProvenanceWork {
  title: string;
  url?: string;
  /** How many facts were checked against this work. */
  citations: number;
}

export interface FamilyProvenance {
  category: Category;
  total: number;
  /** How the content was first written, before any checking. */
  method: 'lecture-deck' | 'ai-drafted';
  /** What a check covered — the ligaments' "attachments only" is load-bearing. */
  scope: string;
  checked: number;
  held: number;
  lastChecked: string | null;
  /** Indices into WORKS. */
  works: number[];
}

export const FAMILIES: FamilyProvenance[] = [
  {
    category: "muscle",
    total: 122,
    method: "lecture-deck",
    scope: "Origin, insertion, nerve supply and action, cross-referenced against Terminologia Anatomica.",
    checked: 122,
    held: 0,
    lastChecked: null,
    works: [0, 1],
  },
  {
    category: "bone",
    total: 32,
    method: "ai-drafted",
    scope: "Articulations, muscle attachments and the claims made in each description.",
    checked: 7,
    held: 0,
    lastChecked: "2026-09-24",
    works: [0, 2],
  },
  {
    category: "landmark",
    total: 133,
    method: "ai-drafted",
    scope: "Parent bone, location, attachments and whether it can be felt through the skin.",
    checked: 11,
    held: 0,
    lastChecked: "2026-09-25",
    works: [0, 2, 3, 4],
  },
  {
    category: "joint",
    total: 34,
    method: "ai-drafted",
    scope: "Joint type, articulating surfaces, available movements and stabilisers.",
    checked: 22,
    held: 0,
    lastChecked: "2026-09-24",
    works: [2],
  },
  {
    category: "ligament",
    total: 143,
    method: "ai-drafted",
    scope: "Attachments checked against named works. The descriptions are not yet checked.",
    checked: 128,
    held: 1,
    lastChecked: "2026-09-24",
    works: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  },
];

export const WORKS: ProvenanceWork[] = [
  { title: "ALL_Muscles_of_the_body — Vinnie Maynard, University of Salford", citations: 174 },
  { title: "Visible Body", url: "https://www.visiblebody.com/learn/", citations: 1 },
  { title: "Gray's Anatomy (public domain, via Wikipedia)", url: "https://en.wikipedia.org/wiki/Gray%27s_Anatomy", citations: 309 },
  { title: "github.com", url: "https://github.com/Z-Anatomy/Models-of-human-anatomy", citations: 90 },
  { title: "Peer-reviewed journal articles (open access)", citations: 38 },
  { title: "Radiopaedia", url: "https://radiopaedia.org/", citations: 21 },
  { title: "Terminologia Anatomica", url: "https://ta2viewer.openanatomy.org/", citations: 8 },
  { title: "Radsource MRI Web Clinic", url: "https://radsource.us/", citations: 3 },
  { title: "Physiopedia", url: "https://www.physio-pedia.com/", citations: 2 },
  { title: "Anatomy Standard", url: "https://www.anatomystandard.com/", citations: 2 },
  { title: "Human Kinetics", citations: 3 },
  { title: "Medscape", url: "https://emedicine.medscape.com/", citations: 1 },
  { title: "Wheeless' Textbook of Orthopaedics", url: "https://www.wheelessonline.com/", citations: 1 },
  { title: "WikiSM (Sports Medicine Wiki)", url: "https://wikism.org/", citations: 5 },
];
