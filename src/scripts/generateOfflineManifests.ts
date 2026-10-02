/**
 * The seed + public/anatomy/ -> public/offline/index.json and one <area>.json each.
 *
 *   npm run generate:offline   (from the repo root; `npm run build` runs it first)
 *
 * These are what "download for offline" downloads against: every file an area
 * needs, with its size and the start of its SHA-256 (features/pwa/offline/
 * manifest.ts has the format and why a hash is in it).
 *
 * GENERATED AT BUILD, NOT COMMITTED. Every other generated file here is a .ts
 * seed that is checked in, and these deliberately are not, because they are a
 * statement about BYTES ON DISK rather than about content: a manifest written
 * last week and committed describes last week's renders, and an offline
 * download validated against it would reject every picture redrawn since as
 * corrupt. Running as part of the build means the manifests in a deploy are
 * the manifests OF that deploy, by construction, with nothing to remember.
 * public/offline/ is in .gitignore for the same reason dist/ is.
 *
 * Which pictures an area needs is not decided here — areaImages.ts asks the
 * session's own generators — so this file is only the part that touches disk.
 *
 * A missing file is a hard error. The seed claiming a picture that is not
 * there is already a blank question online; in a manifest it would be a
 * download that can never complete.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_IMAGES, ALL_STRUCTURES } from '../features/anatomy-revision/data/seed';
import { attachHotspots } from '../features/anatomy-revision/data/seed/hotspots';
import { AREAS, type Area } from '../features/anatomy-revision/types/region';
import { filePathsByArea } from '../features/pwa/offline/areaImages';
import {
  HASH_LENGTH,
  OFFLINE_MANIFEST_DIR,
  OFFLINE_MANIFEST_VERSION,
  formatBytes,
  manifestHashInput,
  type AreaManifest,
  type AreaSummary,
  type ManifestFile,
  type OfflineIndex,
} from '../features/pwa/offline/manifest';

// Without the hotspots no locate or identify question has a picture to open
// on, and every area would come out as its single-structure panels alone.
await attachHotspots();

const PUBLIC = join(process.cwd(), 'public');
const OUT = join(PUBLIC, OFFLINE_MANIFEST_DIR);

const shortHash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex').slice(0, HASH_LENGTH);

/** Each file is read once however many areas share it — the spine's three share most of theirs. */
const described = new Map<string, ManifestFile>();
function describe(url: string): ManifestFile {
  let entry = described.get(url);
  if (!entry) {
    let data: Buffer;
    try {
      data = readFileSync(join(PUBLIC, url));
    } catch {
      console.error(`ERROR: the seed names ${url}, which is not in public/. Publish the render or drop the image.`);
      process.exit(1);
    }
    entry = { url, bytes: data.length, hash: shortHash(data) };
    described.set(url, entry);
  }
  return entry;
}

const paths = filePathsByArea(ALL_STRUCTURES, ALL_IMAGES);

// A rerun must not leave a manifest behind for an area that no longer exists.
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  if (name.endsWith('.json')) rmSync(join(OUT, name));
}

const summaries = {} as Record<Area, AreaSummary>;
for (const area of AREAS) {
  const files = paths[area].map(describe);
  const manifest: AreaManifest = {
    version: OFFLINE_MANIFEST_VERSION,
    area,
    hash: shortHash(manifestHashInput(files)),
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
    files,
  };
  writeFileSync(join(OUT, `${area}.json`), JSON.stringify(manifest));
  summaries[area] = { bytes: manifest.bytes, files: files.length, hash: manifest.hash };
  console.log(`offline/${area}.json: ${files.length} files, ${formatBytes(manifest.bytes)}`);
}

const index: OfflineIndex = { version: OFFLINE_MANIFEST_VERSION, areas: summaries };
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));

const unique = [...described.values()].reduce((sum, f) => sum + f.bytes, 0);
console.log(`offline/index.json: ${AREAS.length} areas, ${described.size} files, ${formatBytes(unique)} without the overlap`);
