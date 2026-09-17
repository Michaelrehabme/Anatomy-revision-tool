import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { maskToPolygons } from './lib/maskToPolygons';

/**
 * Packs the region proofs for a review page.
 *
 *   npx tsx src/scripts/landmarkRegionPreviewData.ts --out landmark-region-preview.data.json
 *
 * These are the pictures renderLandmarkRegions.py makes: each landmark's grown
 * region painted red on its parent bone, deliberately in the style of an atlas
 * plate so it can be held against a textbook. Nothing downstream is worth
 * building until an anatomist agrees the red is in the right place, because a
 * region that is wrong here is wrong in every question that uses it.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    out[argv[i].slice(2)] = next && !next.startsWith('--') ? next : 'true';
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const wide = join(ROOT, args.renders ?? 'renders/landmark-regions');
const zoom = join(ROOT, args.zoom ?? 'renders/landmark-regions-zoom');
const outPath = join(ROOT, args.out ?? 'landmark-region-preview.data.json');
const width = Number(args.width ?? '460');
const quality = Number(args.quality ?? '74');
const blurSigma = Number(args.blur ?? '5');

const rules = JSON.parse(readFileSync(join(ROOT, 'landmark-regions.rules.json'), 'utf8'));
const spec = JSON.parse(readFileSync(join(ROOT, 'landmark-markers.spec.json'), 'utf8'));
const specById = new Map<string, any>(spec.landmarks.map((l: any) => [l.id, l]));
const report = existsSync(join(wide, 'report.json'))
  ? JSON.parse(readFileSync(join(wide, 'report.json'), 'utf8'))
  : {};
// The previous round's verdict and what it changed, so a region is judged
// against the objection it drew rather than from scratch.
const round1Path = join(ROOT, 'landmark-region-round1.json');
const round1 = existsSync(round1Path) ? JSON.parse(readFileSync(round1Path, 'utf8')) : {};

async function uri(path: string): Promise<string | null> {
  if (!existsSync(path)) return null;
  const buf = await sharp(path).resize({ width }).jpeg({ quality }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/**
 * The mask, blurred and re-thresholded before tracing.
 *
 * THIS IS WHERE THE EDGE GETS CLEAN. Selecting whole triangles leaves a spiky
 * boundary however fine the mesh is, because a distance test on a bumpy surface
 * wobbles in and out at the scale of one face. Smoothing in 2D fixes it where
 * it actually matters — the shipped hotspot is a traced polygon, not the face
 * set — and it cannot thin a narrow ridge the way eroding the 3D selection can.
 */
async function tracedPolygons(path: string): Promise<number[][][] | null> {
  if (!existsSync(path)) return null;
  const { data, info } = await sharp(path)
    .greyscale()
    .blur(blurSigma)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Uint8Array(info.width * info.height);
  let on = 0;
  for (let i = 0; i < mask.length; i++) {
    if (data[i * info.channels] > 128) {
      mask[i] = 1;
      on++;
    }
  }
  if (on < 80) return null;

  const traced = maskToPolygons(mask, info.width, info.height, {
    minComponentPx: 120,
    epsilon: 2.5,
    maxVertices: 120,
  });
  return traced.polygons.length ? traced.polygons : null;
}

/**
 * The close-up from whichever view actually shows the feature.
 *
 * Always using the anterior one gave a bare bone for every posterior landmark —
 * the linea aspera's close-up showed a clean femur with nothing marked, which
 * reads as a failure rather than as "this is the wrong side to look from".
 */
async function bestCloseUp(id: string) {
  let best: { view: string; polygons: number[][][]; span: number } | null = null;
  for (const [dir, view] of Object.entries(VIEW_NAMES)) {
    const polygons = await tracedPolygons(join(zoom, id, `${dir.replace('view', 'mask')}.png`));
    if (!polygons) continue;
    const pts = polygons.flat();
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const span = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (!best || span > best.span) best = { view, polygons, span };
  }
  const dir = Object.keys(VIEW_NAMES).find((k) => VIEW_NAMES[k] === (best?.view ?? 'anterior'))!;
  return {
    closeUp: await uri(join(zoom, id, `${dir}.png`)),
    closeUpView: best?.view ?? 'anterior',
    closeUpPolygons: best?.polygons ?? null,
  };
}

const rows = [];
for (const id of readdirSync(wide).sort()) {
  if (id.startsWith('_') || !existsSync(join(wide, id))) continue;
  const rule = rules[id];
  if (!rule) continue;

  const views = [];
  for (const [dir, view] of Object.entries(VIEW_NAMES)) {
    const u = await uri(join(wide, id, `${dir}.png`));
    if (!u) continue;
    views.push({
      view,
      uri: u,
      polygons: await tracedPolygons(join(wide, id, `${dir.replace('view', 'mask')}.png`)),
    });
  }
  if (!views.length) continue;

  const entry = specById.get(id);
  rows.push({
    id,
    name: entry?.name ?? id,
    bone: report[id]?.bone ?? null,
    kind: rule.kind,
    why: rule._why ?? null,
    faces: report[id]?.picked ?? null,
    share: report[id]?.share ?? null,
    views,
    ...(await bestCloseUp(id)),
    previous: round1[id] ?? null,
  });
}

writeFileSync(outPath, JSON.stringify(rows));
writeFileSync(outPath.replace(/\.json$/, '.js'), `window.__REGIONS__=${JSON.stringify(rows)};`);
console.log(
  `[regions] ${rows.length} region(s) -> ${outPath} ` +
    `(${(JSON.stringify(rows).length / 1024 / 1024).toFixed(2)} MB)`,
);
