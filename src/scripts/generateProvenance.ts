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

const { families, works } = buildProvenance(root, totals, deckSources);

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

const out = `/**
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
${familyLines}
];

export const WORKS: ProvenanceWork[] = [
${workLines}
];
`;

const target = `${root}/src/features/legal/data/provenance.generated.ts`;
writeFileSync(target, out.replace(/\n/g, '\r\n'));
const checked = families.reduce((n, f) => n + f.checked, 0);
const total = families.reduce((n, f) => n + f.total, 0);
console.log(`Wrote ${families.length} families (${checked}/${total} checked), ${works.length} works to ${target}`);
