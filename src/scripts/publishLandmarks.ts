import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Publishes the landmark images and their target hotspots.
 *
 *   npx tsx src/scripts/publishLandmarks.ts --masks renders/landmarks
 *
 * A landmark is a point, not a shape, so its hotspot is a circle rather than a
 * traced silhouette — the same circle the archery scoring aims at. Its radius
 * is the landmark's REAL size: the model is life-size, so a 20mm trochanter
 * gets a bigger target than an 8mm tuberosity, which is what makes the scoring
 * fair rather than arbitrary.
 *
 * ONLY VIEWS THAT SHOW IT. renderLandmarkMarkers.py casts a ray per view and
 * records whether the landmark is on the near side of its bone. A view where it
 * is not is never published: a target drawn over the far face of a bone asks a
 * student to click a surface they cannot see.
 *
 * The whole target is 2.5x the landmark's radius, so the inner 40% — rings 10
 * to 7 of the archery face — is the landmark itself and everything outside it
 * is a near miss. A floor applies: on a phone the smallest landmarks come out
 * under a fingertip, and a target no finger can hit fairly is not a question.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/landmarks`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.landmarks.generated.ts`;
const OUT_PANELS = `${ROOT}/src/features/anatomy-revision/data/seed/landmarkPanels.generated.ts`;

const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
};

/** Render pixels. ~15 CSS px of radius on a phone: a fingertip-sized zone. */
const MIN_ZONE_PX = 55;
/** The near-miss halo: the whole target against the landmark's own radius. */
const TARGET_MULTIPLE = 2.5;
/** A circle is emitted as a polygon; 28 sides is smooth at any size shipped. */
const CIRCLE_SIDES = 28;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const masksRoot = join(ROOT, args.masks ?? 'renders/landmarks');
const specPath = join(ROOT, args.spec ?? 'landmark-markers.spec.json');
const quality = Number(args.quality ?? '82');

if (!existsSync(masksRoot)) {
  console.error(`No renders at ${masksRoot} — run renderLandmarkMarkers.py first.`);
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const specById = new Map<string, any>(spec.landmarks.map((l: any) => [l.id, l]));

mkdirSync(OUT_DIR, { recursive: true });

interface Row { structureId: string; name: string; region: string; subregion: string; view: string; width: number; height: number }
const rows: Row[] = [];
const hotspots: Record<string, unknown[]> = {};
const skipped: string[] = [];
let floored = 0;

for (const id of readdirSync(masksRoot).sort()) {
  const metaPath = join(masksRoot, id, 'meta.json');
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const entry = specById.get(id);
  if (!entry) {
    skipped.push(`${id}: not in the spec`);
    continue;
  }

  // The renderer records frameSize; older runs do not, so it is recomputed the
  // same way rather than guessed — the two must agree or every radius is wrong.
  const parentSize = meta.parentSize ?? meta.snapDistance / meta.snapFraction;
  const radius = meta.radius ?? entry.radius;
  const frameSize =
    meta.frameSize ?? Math.max(Math.min(Math.max(radius * 25, parentSize * 0.35), parentSize * 0.9), 0.05);

  for (const [viewDir, view] of Object.entries(VIEW_NAMES)) {
    const v = meta.views?.[viewDir];
    if (!v || !v.visible) continue;

    const src = join(masksRoot, id, `${viewDir}.png`);
    if (!existsSync(src)) continue;

    const dest = join(OUT_DIR, `${id}-${view}.webp`);
    const info = await sharp(src).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);

    const pxPerMetre = info.width / frameSize;
    const rawZone = radius * pxPerMetre;
    const zone = Math.max(rawZone, MIN_ZONE_PX);
    if (rawZone < MIN_ZONE_PX) floored++;
    const targetPx = zone * TARGET_MULTIPLE;
    const rN = targetPx / info.width;

    const ring: number[][] = [];
    for (let i = 0; i < CIRCLE_SIDES; i++) {
      const a = (i / CIRCLE_SIDES) * Math.PI * 2;
      ring.push([
        Number((v.u + rN * Math.cos(a)).toFixed(5)),
        Number((v.v + rN * Math.sin(a)).toFixed(5)),
      ]);
    }

    const imageId = `landmark-${id}-${view}`;
    hotspots[imageId] = [
      {
        structureId: id,
        polygons: [ring],
        area: Math.PI * rN * rN,
        centroid: [Number(v.u.toFixed(5)), Number(v.v.toFixed(5))],
        // Marks this as a POINT target, and gives the accuracy scoring the
        // radius it measures against. Everything else on an image is a shape.
        targetRadius: Number(rN.toFixed(5)),
      },
    ];
    rows.push({
      structureId: id, name: entry.name, region: entry.region, subregion: entry.subregion,
      view, width: info.width, height: info.height,
    });
  }
}

const lines = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * Regenerate with:',
  ' *   npx tsx src/scripts/generateLandmarkSpec.ts --out landmark-markers.spec.json',
  ' *   blender atlas/Z-Anatomy/Startup.blend --background \\',
  ' *     --python src/scripts/blender/renderLandmarkMarkers.py -- \\',
  ' *     --spec landmark-markers.spec.json --out renders/landmarks',
  ' *   npx tsx src/scripts/publishLandmarks.ts',
  ' *',
  ' * Each hotspot is a CIRCLE, not a traced outline: a landmark is a point on a',
  ' * bone, and the target is its real size. The whole circle is 2.5x the',
  " * landmark's radius, so its inner 40% is the landmark and the rest is the",
  ' * near-miss halo the accuracy scoring reads.',
  ' */',
  "import type { HotspotPolygon } from '../../types/image';",
  '',
  'export const LANDMARK_HOTSPOTS: Record<string, HotspotPolygon[]> = {',
];
for (const id of Object.keys(hotspots).sort()) {
  lines.push(`  '${id}': ${JSON.stringify(hotspots[id])},`);
}
lines.push('};', '');
writeFileSync(OUT_HOTSPOTS, lines.join('\n'));

const body = rows
  .map(
    (r) =>
      `  { structureId: '${r.structureId}', name: ${JSON.stringify(r.name)}, ` +
      `region: '${r.region}', subregion: '${r.subregion}', ` +
      `view: '${r.view}', width: ${r.width}, height: ${r.height} },`,
  )
  .join('\n');

writeFileSync(
  OUT_PANELS,
  `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishLandmarks.ts
 *
 * One row per file in public/anatomy/landmarks/. Only views where the landmark
 * is actually on the near side of its bone are here.
 */
export interface LandmarkPanel {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  width: number;
  height: number;
}

export const LANDMARK_PANELS: LandmarkPanel[] = [
${body}
];
`,
);

const distinct = new Set(rows.map((r) => r.structureId)).size;
console.log(`${rows.length} image(s) across ${distinct} landmark(s) -> public/anatomy/landmarks/`);
console.log(`${floored} target(s) raised to the fingertip minimum`);
if (skipped.length) {
  console.log(`\n${skipped.length} skipped:`);
  for (const s of skipped) console.log(`  ${s}`);
}
