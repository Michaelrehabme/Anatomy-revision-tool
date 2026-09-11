/**
 * Derives joint-line hotspots from the per-bone masks renderJointMasks.py emits.
 *
 *   npx tsx src/scripts/jointLineHotspots.ts --masks renders/joint-lines \
 *       --out joint-lines.hotspots.json --overlays renders/joint-lines-overlays
 *
 * THE RULE THIS IMPLEMENTS. A joint's hotspot is the joint line plus a few
 * pixels above, below and either side — the space between the two articulating
 * bones, not the ligament or capsule over it. Highlighting the ligament teaches
 * the ligament; a student asked to locate the distal tibiofibular joint has to
 * click the tibia/fibula gap.
 *
 * HOW. renderJointMasks.py renders the two bones' facing surfaces as a single
 * white mask; this dilates it by `--pad` pixels and traces the result. `--pad`
 * is literally the "few pixels above, below and either side": it is the only
 * knob, and it means the same thing in the output as it does in the rule.
 *
 * An earlier version derived the band in 2D instead, by dilating each bone's
 * silhouette and intersecting them. That works head-on and fails badly at an
 * angle: flattened silhouettes cannot distinguish "these bones are adjacent"
 * from "one is in front of the other", so a lateral ankle view put the band
 * over the whole distal fibula. The contact surfaces are found in 3D, where
 * that distinction is real, and projected — so every view is consistent.
 *
 * Flags:
 *   --masks DIR     Root written by renderJointMasks.py (default renders/joint-lines).
 *   --out FILE      Hotspot JSON (default joint-lines.hotspots.json).
 *   --overlays DIR  If set, write <joint>-<view>-overlay.png for checking by eye.
 *   --pad N         Dilation in pixels, each side (default 6).
 *   --min-px N      Discard bands smaller than this; a handful of pixels is
 *                   contact noise, not an articulation (default 120).
 *   --max-vertices N  Vertex budget per polygon (default 150).
 *   --v2 FILE       Also write the band set in importHotspots.ts's v2 shape, so
 *                   the seed module is produced by the same path the region
 *                   hotspots already use rather than a second bespoke one.
 *   --views MAP     view-NN=name pairs for the v2 image ids
 *                   (default view-00=anterior,view-06=lateral,view-12=posterior).
 *   --emit-ts FILE  Write the seed module directly.
 *
 * WHY --emit-ts RATHER THAN importHotspots.ts. That script cross-references
 * every image id against the seed before emitting, which is the right thing for
 * region hotspots and impossible here: images.seed.ts cannot compile until this
 * module exists, and this module cannot be produced until images.seed.ts
 * compiles. --v2 still writes the shape importHotspots reads, so the bands can
 * be put through that validation once the seed knows about them.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './lib/png';
import { encodePng } from './lib/pngEncode';
import { binariseAlpha, maskToPolygons, type BinaryMask } from './lib/maskToPolygons';

interface Options {
  masksRoot: string;
  outPath: string;
  overlaysDir: string | null;
  pad: number;
  minPx: number;
  maxVertices: number;
  only: string | null;
  v2Path: string | null;
  tsPath: string | null;
  viewNames: Record<string, string>;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(`--${flag}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
  };
  return {
    masksRoot: get('masks', 'renders/joint-lines'),
    outPath: get('out', 'joint-lines.hotspots.json'),
    overlaysDir: argv.includes('--overlays') ? get('overlays', 'renders/joint-lines-overlays') : null,
    pad: Number(get('pad', '6')),
    minPx: Number(get('min-px', '120')),
    maxVertices: Number(get('max-vertices', '150')),
    only: argv.includes('--only') ? get('only', '') : null,
    v2Path: argv.includes('--v2') ? get('v2', 'joint-lines.hotspots.v2.json') : null,
    tsPath: argv.includes('--emit-ts')
      ? get('emit-ts', 'src/features/anatomy-revision/data/seed/hotspots.joints.generated.ts')
      : null,
    viewNames: Object.fromEntries(
      get('views', 'view-00=anterior,view-06=lateral,view-12=posterior')
        .split(',')
        .map((pair) => pair.split('=') as [string, string]),
    ),
  };
}

/**
 * Grow by `steps` pixels using a 3x3 element. Repeated 3x3 dilation is a
 * chamfer rather than a true disc, so a diagonal grows by about 1.4x `steps` —
 * irrelevant at the pad sizes used here, and cheaper than a distance transform.
 */
function dilateBy(mask: BinaryMask, width: number, height: number, steps: number): BinaryMask {
  let current = mask;
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (current[y * width + x] === 0) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            next[ny * width + nx] = 1;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

function countSet(mask: BinaryMask): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

function loadMask(path: string): { mask: BinaryMask; width: number; height: number } {
  const png = decodePng(path);
  return {
    mask: binariseAlpha(png.data, png.width, png.height),
    width: png.width,
    height: png.height,
  };
}

/** Bones in bone colour, band in the same blue the panels highlight with. */
function overlay(contextPath: string, band: BinaryMask): Buffer {
  const png = decodePng(contextPath);
  const out = Buffer.from(png.data);
  for (let i = 0; i < band.length; i++) {
    if (band[i] === 0) continue;
    const p = i * 4;
    out[p] = Math.round(out[p] * 0.25 + 0x4a * 0.75);
    out[p + 1] = Math.round(out[p + 1] * 0.25 + 0x9e * 0.75);
    out[p + 2] = Math.round(out[p + 2] * 0.25 + 0xd4 * 0.75);
    out[p + 3] = 255;
  }
  return encodePng(out, png.width, png.height);
}

const opts = parseArgs(process.argv.slice(2));

if (!existsSync(opts.masksRoot)) {
  console.error(`No mask root at ${opts.masksRoot} — run renderJointMasks.py first.`);
  process.exit(1);
}

if (opts.overlaysDir) mkdirSync(opts.overlaysDir, { recursive: true });

const results: Record<string, unknown[]> = {};
interface V2Image {
  width: number;
  height: number;
  hotspots: Record<string, { polygons: number[][][]; area: number; centroid: [number, number] }>;
}
const v2Images: Record<string, V2Image> = {};
let emitted = 0;
let dropped = 0;

const jointIds = readdirSync(opts.masksRoot).filter((d) => !opts.only || d === opts.only);

for (const jointId of jointIds) {
  const jointDir = join(opts.masksRoot, jointId);
  const views = readdirSync(jointDir).filter((v) => v.startsWith('view-'));
  const perView: unknown[] = [];

  for (const view of views) {
    const dir = join(jointDir, view);
    const linePath = join(dir, 'line.png');
    if (!existsSync(linePath)) continue;

    const line = loadMask(linePath);
    const band = dilateBy(line.mask, line.width, line.height, opts.pad);

    const pixels = countSet(band);
    if (pixels < opts.minPx) {
      console.log(`  ${jointId.padEnd(30)} ${view}  ${pixels}px — below threshold, dropped`);
      dropped++;
      continue;
    }

    const traced = maskToPolygons(band, line.width, line.height, { maxVertices: opts.maxVertices });
    perView.push({ view, pixels, polygons: traced.polygons });

    // One image per joint per VIEW, mirroring the region hotspots: a composited
    // multi-view strip has no single coordinate space a polygon could live in.
    const viewName = opts.viewNames[view];
    if (viewName) {
      v2Images[`joint-${jointId}-${viewName}`] = {
        width: line.width,
        height: line.height,
        hotspots: {
          [jointId]: { polygons: traced.polygons, area: traced.area, centroid: traced.centroid },
        },
      };
    }
    emitted++;
    console.log(`  ${jointId.padEnd(30)} ${view}  ${pixels}px  ${traced.polygons.length} polygon(s)`);

    const contextPath = join(dir, 'context.png');
    if (opts.overlaysDir && existsSync(contextPath)) {
      writeFileSync(join(opts.overlaysDir, `${jointId}-${view}-overlay.png`), overlay(contextPath, band));
    }
  }

  if (perView.length > 0) results[jointId] = perView;
}

writeFileSync(
  opts.outPath,
  JSON.stringify(
    { schemaVersion: 1, generated: new Date().toISOString(), pad: opts.pad, joints: results },
    null,
    2,
  ),
);

if (opts.v2Path) {
  writeFileSync(
    opts.v2Path,
    JSON.stringify({ schemaVersion: 2, normalised: true, images: v2Images }, null, 2),
  );
}

if (opts.tsPath) {
  const lines: string[] = [
    '/**',
    ' * GENERATED FILE — do not edit by hand.',
    ' *',
    ' * Regenerate with:',
    ' *   blender atlas/Z-Anatomy/Startup.blend --background \\',
    ' *     --python src/scripts/blender/renderJointMasks.py -- \\',
    ' *     --spec joint-lines.spec.json --out renders/joint-lines',
    ' *   npx tsx src/scripts/jointLineHotspots.ts --masks renders/joint-lines --emit-ts',
    ' *',
    ' * Each band is the joint LINE: the space between the two articulating bones,',
    ' * plus a few pixels every side. It is derived from the bones themselves,',
    ' * because the atlas has no geometry for a joint space — see',
    ' * renderJointMasks.py. The rest of the skeleton is held out while the mask',
    ' * renders, so a band the student cannot see is not one they can be asked to',
    ' * click; that is why some joints carry fewer views than others.',
    ' */',
    "import type { HotspotPolygon } from '../../types/image';",
    '',
    'export const JOINT_HOTSPOTS: Record<string, HotspotPolygon[]> = {',
  ];
  for (const id of Object.keys(v2Images).sort()) {
    lines.push(`  '${id}': [`);
    for (const [structureId, entry] of Object.entries(v2Images[id].hotspots)) {
      lines.push('    {');
      lines.push(`      structureId: '${structureId}',`);
      lines.push(`      polygons: ${JSON.stringify(entry.polygons)},`);
      lines.push(`      area: ${entry.area},`);
      lines.push(`      centroid: [${entry.centroid[0]}, ${entry.centroid[1]}],`);
      lines.push('    },');
    }
    lines.push('  ],');
  }
  lines.push('};', '');
  writeFileSync(opts.tsPath, lines.join('\n'));
}

console.log(`\n${emitted} band(s) across ${Object.keys(results).length} joint(s) -> ${opts.outPath}`);
if (dropped > 0) console.log(`${dropped} view(s) dropped below ${opts.minPx}px`);
if (opts.overlaysDir) console.log(`overlays -> ${opts.overlaysDir}`);
if (opts.tsPath) console.log(`seed module -> ${opts.tsPath}`);
