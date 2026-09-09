import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Regenerates src/features/legal/data/ossLicences.generated.ts from the
 * dependencies actually installed in node_modules.
 *
 * Direct dependencies only, not the full transitive tree. CC BY-SA compliance
 * (CR-025) turns on the anatomy imagery, not on npm packages; this list is here
 * because both stores expect an open-source notices page, and a hand-typed one
 * goes stale the first time a dependency changes. Run after adding or upgrading
 * a dependency:
 *
 *   npx tsx src/scripts/generateOssLicences.ts
 */

const root = fileURLToPath(new URL('../..', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

interface Entry {
  name: string;
  version: string;
  licence: string;
}

function read(name: string): Entry | null {
  try {
    const meta = JSON.parse(readFileSync(`${root}/node_modules/${name}/package.json`, 'utf8')) as {
      version?: string;
      license?: string | { type?: string };
      licenses?: { type?: string }[];
    };
    const licence =
      typeof meta.license === 'string'
        ? meta.license
        : (meta.license?.type ?? meta.licenses?.[0]?.type ?? 'See package');
    return { name, version: meta.version ?? 'unknown', licence };
  } catch {
    // A dependency that is declared but not installed should not stop the page
    // being generated — it shows up as missing from the list instead.
    return null;
  }
}

const entries = Object.keys(pkg.dependencies ?? {})
  .sort()
  .map(read)
  .filter((e): e is Entry => e !== null);

const body = entries
  .map((e) => `  { name: '${e.name}', version: '${e.version}', licence: '${e.licence.replace(/'/g, "\\'")}' },`)
  .join('\n');

const out = `/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/generateOssLicences.ts
 *
 * Direct runtime dependencies and their declared licences, read from
 * node_modules at generation time. See that script for why this is a
 * committed file rather than a build step.
 */
export interface OssLicence {
  name: string;
  version: string;
  licence: string;
}

export const OSS_LICENCES: OssLicence[] = [
${body}
];
`;

const target = `${root}/src/features/legal/data/ossLicences.generated.ts`;
writeFileSync(target, out);
console.log(`Wrote ${entries.length} dependencies to ${target}`);
