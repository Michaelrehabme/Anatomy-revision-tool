/**
 * Says how much a phone stores on a first visit, and warns before any one file
 * comes near the size the service worker will refuse.
 *
 *   npx tsx src/scripts/checkPrecacheSize.ts [dist]
 *
 * WHY. Twice the build has failed outright at the precache step, both times
 * with no warning beforehand: the entry chunk crept over Workbox's per-file
 * ceiling (2 MiB on 17 Sep, raised to 3 MiB on 16 Oct 2026), and nothing could
 * be deployed until it was dealt with. And the precache as a whole is what a
 * student's phone downloads and keeps before the app works offline, which had
 * grown to 25 MB unnoticed, most of it hotspot outlines (hotspotCodec.ts).
 *
 * WARNS, NEVER FAILS. Workbox already fails the build at the ceiling itself;
 * this is the notice that comes first, while there is still room to move a
 * seed into its own chunk instead of raising the limit again.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PRECACHE_MAX_FILE_BYTES } from './lib/precacheLimit';

const WARN_AT = 0.8;

const dist = join(process.cwd(), process.argv[2] ?? 'dist');
let sw: string;
try {
  sw = readFileSync(join(dist, 'sw.js'), 'utf8');
} catch {
  console.log(`precache check: no service worker in ${dist}, nothing to check.`);
  process.exit(0);
}

const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
const files = urls
  .map((url) => {
    try {
      return { url, bytes: statSync(join(dist, url)).size };
    } catch {
      return null;
    }
  })
  .filter((f): f is { url: string; bytes: number } => f !== null)
  .sort((a, b) => b.bytes - a.bytes);

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;
const total = files.reduce((sum, f) => sum + f.bytes, 0);
console.log(`precache: ${files.length} files, ${mb(total)} stored on a first visit. Largest: ${files[0]?.url} ${mb(files[0]?.bytes ?? 0)}.`);

const near = files.filter((f) => f.bytes > PRECACHE_MAX_FILE_BYTES * WARN_AT);
for (const f of near) {
  console.warn(
    `WARNING precache: ${f.url} is ${mb(f.bytes)}, ${Math.round((f.bytes / PRECACHE_MAX_FILE_BYTES) * 100)}% of the ` +
      `${mb(PRECACHE_MAX_FILE_BYTES)} a service worker will precache. Over it, the build fails. ` +
      `Move a large seed behind import() before raising the limit.`,
  );
}
