/**
 * The seed -> the bundled index and vocabulary, one payload of facts per
 * area, and the content version.
 *
 *   npm run generate:content   (from the repo root; both builds run it first)
 *
 * docs/DESIGN-CONTENT-BEHIND-SERVER.md is the design this implements. In short:
 * a structure's NAME, category, areas and pictures ship to everyone, and its
 * FACTS are to be served per area to whoever is entitled to that area. This
 * script makes the cut, along the two field lists in types/structureIndex.ts:
 *
 *   src/features/anatomy-revision/data/content/generated/structureIndex.json
 *   src/features/anatomy-revision/data/content/generated/vocabulary.json
 *       For the bundle. Index entries hold no facts; the vocabulary holds
 *       wrong answers that belong to no structure (data/content/vocabulary.ts).
 *
 *   src/features/anatomy-revision/data/content/generated/demoFixture.json
 *       The facts of two areas, for the public demo to bundle in place of the
 *       whole seed (data/content/demoFixtureAreas.ts). Imported only by a
 *       build that asks for the fixture; the real app never reaches it.
 *
 *   .content/areas/<area>.json
 *       The facts, for the content function to import. Under the repo root and
 *       NOT under public/, which is the whole point of the directory: Vite
 *       copies public/ into dist/ verbatim, and a facts file there is a facts
 *       file on the CDN for anyone who guesses its name.
 *
 *   .content/version.json
 *       The content version — a hash of the facts — and a per-area summary.
 *       vite.config.ts reads it and defines __CONTENT_VERSION__ from it.
 *
 * GENERATED AT BUILD, NOT COMMITTED, for the reason the offline manifests are
 * not (generateOfflineManifests.ts): a copy checked in last week describes
 * last week's seed. The area files have a second reason — they are the paid
 * content in its most convenient form. The seed .ts files stay the source of
 * truth for validate-content, /sources, the offline manifests and the
 * authoring tools, none of which read anything written here.
 *
 * WHO READS THEM. The content function imports the area files and the version
 * (netlify/functions/content-area.ts). A build made with
 * VITE_CONTENT_SOURCE=server imports the index and the vocabulary in place of
 * the seed (data/content/bundledContent.server.ts). The default build still
 * bundles the seed and reads only the version.
 *
 * NOBODY HAS TO REMEMBER TO RUN THIS: vite.config.ts regenerates when the
 * output is missing or older than the seed (src/scripts/lib/ensureContent.ts),
 * which covers the dev server, the tests and both builds.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUTHORED_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { AREAS } from '../features/anatomy-revision/types/region';
import { buildContent } from './lib/contentBuild';
import { CONTENT_DIR, GENERATED_CONTENT_DIR, isPublishedPath } from './lib/contentPaths';

const ROOT = process.cwd();
const contentDir = join(ROOT, CONTENT_DIR);
const areaDir = join(contentDir, 'areas');
const generatedDir = join(ROOT, GENERATED_CONTENT_DIR);

// A guard on the one mistake that would undo the feature: pointing the facts
// at a directory the build publishes.
if (isPublishedPath(CONTENT_DIR)) {
  console.error(`ERROR: ${CONTENT_DIR} is inside a directory that is deployed. The area files must stay out of it.`);
  process.exit(1);
}

// The AUTHORED structures, before their pictures are linked: see the note on
// AUTHORED_STRUCTURES in data/seed/index.ts. The app links the index to its
// images at load, exactly as it links the seed today.
const built = buildContent(AUTHORED_STRUCTURES);

// A rerun must not leave a payload behind for an area that no longer exists.
mkdirSync(areaDir, { recursive: true });
for (const name of readdirSync(areaDir)) {
  if (name.endsWith('.json')) rmSync(join(areaDir, name));
}
mkdirSync(generatedDir, { recursive: true });

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
const report = (label: string, text: string) =>
  console.log(
    `${label.padEnd(36)} ${kb(Buffer.byteLength(text)).padStart(9)}   gzip ${kb(gzipSync(text).length).padStart(8)}`,
  );

writeFileSync(join(generatedDir, 'structureIndex.json'), built.index);
report('generated/structureIndex.json', built.index);
writeFileSync(join(generatedDir, 'vocabulary.json'), built.vocabulary);
report('generated/vocabulary.json', built.vocabulary);
writeFileSync(join(generatedDir, 'demoFixture.json'), built.demoFixture);
report('generated/demoFixture.json', built.demoFixture);

for (const area of AREAS) {
  writeFileSync(join(areaDir, `${area}.json`), built.areas[area]);
  report(`${CONTENT_DIR}/areas/${area}.json`, built.areas[area]);
}
writeFileSync(join(contentDir, 'version.json'), built.versionFile);

console.log(`content version ${built.version}: ${AUTHORED_STRUCTURES.length} structures across ${AREAS.length} areas`);
