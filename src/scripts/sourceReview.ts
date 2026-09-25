import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { isBone, isJoint, isLandmark, type AnatomyStructure } from '../features/anatomy-revision/types/structure';
import { REVIEW_FILES } from './lib/provenance';

/**
 * Tier 2 of the source-check: drives the literature pass over the bones,
 * joints and landmarks, and records what a named work actually said.
 *
 *   npx tsx src/scripts/sourceReview.ts --family joint --next 8
 *   npx tsx src/scripts/sourceReview.ts --family joint --record findings.json
 *   npx tsx src/scripts/sourceReview.ts --family joint --stats
 *
 * WHY THIS EXISTS SEPARATELY FROM meshCrossCheck.ts. That script proves the
 * content agrees with itself and with the plates it is drawn from. It cannot
 * prove a fact true — a model shows two bones touching, and touching is not
 * articulating. This is the pass that opens a work, reads it, and quotes it.
 *
 * RESUMABLE BY CONSTRUCTION. --next emits only ids absent from the review
 * file, so a tranche can stop anywhere and the next run picks up where it
 * left off. Nothing is inferred from a previous session's memory.
 *
 * WHAT A ROW HAS TO CARRY. validateProvenance fails a `verified` row without a
 * work carrying a quote AND either a url or a named document, and without a
 * `checked` date. That is
 * deliberate: the ligament round shipped 32 rows graded with no citation, and
 * a grade nobody can re-open is indistinguishable from a guess.
 *
 * THE MOVEMENTS FIELD IS THE DANGEROUS ONE. multiSelect.ts builds "which
 * movement is NOT possible at the X" by taking movements from OTHER joints and
 * asserting this one cannot do them. So an OMITTED movement does not leave a
 * gap — it manufactures a confidently false question and marks a student wrong
 * for knowing better. For movements, completeness is the check: the work has
 * to be shown to list nothing the seed leaves out.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

interface Work {
  title: string;
  url?: string;
  /** A non-web source re-openable by name: a named lecture deck, a textbook. */
  document?: string;
  quote?: string;
}
interface Fact {
  verdict: 'confirmed' | 'corrected' | 'held';
  was?: unknown;
  now?: unknown;
  why?: string;
}
interface ReviewRow {
  grade?: 'verified' | 'unverified' | 'held';
  checked?: string;
  works?: Work[];
  facts?: Record<string, Fact>;
}
interface ReviewFile {
  schemaVersion: number;
  note: string;
  reviews: Record<string, ReviewRow>;
}

const FAMILIES = ['bone', 'joint', 'landmark'] as const;
type Family = (typeof FAMILIES)[number];

/** The fields each family's pass has to settle, in the order to check them. */
const FIELDS: Record<Family, string[]> = {
  joint: ['jointType', 'articulatingStructureIds', 'movements', 'stabilizers'],
  bone: ['articulations', 'attachments', 'description'],
  landmark: ['parentBoneId', 'description', 'attachments', 'palpability'],
};

function args(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    out[key] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true;
  }
  return out;
}

function pathFor(family: Family): string {
  return `${ROOT}/${REVIEW_FILES[family].file}`;
}

function load(family: Family): ReviewFile {
  const p = pathFor(family);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as ReviewFile;
  return {
    schemaVersion: 1,
    note:
      `Literature source-check for the ${family}s. Each row records what a NAMED work said about ` +
      'this structure, with the sentence it said it in. Written by src/scripts/sourceReview.ts --record; ' +
      'read by generateProvenance.ts, which is what /sources renders. A row graded verified needs a work ' +
      'carrying a quote plus a url or a named document, and a checked date, or validate-content fails. Corrections are hand-applied ' +
      'to the seed and then asserted here — an automated correction to unverified content is not evidence.',
    reviews: {},
  };
}

function save(family: Family, file: ReviewFile): void {
  writeFileSync(pathFor(family), JSON.stringify(file, null, 1));
}

function members(family: Family): AnatomyStructure[] {
  const test = family === 'joint' ? isJoint : family === 'bone' ? isBone : isLandmark;
  return ALL_STRUCTURES.filter(test);
}

/** What a reviewer has to adjudicate for this structure, printed to be read. */
function claimsOf(s: AnatomyStructure, family: Family): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const f of FIELDS[family]) {
    const v = (s as unknown as Record<string, unknown>)[f];
    if (v !== undefined && v !== null) row[f] = v;
  }
  return row;
}

const opts = args();
const family = (opts.family as Family) ?? 'joint';
if (!FAMILIES.includes(family)) {
  console.error(`--family must be one of ${FAMILIES.join(', ')}`);
  process.exit(1);
}

const file = load(family);
const all = members(family);
const done = new Set(Object.keys(file.reviews));

if (opts.stats || (!opts.next && !opts.record)) {
  const verified = Object.values(file.reviews).filter((r) => r.grade === 'verified').length;
  const held = Object.values(file.reviews).filter((r) => r.grade === 'held').length;
  console.log(`${family}: ${all.length} total, ${done.size} reviewed (${verified} verified, ${held} held), ${all.length - done.size} to go`);
  console.log(`fields each row settles: ${FIELDS[family].join(', ')}`);
  console.log(`file: ${REVIEW_FILES[family].file}`);
}

if (opts.next) {
  const n = Number(opts.next) || 8;
  const queue = all.filter((s) => !done.has(s.id)).slice(0, n);
  console.log(JSON.stringify({ family, fields: FIELDS[family], structures: queue.map((s) => ({ id: s.id, name: s.name, ...claimsOf(s, family) })) }, null, 1));
}

if (typeof opts.record === 'string') {
  const batch = JSON.parse(readFileSync(opts.record, 'utf8')) as Record<string, ReviewRow>;
  const ids = new Set(all.map((s) => s.id));
  let added = 0;
  const bad: string[] = [];

  for (const [id, row] of Object.entries(batch)) {
    if (!ids.has(id)) {
      bad.push(`${id}: not a ${family} in the seed`);
      continue;
    }
    if (row.grade === 'verified') {
      // A quote is always required — it is what makes the grade re-openable.
      // A url OR a named document satisfies "where": the muscle deck is a PDF
      // with no url, and is no less citable for it.
      const ok = (row.works ?? []).some((w) => w.quote && (w.url || w.document));
      if (!ok) {
        bad.push(`${id}: graded verified with no work carrying a quote plus a url or document`);
        continue;
      }
      if (!row.checked) {
        bad.push(`${id}: graded verified with no checked date`);
        continue;
      }
    }
    file.reviews[id] = row;
    added += 1;
  }

  save(family, file);
  console.log(`recorded ${added} ${family} row(s); ${all.length - Object.keys(file.reviews).length} left`);
  if (bad.length) console.log(`\nREJECTED (${bad.length}):\n  ${bad.join('\n  ')}`);
  console.log('\nNow run: npx tsx src/scripts/generateProvenance.ts && npm run validate-content');
}
