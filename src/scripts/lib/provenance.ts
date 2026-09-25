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
  works?: { title: string; url?: string }[];
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
  // Individual papers collapse into one entry: a reader wants to know that a
  // fact rests on the literature, and the paper itself is in the review file.
  { pattern: /pmc|pubmed|ncbi|jbjs|viamedica|journal|sciencedirect|doi:|et al|abstract|arthroscopy|cureus|spine j|foot ankle|ajr|clin anat/i, title: 'Peer-reviewed journal articles (open access)' },
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

export interface Built {
  families: FamilyProvenance[];
  works: CitedWork[];
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

  return { families, works };
}
