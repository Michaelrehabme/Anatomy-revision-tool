import { readFileSync } from 'node:fs';
import type { Category } from '../../features/anatomy-revision/types/structure';
import { buildProvenance, excludedWork, readReviews, REVIEW_FILES } from './provenance';

/**
 * Checks behind the /sources page. Split out of validateContent.ts because it
 * reads files rather than the seed, but called from the same run so there is
 * one command a deploy has to pass.
 *
 * The page states how much of the content rests on a named source. That is an
 * accuracy claim about an accuracy claim, and the only thing standing between
 * it and quiet drift is this file.
 */

interface Reporter {
  fail: (message: string) => void;
  warn: (message: string) => void;
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function validateProvenance(
  root: string,
  totals: Record<Category, number>,
  deckSources: { deck?: string; author?: string; via?: string }[],
  { fail, warn }: Reporter,
): void {
  const built = buildProvenance(root, totals, deckSources);

  // 1. The committed summary must match what the reviews actually say. The page
  //    reads the summary, so a stale one is a published number with no evidence.
  let generated: string;
  try {
    generated = readFileSync(`${root}/src/features/legal/data/provenance.generated.ts`, 'utf8');
  } catch {
    fail(
      'src/features/legal/data/provenance.generated.ts is missing — /sources has nothing to render. ' +
        'Run: npx tsx src/scripts/generateProvenance.ts',
    );
    return;
  }

  for (const family of built.families) {
    const block = generated.match(new RegExp(`category: "${family.category}"[\\s\\S]*?\\n  \\},`));
    if (!block) {
      fail(`provenance.generated.ts has no block for "${family.category}" — regenerate it`);
      continue;
    }
    for (const [field, value] of [
      ['total', family.total],
      ['checked', family.checked],
      ['held', family.held],
    ] as const) {
      const stated = Number(block[0].match(new RegExp(`${field}: (\\d+)`))?.[1]);
      if (stated !== value) {
        fail(
          `/sources would state ${family.category} ${field} = ${stated}, but the review files say ${value}. ` +
            'Run: npx tsx src/scripts/generateProvenance.ts',
        );
      }
    }
  }

  // 2. A work we have decided not to cite must not reach the page. Dropping the
  //    name while the record still rests on it would make the page's work-set
  //    incomplete, so the only fix is to re-check the rows that depend on it.
  for (const work of built.works) {
    const excluded = excludedWork(work);
    if (excluded) {
      fail(
        `/sources would name "${work.title}", which is on the excluded list (${excluded}). ` +
          `${work.citations} citation(s) still rest on it — re-check those rows against another work. ` +
          'See EXCLUDED_WORKS in src/scripts/lib/provenance.ts',
      );
    }
  }

  // 3. A grade is only worth the evidence under it.
  const now = Date.now();
  for (const [family, spec] of Object.entries(REVIEW_FILES)) {
    const reviews = readReviews(root, family);
    let undated = 0;
    let uncited = 0;
    let stale = 0;

    for (const [id, row] of Object.entries(reviews)) {
      if (!/^verified/.test(row.grade ?? '')) continue;
      // A citation has to be re-openable by somebody who doubts it. The
      // ligament round shipped 32 rows graded with no citation at all, which
      // is indistinguishable from a guess once the session that made it ends.
      // Legacy `sources` rows are free text and are counted as-is; the newer
      // `works` rows must carry a url AND the sentence the work said it in.
      const legacy = row.sources?.length ?? 0;
      const proper = (row.works ?? []).filter((w) => w.quote && (w.url || w.document)).length;
      const cites = legacy + proper;
      if (cites === 0) {
        uncited += 1;
        if (uncited <= 3) fail(`${family} "${id}" is graded verified but cites no work — a grade with no citation is not a grade`);
      }
      if (!row.checked) undated += 1;
      else if (now - Date.parse(row.checked) > ONE_YEAR_MS) stale += 1;
    }

    if (uncited > 3) fail(`…and ${uncited - 3} more ${family} rows graded verified with no work cited`);
    if (undated > 0) {
      fail(
        `${undated} ${family} row(s) graded verified carry no \`checked\` date. ` +
          'docs/CLAIMS.md requires a date against every claim; a grade of unknown age cannot be re-verified',
      );
    }
    if (stale > 0) warn(`${stale} ${family} row(s) were last checked over a year ago — see the Routine in docs/CLAIMS.md`);

    // 4. A review entry that resolves to nothing is a decision applying to
    //    nothing, which usually means an id was renamed under it.
    if (Object.keys(reviews).length > 0 && !spec) fail(`No review spec for family "${family}"`);
  }

  // 5. One line per family rather than one per structure. 198 unverified
  //    warnings would drown the 273 this run already prints, and the state is
  //    reported on /sources anyway — this is a reminder, not a fault.
  const outstanding = built.families
    .filter((f) => f.method === 'ai-drafted' && f.checked < f.total)
    .map((f) => `${f.category} ${f.total - f.checked}/${f.total}`)
    .join(', ');
  if (outstanding) {
    console.log(`\nSource-check outstanding: ${outstanding}. /sources states this; it is not a build failure.`);
  }
}

/** The ids a reviewer has not reached yet, for sourceReview.ts --next. */
export function unreviewedIds(root: string, family: string, ids: string[]): string[] {
  const reviews = readReviews(root, family);
  return ids.filter((id) => !reviews[id]);
}
