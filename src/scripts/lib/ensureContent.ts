import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { AREAS } from '../../features/anatomy-revision/types/region';
import { CONTENT_DIR, CONTENT_VERSION_FILE, GENERATED_CONTENT_DIR } from './contentPaths';

/**
 * Makes sure the generated content is there, and is not older than the seed
 * it was cut from — without anyone having to remember to run a command.
 *
 * WHY THIS EXISTS. The index, the vocabulary and the nine area payloads are
 * git-ignored (buildContent.ts says why: a committed copy describes the seed
 * of the day it was committed, and the area files are the paid content in its
 * most convenient form). That was harmless while nothing read them. Now the
 * content function imports the area files and a server-mode build imports the
 * index, so a fresh checkout — or one whose seed has moved on since the last
 * build — could not run its tests or its dev server until somebody ran
 * `npm run generate:content`, and would fail with a missing-module error that
 * says nothing of the kind.
 *
 * Called from vite.config.ts, which the dev server, the test runner and both
 * builds all load, so all four are covered by one check. `npm run build`
 * still runs the generator outright first; this then finds nothing to do.
 *
 * STALE MEANS OLDER THAN ITS INPUTS, by modification time. A hash would be
 * exact and would mean importing the seed here, which is the two seconds this
 * check exists to avoid paying on every start. The cost of the cheaper test
 * is an unnecessary regeneration after a checkout touches a file without
 * changing it — and the generator is deterministic, so that changes nothing.
 */

const SEED_DIR = 'src/features/anatomy-revision/data/seed';

/** Every file the generator's output depends on: the facts, and the code that cuts them. */
function inputs(root: string): string[] {
  const seeds = readdirSync(join(root, SEED_DIR))
    .filter((name) => /^structures\..*\.seed\.ts$/.test(name) || name === 'bloodSupply.generated.ts' || name === 'index.ts')
    .map((name) => join(SEED_DIR, name));
  const sourceDir = 'src/features/anatomy-revision/data/source';
  const sources = existsSync(join(root, sourceDir)) ? readdirSync(join(root, sourceDir)).map((name) => join(sourceDir, name)) : [];
  return [
    ...seeds,
    ...sources,
    'src/features/anatomy-revision/data/content/split.ts',
    'src/features/anatomy-revision/data/content/vocabulary.ts',
    'src/features/anatomy-revision/types/structureIndex.ts',
    'src/features/anatomy-revision/types/structure.ts',
    'src/features/anatomy-revision/types/region.ts',
    'src/features/anatomy-revision/lib/factMastery.ts',
    'src/features/anatomy-revision/lib/questionGenerators/bloodSupply.ts',
    'src/scripts/buildContent.ts',
    'src/scripts/lib/contentBuild.ts',
  ];
}

/** Every file the generator writes. One missing and the whole set is rebuilt. */
export function generatedContentFiles(): string[] {
  return [
    CONTENT_VERSION_FILE,
    ...AREAS.map((area) => `${CONTENT_DIR}/areas/${area}.json`),
    `${GENERATED_CONTENT_DIR}/structureIndex.json`,
    `${GENERATED_CONTENT_DIR}/vocabulary.json`,
    `${GENERATED_CONTENT_DIR}/demoFixture.json`,
  ];
}

const mtime = (path: string): number => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
};

/** Why the content must be regenerated, or null when it is present and current. */
export function contentIsStale(root: string = process.cwd()): string | null {
  const outputs = generatedContentFiles().map((file) => join(root, file));
  const missing = outputs.find((file) => !existsSync(file));
  if (missing) return `${missing} is missing`;
  const oldestOutput = Math.min(...outputs.map(mtime));
  const newer = inputs(root).find((file) => mtime(join(root, file)) > oldestOutput);
  return newer ? `${newer} has changed since it was generated` : null;
}

let checked = false;

/** Runs `generate:content` if its output is missing or stale. Once per process. */
export function ensureGeneratedContent(root: string = process.cwd()): void {
  if (checked) return;
  checked = true;
  const reason = contentIsStale(root);
  if (!reason) return;
  console.log(`generate:content — ${reason}`);
  // tsx's own entry point, run with this Node: no shell, so no PATH and no
  // Windows .cmd shim to get wrong.
  const tsx = createRequire(join(root, 'package.json')).resolve('tsx/cli');
  execFileSync(process.execPath, [tsx, 'src/scripts/buildContent.ts'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}
