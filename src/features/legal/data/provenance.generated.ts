/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/generateProvenance.ts
 *
 * What /sources states about where each family's content came from, reduced
 * from the root *-source-review JSONs and blood-supply-review.json. Counts and
 * distinct works only: the per-fact quotes stay in those files, out of the
 * bundle. See that script.
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

/** How far one family's blood supply has been sourced. */
export interface BloodSupplyFamily {
  category: Category;
  total: number;
  /** Structures carrying a blood supply the owner accepted, with a quoted source. */
  reviewed: number;
  /** Indices into WORKS. */
  works: number[];
}

export interface BloodSupplyProvenance {
  families: BloodSupplyFamily[];
  /** Landmarks in the app. None carries a blood supply, by decision. */
  landmarksExcluded: number;
  /** Arteries the draft named that no quoted source backed; not shown in the app. */
  arteriesWithheld: number;
  /** Structures whose rating rests on a documented watershed or avascular zone. */
  zones: number;
  lastChecked: string | null;
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
    checked: 32,
    held: 0,
    lastChecked: "2026-09-27",
    works: [0, 2, 3],
  },
  {
    category: "landmark",
    total: 133,
    method: "ai-drafted",
    scope: "Parent bone, location, attachments and whether it can be felt through the skin.",
    checked: 133,
    held: 0,
    lastChecked: "2026-09-27",
    works: [0, 2, 4, 5, 6, 7],
  },
  {
    category: "joint",
    total: 34,
    method: "ai-drafted",
    scope: "Joint type, articulating surfaces, available movements and stabilisers.",
    checked: 34,
    held: 0,
    lastChecked: "2026-09-27",
    works: [2, 5, 7],
  },
  {
    category: "ligament",
    total: 166,
    method: "ai-drafted",
    scope: "Attachments checked against named works. The descriptions are not yet checked.",
    checked: 166,
    held: 0,
    lastChecked: "2026-10-04",
    works: [2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
];

export const WORKS: ProvenanceWork[] = [
  { title: "ALL_Muscles_of_the_body — Vinnie Maynard, University of Salford", citations: 202 },
  { title: "Visible Body", url: "https://www.visiblebody.com/learn/", citations: 1 },
  { title: "Gray's Anatomy (public domain, via Wikipedia)", url: "https://en.wikipedia.org/wiki/Gray%27s_Anatomy", citations: 497 },
  { title: "Radiopaedia", url: "https://radiopaedia.org/", citations: 124 },
  { title: "Z-Anatomy (Gauthier Kervyn and contributors), CC BY-SA 4.0", url: "https://github.com/Z-Anatomy/Models-of-human-anatomy", citations: 90 },
  { title: "StatPearls (NCBI Bookshelf)", url: "https://www.ncbi.nlm.nih.gov/books/NBK430685/", citations: 340 },
  { title: "Checked by the project owner, a sports rehabilitation student", citations: 94 },
  { title: "Peer-reviewed journal articles", citations: 164 },
  { title: "Netter plates supplied by the project owner", citations: 1 },
  { title: "Terminologia Anatomica", url: "https://ta2viewer.openanatomy.org/", citations: 8 },
  { title: "Radsource MRI Web Clinic", url: "https://radsource.us/", citations: 3 },
  { title: "Physiopedia", url: "https://www.physio-pedia.com/", citations: 2 },
  { title: "Anatomy Standard", url: "https://www.anatomystandard.com/", citations: 2 },
  { title: "Human Kinetics", citations: 3 },
  { title: "Medscape", url: "https://emedicine.medscape.com/", citations: 1 },
  { title: "Wheeless' Textbook of Orthopaedics", url: "https://www.wheelessonline.com/", citations: 1 },
  { title: "WikiSM (Sports Medicine Wiki)", url: "https://wikism.org/", citations: 5 },
];

export const BLOOD_SUPPLY: BloodSupplyProvenance = {
  families: [
    { category: "muscle", total: 122, reviewed: 122, works: [2, 3, 5, 7] },
    { category: "bone", total: 32, reviewed: 25, works: [3, 5, 7] },
    { category: "joint", total: 34, reviewed: 30, works: [2, 3, 5, 7] },
    { category: "ligament", total: 166, reviewed: 57, works: [2, 5, 7] },
  ],
  landmarksExcluded: 133,
  arteriesWithheld: 3,
  zones: 47,
  lastChecked: "2026-09-29",
};
