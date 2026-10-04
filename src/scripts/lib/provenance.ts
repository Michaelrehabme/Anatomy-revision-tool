import { readFileSync } from 'node:fs';
import type { Category } from '../../features/anatomy-revision/types/structure';

/**
 * The provenance record, read from the root *-source-review JSONs and reduced
 * to the aggregate /sources renders. Shared by generateProvenance.ts (which
 * writes the committed summary) and validateContent.ts (which fails the build
 * when the committed summary and these files disagree) — one reader, so the
 * page's numbers and the check on them cannot be computed two different ways.
 */

/**
 * Works we do not cite. Kenhub, Complete Anatomy and TeachMeAnatomy are
 * products a student might buy INSTEAD of this one, and /sources names its
 * works in public, so citing them is advertising them (owner, 23 Sep 2026).
 *
 * This is a build failure rather than a guideline because the alternative —
 * quietly dropping the name from the page while the record still rests on it —
 * is the incomplete-work-set problem docs/CLAIMS.md exists to prevent. The
 * only way to stop citing a work is to re-check the rows that depended on it.
 *
 * Visible Body is deliberately NOT here: the muscle deck drew on it, so it is
 * already upstream of the 122 shipped muscles and the page has to say so.
 */
export const EXCLUDED_WORKS: { pattern: RegExp; label: string }[] = [
  // Kenhub came off this list on 24 Sep 2026 (owner): its anatomy articles are
  // public pages anyone can read, and citing a public page is what a citation
  // is for. The rest stay — Complete Anatomy and TeachMeAnatomy are products
  // sold to the same student, and IMAIOS is a subscription atlas, so naming
  // them on a public page is advertising rather than evidence.
  { pattern: /complete ?anatomy|3d4medical|elsevier/i, label: 'Complete Anatomy / Elsevier' },
  { pattern: /imaios/i, label: 'IMAIOS e-Anatomy' },
  { pattern: /teachmeanatomy/i, label: 'TeachMeAnatomy' },
];

export function excludedWork(w: { title: string; url?: string }): string | null {
  const hay = `${w.title} ${w.url ?? ''}`;
  return EXCLUDED_WORKS.find((e) => e.pattern.test(hay))?.label ?? null;
}

export interface CitedWork {
  title: string;
  url?: string;
  /** How many facts were checked against this work. */
  citations: number;
}

export interface FamilyProvenance {
  category: Category;
  total: number;
  method: 'lecture-deck' | 'ai-drafted';
  /** What the check covered. "attachments only" is the ligaments' honest caveat. */
  scope: string;
  checked: number;
  held: number;
  lastChecked: string | null;
  /** Indices into the shared works list. */
  works: number[];
}

interface ReviewEntry {
  grade?: string;
  checked?: string;
  sources?: string[];
  works?: { title: string; url?: string; quote?: string; document?: string }[];
}

/** Which root file holds each family's review, and what that review covers. */
export const REVIEW_FILES: Record<string, { file: string; key: string; scope: string }> = {
  ligament: {
    file: 'ligament-attachment-corrections.json',
    key: 'corrections',
    scope: 'Attachments checked against named works. The descriptions are not yet checked.',
  },
  bone: {
    file: 'bone-source-review.json',
    key: 'reviews',
    scope: 'Articulations, muscle attachments and the claims made in each description.',
  },
  joint: {
    file: 'joint-source-review.json',
    key: 'reviews',
    scope: 'Joint type, articulating surfaces, available movements and stabilisers.',
  },
  landmark: {
    file: 'landmark-source-review.json',
    key: 'reviews',
    scope: 'Parent bone, location, attachments and whether it can be felt through the skin.',
  },
};

/**
 * The publishers a citation can resolve to. /sources names these rather than
 * the 175 individual article citations behind them, for the same reason
 * /attributions groups images by credit: a reader wants to know whose word
 * this rests on, and a wall of article links does not tell them. The
 * article-level citation stays in the review file, where a challenge is settled.
 *
 * Order matters — first match wins, so put the specific before the general.
 */
const PUBLISHERS: { pattern: RegExp; title: string; url?: string }[] = [
  // The owner reviewed these rows personally. They are a sports rehabilitation
  // STUDENT, not a qualified therapist, and the page must say so: a named,
  // dated, attributable check by someone studying the subject is real evidence,
  // but it is not expert sign-off and must not be dressed up as one. It is
  // strongest for palpability, which he practises directly and which published
  // texts almost never state, and weakest anywhere a published work disagrees -
  // where the work wins (see transverse-ligament-of-knee).
  { pattern: /user review|owner review|review page|reviewer/i, title: "Checked by the project owner, a sports rehabilitation student" },
  { pattern: /netter/i, title: "Netter plates supplied by the project owner" },
  { pattern: /z-anatomy|Models-of-human-anatomy/i, title: "Z-Anatomy (Gauthier Kervyn and contributors), CC BY-SA 4.0", url: "https://github.com/Z-Anatomy/Models-of-human-anatomy" },
  { pattern: /gray|wikipedia/i, title: "Gray's Anatomy (public domain, via Wikipedia)", url: 'https://en.wikipedia.org/wiki/Gray%27s_Anatomy' },
  { pattern: /radiopaedia/i, title: 'Radiopaedia', url: 'https://radiopaedia.org/' },
  { pattern: /physio-?pedia/i, title: 'Physiopedia', url: 'https://www.physio-pedia.com/' },
  { pattern: /wikism/i, title: 'WikiSM (Sports Medicine Wiki)', url: 'https://wikism.org/' },
  { pattern: /wheeless/i, title: "Wheeless' Textbook of Orthopaedics", url: 'https://www.wheelessonline.com/' },
  { pattern: /orthobullets/i, title: 'Orthobullets', url: 'https://www.orthobullets.com/' },
  { pattern: /openstax/i, title: 'OpenStax Anatomy & Physiology', url: 'https://openstax.org/details/books/anatomy-and-physiology' },
  { pattern: /anatomy ?standard|rissanen/i, title: 'Anatomy Standard', url: 'https://www.anatomystandard.com/' },
  { pattern: /visible ?body/i, title: 'Visible Body', url: 'https://www.visiblebody.com/learn/' },
  { pattern: /radsource/i, title: 'Radsource MRI Web Clinic', url: 'https://radsource.us/' },
  { pattern: /human kinetics/i, title: 'Human Kinetics' },
  { pattern: /^TA\d|terminologia/i, title: 'Terminologia Anatomica', url: 'https://ta2viewer.openanatomy.org/' },
  { pattern: /medscape/i, title: 'Medscape', url: 'https://emedicine.medscape.com/' },
  // StatPearls sits on the NCBI Bookshelf, so before it had its own line it fell
  // through to the journal-articles entry below. It is a reference work, not a
  // paper, and the blood supply round leans on it more than on anything else,
  // so it is named. Must stay above the journals line: its urls contain "ncbi".
  { pattern: /statpearls|ncbi\.nlm\.nih\.gov\/books/i, title: 'StatPearls (NCBI Bookshelf)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK430685/' },
  // Individual papers collapse into one entry: a reader wants to know that a
  // fact rests on the literature, and the paper itself is in the review file.
  // This read "(open access)" until the blood supply round, most of whose
  // papers were read as PubMed abstracts: the label must not claim more
  // access than the reader will find.
  { pattern: /pmc|pubmed|ncbi|jbjs|viamedica|journal|sciencedirect|doi:|et al|abstract|arthroscopy|cureus|spine j|foot ankle|ajr|clin anat|actaorthop|nature\.com/i, title: 'Peer-reviewed journal articles' },
  // The excluded works still have to resolve to something, or a row that
  // depends on one would silently vanish from the page instead of failing.
  { pattern: /kenhub/i, title: 'Kenhub', url: 'https://www.kenhub.com/' },
  { pattern: /imaios/i, title: 'IMAIOS e-Anatomy', url: 'https://www.imaios.com/' },
  { pattern: /complete ?anatomy|3d4medical|elsevier/i, title: 'Complete Anatomy (Elsevier)', url: 'https://www.elsevier.com/' },
  { pattern: /teachmeanatomy/i, title: 'TeachMeAnatomy', url: 'https://teachmeanatomy.info/' },
];

/**
 * A citation as the ligament round recorded it — free text that may or may not
 * carry a URL, e.g. "Radiopaedia, Ankle joint. https://radiopaedia.org/…" —
 * resolved to the publisher standing behind it.
 */
export function resolvePublisher(raw: string): { title: string; url?: string } {
  const hit = PUBLISHERS.find((p) => p.pattern.test(raw));
  if (hit) return { title: hit.title, url: hit.url };
  // An unrecognised citation is reported under its own name rather than
  // dropped: /sources listing fewer works than were used is the one failure
  // this file cannot have.
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  if (!url) return { title: raw.trim().replace(/[.,;]\s*$/, '') };
  return { title: new URL(url).hostname.replace(/^www\./, ''), url };
}

export function readReviews(root: string, family: string): Record<string, ReviewEntry> {
  const spec = REVIEW_FILES[family];
  if (!spec) return {};
  try {
    const parsed = JSON.parse(readFileSync(`${root}/${spec.file}`, 'utf8')) as Record<string, unknown>;
    return (parsed[spec.key] ?? {}) as Record<string, ReviewEntry>;
  } catch {
    // A family whose review has not been started is not an error — it is the
    // state /sources exists to report.
    return {};
  }
}

/**
 * Blood supply is a fact that runs ACROSS the families rather than a family of
 * its own, and it was reviewed in a separate round with its own file, so it
 * gets its own record instead of a sixth entry in `families` (which the page
 * and its test hold to exactly one per structure category).
 */
export const BLOOD_SUPPLY_FILE = 'blood-supply-review.json';

/** The families a blood supply can belong to. Never a landmark: see generateBloodSupplySeed.ts. */
export const BLOOD_SUPPLY_CATEGORIES = ['muscle', 'bone', 'joint', 'ligament'] as const satisfies readonly Category[];

interface BloodQuote {
  title?: string;
  url?: string;
  quote?: string | null;
}

export interface BloodSupplyRow {
  id: string;
  category: string;
  arteries?: string[];
  unsupported?: string[];
  sources?: { title: string; url?: string }[];
  quotes?: BloodQuote[];
  zone?: { text?: string; quotes?: BloodQuote[] } | null;
  review?: { status?: string; by?: string };
}

export interface BloodSupplyFamily {
  category: Category;
  /** Structures in the family. */
  total: number;
  /** Of those, how many carry an accepted, sourced blood supply. */
  reviewed: number;
  /** Indices into the shared works list. */
  works: number[];
}

export interface BloodSupplyProvenance {
  families: BloodSupplyFamily[];
  /** Landmarks in the app, none of which carries a blood supply. */
  landmarksExcluded: number;
  /** Arteries the draft named that no quoted source backed; dropped from the app. */
  arteriesWithheld: number;
  /** Structures whose rating rests on a documented watershed or avascular zone. */
  zones: number;
  lastChecked: string | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * The acceptance is recorded as prose ("owner, 29 Sep 2026: every high- and
 * medium-confidence row…"), so the date is read out of it. A row whose
 * acceptance carries no readable date is a validation failure, not a blank.
 */
export function acceptedOn(row: BloodSupplyRow): string | null {
  const m = row.review?.by?.match(/(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** The rows the app actually ships: accepted by the owner, and never a landmark. */
export function acceptedBloodRows(rows: BloodSupplyRow[]): BloodSupplyRow[] {
  return rows.filter((r) => r.review?.status === 'accepted' && r.category !== 'landmark');
}

/**
 * The citations a row's blood supply rests on: every source that was fetched
 * and quoted, for the arteries and for the watershed zone. A source listed on
 * the row but with no sentence quoted from it is not evidence and is left out.
 */
export function bloodCitations(row: BloodSupplyRow): { title: string; url: string }[] {
  const quoted = [...(row.quotes ?? []), ...(row.zone?.quotes ?? [])];
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const q of quoted) {
    if (!q.quote || !q.url || seen.has(q.url)) continue;
    seen.add(q.url);
    out.push({ title: q.title ?? '', url: q.url });
  }
  return out;
}

export function readBloodSupply(root: string): BloodSupplyRow[] {
  try {
    return JSON.parse(readFileSync(`${root}/${BLOOD_SUPPLY_FILE}`, 'utf8')) as BloodSupplyRow[];
  } catch {
    return [];
  }
}

/**
 * Reduce the blood supply review to what /sources states. `intern` is the
 * shared works interner, so a publisher already named for another family is
 * the same entry here and its citation count covers both.
 */
export function buildBloodSupply(
  rows: BloodSupplyRow[],
  totals: Record<Category, number>,
  intern: (raw: string) => number,
): BloodSupplyProvenance {
  const accepted = acceptedBloodRows(rows);
  let lastChecked: string | null = null;
  let arteriesWithheld = 0;
  let zones = 0;

  const families = BLOOD_SUPPLY_CATEGORIES.map((category): BloodSupplyFamily => {
    const mine = accepted.filter((r) => r.category === category);
    const works = new Set<number>();
    for (const row of mine) {
      for (const c of bloodCitations(row)) works.add(intern(`${c.title} ${c.url}`));
      arteriesWithheld += (row.unsupported ?? []).length;
      if (row.zone?.text) zones += 1;
      const on = acceptedOn(row);
      if (on && (!lastChecked || on > lastChecked)) lastChecked = on;
    }
    return { category, total: totals[category], reviewed: mine.length, works: [...works].sort((a, b) => a - b) };
  });

  return { families, landmarksExcluded: totals.landmark, arteriesWithheld, zones, lastChecked };
}

/**
 * What is wrong with the accepted rows, as messages. Pure, so the rules can be
 * tested without a review file on disk; validateProvenance.ts fails on each.
 */
export function bloodSupplyFaults(rows: BloodSupplyRow[]): string[] {
  const faults: string[] = [];
  for (const row of acceptedBloodRows(rows)) {
    const linked = (row.sources ?? []).filter((s) => s.title && s.url);
    if (linked.length === 0) {
      faults.push(`blood supply "${row.id}" is accepted but names no source with a url — it must not ship unsourced`);
      continue;
    }
    const cited = bloodCitations(row);
    if (cited.length === 0) {
      faults.push(`blood supply "${row.id}" is accepted but no source is quoted — a source with no quoted sentence is not evidence`);
      continue;
    }
    // Every quoted source being on the excluded list means the row would reach
    // the page resting on nothing we are willing to name.
    if (cited.every((c) => excludedWork(c))) {
      faults.push(
        `blood supply "${row.id}" rests only on excluded works (${cited.map((c) => excludedWork(c)).join(', ')}) — re-check it against another work`,
      );
    }
    if (!acceptedOn(row)) {
      faults.push(`blood supply "${row.id}" is accepted with no readable date in review.by — docs/CLAIMS.md requires a date against every claim`);
    }
  }
  return faults;
}

/**
 * Accepted rows that state a watershed zone with no quote recorded against the
 * zone itself. Not a fault: the muscle round quoted each tendon zone
 * separately, but the bone, joint and ligament rounds wrote the zone from the
 * row's main quotes, so the evidence may well be there — it is just not
 * machine-checkable. That is why /sources does not claim every zone is quoted.
 */
export function zonesWithoutOwnQuote(rows: BloodSupplyRow[]): string[] {
  return acceptedBloodRows(rows)
    .filter((r) => r.zone?.text && !(r.zone.quotes ?? []).some((q) => q.quote && q.url))
    .map((r) => r.id);
}

export interface Built {
  families: FamilyProvenance[];
  works: CitedWork[];
  bloodSupply: BloodSupplyProvenance;
}

/**
 * Reduce the review files plus the seed to what the page renders. `totals` and
 * `deckSources` come from the caller so this stays free of the seed import,
 * which pulls in every image and hotspot.
 */
export function buildProvenance(
  root: string,
  totals: Record<Category, number>,
  deckSources: { deck?: string; author?: string; via?: string }[],
): Built {
  const works: CitedWork[] = [];
  const index = new Map<string, number>();

  const intern = (raw: string): number => {
    const resolved = resolvePublisher(raw);
    const key = resolved.title.toLowerCase();
    const seen = index.get(key);
    if (seen !== undefined) {
      works[seen].citations += 1;
      return seen;
    }
    index.set(key, works.length);
    works.push({ ...resolved, citations: 1 });
    return works.length - 1;
  };

  const families: FamilyProvenance[] = [];

  // Muscles are the one family that came from a person's teaching rather than
  // works we looked up, so they are built from the seed, not a review file.
  const deck = deckSources[0];
  const muscleWorks = new Set<number>();
  if (deck?.deck) {
    const name = `${deck.deck.replace(/\.pdf$/i, '')} — ${deck.author ?? 'unattributed'}, University of Salford`;
    index.set(name.toLowerCase(), works.length);
    works.push({ title: name, citations: deckSources.length });
    muscleWorks.add(works.length - 1);
  }
  // The deck drew on Visible Body, so it is upstream of all 122 and belongs in
  // the list even though we never looked a muscle up there ourselves.
  if (deck?.via) muscleWorks.add(intern(deck.via));

  families.push({
    category: 'muscle',
    total: totals.muscle,
    method: 'lecture-deck',
    scope: 'Origin, insertion, nerve supply and action, cross-referenced against Terminologia Anatomica.',
    checked: deckSources.length,
    held: 0,
    lastChecked: null,
    works: [...muscleWorks].sort((a, b) => a - b),
  });

  for (const category of ['bone', 'landmark', 'joint', 'ligament'] as Category[]) {
    const rows = Object.values(readReviews(root, category));
    const familyWorks = new Set<number>();
    let checked = 0;
    let held = 0;
    let lastChecked: string | null = null;

    for (const row of rows) {
      const grade = row.grade ?? '';
      if (/^verified/.test(grade)) checked += 1;
      if (grade === 'held') held += 1;
      if (row.checked && (!lastChecked || row.checked > lastChecked)) lastChecked = row.checked;
      for (const raw of row.sources ?? []) familyWorks.add(intern(raw));
      for (const w of row.works ?? []) familyWorks.add(intern(`${w.title} ${w.url ?? ''}`));
    }

    families.push({
      category,
      total: totals[category],
      method: 'ai-drafted',
      scope: REVIEW_FILES[category].scope,
      checked,
      held,
      lastChecked,
      works: [...familyWorks].sort((a, b) => a - b),
    });
  }

  // Last, so the indices the families above hold do not move when a blood
  // supply row is added.
  const bloodSupply = buildBloodSupply(readBloodSupply(root), totals, intern);

  return { families, works, bloodSupply };
}
