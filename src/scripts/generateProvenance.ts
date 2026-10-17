import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { CATEGORIES, isMuscle, type Category } from '../features/anatomy-revision/types/structure';
import { buildProvenance } from './lib/provenance';

/**
 * Regenerates src/features/legal/data/provenance.generated.ts — the aggregate
 * /sources renders — from the seed and the root *-source-review JSONs.
 *
 * Why a committed summary rather than reading the reviews at runtime: the
 * reviews carry a fetched quote per fact, which for the ligaments alone was
 * 22 kB of the chunk every student downloads to answer a question, rendered
 * nowhere. This file holds counts and distinct works only, ~4 kB, and it lands
 * in the lazy legal chunk. See the layering note in the /sources plan.
 *
 * Run after any source-review file changes; validateContent.ts FAILS if this
 * file and those reviews disagree, so a stale run cannot reach a deploy:
 *
 *   npx tsx src/scripts/generateProvenance.ts
 */

const root = fileURLToPath(new URL('../..', import.meta.url));

const totals = Object.fromEntries(
  CATEGORIES.map((c) => [c, ALL_STRUCTURES.filter((s) => s.category === c).length]),
) as Record<Category, number>;

const deckSources = ALL_STRUCTURES.filter(isMuscle)
  .map((m) => m.source)
  .filter((s): s is NonNullable<typeof s> => Boolean(s?.deck));

const muscleIds = ALL_STRUCTURES.filter(isMuscle).map((m) => m.id);
const { families, works, bloodSupply, byStructure } = buildProvenance(root, totals, deckSources, muscleIds);

// JSON.stringify IS the escaping primitive here — a hand-rolled quote escape in a
// generator that writes TypeScript is how a stray apostrophe becomes a syntax error.
const lit = (s: string): string => JSON.stringify(s);

const familyLines = families
  .map(
    (f) =>
      `  {\n` +
      `    category: ${lit(f.category)},\n` +
      `    total: ${f.total},\n` +
      `    method: ${lit(f.method)},\n` +
      `    scope: ${lit(f.scope)},\n` +
      `    checked: ${f.checked},\n` +
      `    held: ${f.held},\n` +
      `    lastChecked: ${f.lastChecked ? lit(f.lastChecked) : 'null'},\n` +
      `    works: [${f.works.join(', ')}],\n` +
      `  },`,
  )
  .join('\n');

const workLines = works
  .map((w) => `  { title: ${lit(w.title)}${w.url ? `, url: ${lit(w.url)}` : ''}, citations: ${w.citations} },`)
  .join('\n');

const bloodLines = bloodSupply.families
  .map(
    (f) =>
      `    { category: ${lit(f.category)}, total: ${f.total}, reviewed: ${f.reviewed}, works: [${f.works.join(', ')}] },`,
  )
  .join('\n');

const out = `/**
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
${familyLines}
];

export const WORKS: ProvenanceWork[] = [
${workLines}
];

export const BLOOD_SUPPLY: BloodSupplyProvenance = {
  families: [
${bloodLines}
  ],
  landmarksExcluded: ${bloodSupply.landmarksExcluded},
  arteriesWithheld: ${bloodSupply.arteriesWithheld},
  zones: ${bloodSupply.zones},
  lastChecked: ${bloodSupply.lastChecked ? lit(bloodSupply.lastChecked) : 'null'},
};
`;

const target = `${root}/src/features/legal/data/provenance.generated.ts`;
writeFileSync(target, out.replace(/\n/g, '\r\n'));
// The works behind each structure, for its Atlas card. Its own file, beside
// the seed, so the card does not pull the /sources page in with it.
const structureLines = Object.keys(byStructure)
  .sort()
  .map((id) => `  ${lit(id)}: [[${byStructure[id].facts.join(', ')}], [${byStructure[id].blood.join(', ')}]],`)
  .join('\n');
const structureOut = `/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/generateProvenance.ts
 *
 * The works each structure's facts, then its blood supply, were checked
 * against: indices into WORKS in features/legal/data/provenance.generated.ts.
 * Read by the Atlas card's sources line.
 */
export const STRUCTURE_SOURCES: Readonly<Record<string, readonly [readonly number[], readonly number[]]>> = {
${structureLines}
};
`;
const structureTarget = `${root}/src/features/anatomy-revision/data/structureSources.generated.ts`;
writeFileSync(structureTarget, structureOut.replace(/\n/g, '\r\n'));
const checked = families.reduce((n, f) => n + f.checked, 0);
const total = families.reduce((n, f) => n + f.total, 0);
console.log(`Blood supply: ${bloodSupply.families.map((f) => `${f.category} ${f.reviewed}/${f.total}`).join(', ')}`);
console.log(`Wrote ${families.length} families (${checked}/${total} checked), ${works.length} works to ${target}`);
