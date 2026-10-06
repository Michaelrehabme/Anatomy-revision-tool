/**
 * Fails the build if a build that should carry no facts carries one.
 *
 *   npm run check:bundle            (run at the end of `npm run build`)
 *   npm run check:bundle -- dist-demo
 *
 * docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 7. A build made with
 * VITE_CONTENT_SOURCE=server is meant to ship names and pictures and fetch
 * every fact from the content function. Whether it does is a property of the
 * BUILT FILES, and the only honest way to know is to read them: the lint rule
 * (eslint.config.js) stops the obvious import, but a re-export, a new alias
 * spelling or a bundler change could put the seed back with nothing failing.
 *
 * WHAT IT LOOKS FOR. Each structure's description: a sentence written for
 * this product, long, and not the name of anything. The design said to look
 * for an origin string, which does not work — "Ischial tuberosity" is an
 * origin AND a landmark's name, and names are public. A description appears
 * in a file only if that structure's facts do.
 *
 * WHERE. Every .js file in the output, not the entry chunk alone: the admin,
 * educator and legal chunks are served from the same public directory.
 *
 * WHAT EACH KIND OF BUILD MAY CONTAIN (data/content/contentSource.ts):
 *   bundled   everything. Nothing to check; it says so and passes.
 *   server    nothing.
 *   fixture   the two demo areas' structures, and no others.
 *
 * NOTHING IS EXEMPT. The diagnostic's papers are in every build
 * (data/diagnostic/papers.v3.json) and hold no facts: they name structures,
 * and the questions are built at the sitting from what the sitter holds
 * (features/anatomy-revision/lib/diagnosticPapers.ts). An earlier, public
 * paper of finished questions needed an allowance here; it never shipped,
 * and the allowance went with it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { AUTHORED_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { DEMO_FIXTURE_AREAS } from '../features/anatomy-revision/data/content/demoFixtureAreas';
import { areasOf } from '../features/anatomy-revision/types/structure';
import { descriptionCanaries, findLeaks, type BuiltFile } from './lib/bundleFacts';

/** Shorter than this and a description could be a phrase that turns up elsewhere by chance. */
const MIN_CANARY_LENGTH = 40;

type Variant = 'bundled' | 'server' | 'fixture';

const dir = process.argv[2] ?? 'dist';
const demo = dir === 'dist-demo';

/** The same decision vite.config.ts and vite.config.demo.ts make, from the same variables. */
function variant(): Variant {
  const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
  const source = env.VITE_CONTENT_SOURCE;
  if (demo) return source === 'fixture' || source === 'server' ? 'fixture' : 'bundled';
  if (source === 'fixture') return 'fixture';
  if (source !== 'server') return 'bundled';
  return (env.VITE_PERSISTENCE ?? 'local') === 'firestore' ? 'server' : 'fixture';
}

function* scripts(root: string): Generator<string> {
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) yield* scripts(path);
    else if (/\.(js|mjs|json|html)$/.test(name)) yield path;
  }
}

const kind = variant();
if (kind === 'bundled') {
  console.log(`check:bundle — ${dir} is a bundled build: every area's facts are in it by design. Nothing to check.`);
  process.exit(0);
}

const allowed = new Set(
  kind === 'fixture'
    ? AUTHORED_STRUCTURES.filter((s) => areasOf(s).some((a) => DEMO_FIXTURE_AREAS.includes(a))).map((s) => s.id)
    : [],
);
const canaries = descriptionCanaries(AUTHORED_STRUCTURES.filter((s) => !allowed.has(s.id)), MIN_CANARY_LENGTH);

let files = 0;
function* built(): Generator<BuiltFile> {
  for (const path of scripts(dir)) {
    files += 1;
    yield { path, text: readFileSync(path, 'utf8') };
  }
}
const leaks = findLeaks(built(), canaries);

if (files === 0) {
  console.error(`check:bundle — no built files found in ${dir}. Build first.`);
  process.exit(1);
}

if (leaks.size > 0) {
  console.error(`\ncheck:bundle — FAILED. A ${kind} build must not contain these structures' facts, and ${dir} does:\n`);
  for (const [file, ids] of leaks) {
    console.error(`  ${file}: ${ids.length} structures (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''})`);
  }
  console.error(
    '\nSomething imports the structure seed outside data/content/bundledContent.ts, or reaches\n' +
      'bundledContent by a specifier the alias in vite.config.ts does not rewrite.\n',
  );
  process.exit(1);
}

console.log(
  `check:bundle — ${dir} is a ${kind} build: ${files} files read, ${canaries.length} structures' descriptions looked for, none found` +
    (kind === 'fixture' ? ` (the ${allowed.size} structures of ${DEMO_FIXTURE_AREAS.join(' and ')} are allowed).` : '.'),
);
