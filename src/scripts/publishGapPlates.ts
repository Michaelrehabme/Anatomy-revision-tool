import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { pointInAnyPolygon } from '../features/anatomy-revision/lib/hotspot/pointInPolygon';
import { polygonsWidth } from '../features/anatomy-revision/lib/hotspot/polygonGeometry';
import { MIN_TAPPABLE_WIDTH } from '../features/anatomy-revision/lib/questionGenerators/locate';
import { maskToPolygons, type BinaryMask } from './lib/maskToPolygons';
import { countSet, depthGate, dilateBy, loadMask, seamBand } from './lib/seamBand';
import { viewForAngle } from './lib/viewForAngle';

/**
 * Publishes a GAP PLATE: one bones-only turntable on which several structures
 * are each located by the gap between two bones.
 *
 *   npx tsx src/scripts/publishGapPlates.ts --masks <dir written by renderJointMasks.py>
 *     [--spec carpal-gaps.spec.json] [--overlays <dir>]
 *
 * WHAT IT IS FOR. The five interosseous ligaments of the wrist sit between two
 * carpal bones, where no camera can see enough of them to aim at. They are
 * identified on their own ghosted plates and LOCATED here, by tapping the line
 * where their two bones meet. Each "joint" in the spec is therefore named by
 * the LIGAMENT it is asked as, and that is the structure id on the hotspot.
 *
 * THE BAND IS THE JOINT-LINE RECIPE (lib/seamBand.ts, jointLineHotspots.ts):
 * the seam where the two silhouettes meet, kept where the contact surface says
 * they articulate, is the core — a tap there is full marks — and `catchMargin`
 * pixels around it is the catch area, where a tap still passes. Two things are
 * added, because several seams share one picture and a carpal bone has more
 * than one neighbour.
 *
 * 1. A DEPTH CHECK, REPORTED AND NOT APPLIED (spec `depth`; `maxDepthGap` to
 *    apply it). The trapeziotrapezoidal band seen from the back of the hand
 *    came out L-shaped, and the question was whether one arm was the joint
 *    and the other only the edge where the trapezoid stands in front of the
 *    trapezium. The renderer can colour each bone by its distance from the
 *    camera, so that was measured (4 Oct 2026): along BOTH arms the two bones
 *    are level to within about 2 mm, median, and only the last tenth of the
 *    band, at the metacarpal end, steps back 8 to 11 mm. The L is the real
 *    boundary — in this model the trapezium wraps round the proximal-radial
 *    corner of the trapezoid — so the view is kept as traced.
 *    The same measurement is why the gate is not switched on. Genuine
 *    intercarpal seams are not level either: the lunotriquetral seam from the
 *    back of the hand steps 6 mm at its median, the scapholunate from the palm
 *    nearly 5. A gate tight enough to trim the 8 mm tip would delete those, so
 *    depth is printed per band as evidence and left out of the trace unless a
 *    spec sets `maxDepthGap`.
 *
 * 2. ONE OWNER PER PIXEL. Catch areas of neighbouring gaps run into each other
 *    where two seams meet at a corner of the trapezoid or the capitate — traced
 *    independently they shared up to 64% of the smaller band, and a tap in the
 *    shared part would be right for whichever happened to be smaller. A pixel
 *    two bands claim goes to the band whose SEAM is nearer, so the boundary
 *    between two catch areas runs midway between their seams. A one-pixel moat
 *    is then left along it, because polygon simplification can push an outline
 *    a pixel either way and the app's own check allows two hotspots to share
 *    under 1% of what they cover (generateSet.test.ts).
 *
 * ONLY THE VIEWS A GAP IS A LINE IN ARE PUBLISHED (`views`). Seen from the
 * side, one carpal stands behind the next and their silhouettes overlap: the
 * tracer still finds a seam, and the question still opened there — the
 * scapholunate gap was first asked from 90 degrees, where it is the edge of
 * the lunate against a scaphoid hidden behind it. The carpal plate keeps the
 * palmar and dorsal views and the 30-degree obliques either side of each, six
 * frames, and locate opens on the largest band among those. `dropViews:
 * [[id, view]]` drops one gap from one view, for a band that traces as a blob.
 *
 * THE FRAME IS 80 MM, not the 150 mm the joint plates use. At 150 the whole
 * hand and a third of the forearm were in shot and a band was 1.4 to 3.1% of
 * the frame across; at 80 the picture still holds the ends of the radius and
 * ulna and the bases of all five metacarpals, which is what makes it a wrist
 * and not eight pebbles, and the catch margin (16 px here, the same 1.4 mm of
 * bone as 9 px was at 150) gives bands of 3 to 5%.
 *
 * Writes public/anatomy/gaps/<plate>-aNNN-plate.webp, gapPlates.generated.ts
 * and hotspots.gaps.generated.ts (a lazy chunk of its own: seed/hotspots.ts).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/gaps`;
const OUT_TS = `${ROOT}/src/features/anatomy-revision/data/seed/gapPlates.generated.ts`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.gaps.generated.ts`;

/** The joint-line defaults (jointLineHotspots.ts flags), so a gap is traced as a joint is. */
const BASE_SEAM = 5;
const GATE = 26;
const MIN_PX = 120;
/** renderJointMasks.py, DEPTH_RANGE: the distance, in metres, a depth pixel's 0..1 spans. */
const DEPTH_RANGE = 0.256;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const fromRoot = (p: string) => (isAbsolute(p) ? p : join(ROOT, p));
const masksRoot = fromRoot(args.masks ?? 'renders/carpal-gaps/masks');
const overlaysDir = args.overlays ? fromRoot(args.overlays) : null;
const quality = Number(args.quality ?? '82');

interface Spec {
  plate: { id: string; name: string; region: string; subregion: string };
  catchMargin?: number;
  /** Metres. When set, seam pixels whose two bones differ in depth by more are dropped. Unset: reported only. */
  maxDepthGap?: number;
  /** [structure id, view number as renderJointMasks counts it (15 degrees a step)]. */
  dropViews?: [string, number][];
  /** The views published, by the same numbering. Unset: all twelve. */
  views?: number[];
  joints: { id: string; name: string; depth?: boolean }[];
}
const spec: Spec = JSON.parse(readFileSync(fromRoot(args.spec ?? 'carpal-gaps.spec.json'), 'utf8'));
const margin = spec.catchMargin ?? 9;
const maxDepthGap = spec.maxDepthGap;
/** What "level" means in the report: a step under this is a joint seen square-on. */
const REPORT_LEVEL = 0.004;
const dropped = new Set((spec.dropViews ?? []).map(([id, view]) => `${id}|${view}`));

if (!existsSync(masksRoot)) {
  console.error(`No masks at ${masksRoot} — run renderJointMasks.py with ${args.spec ?? 'carpal-gaps.spec.json'} first.`);
  process.exit(1);
}
const seeded = new Set(ALL_STRUCTURES.map((s) => s.id));
const joints = spec.joints.filter((j) => {
  if (seeded.has(j.id)) return true;
  console.log(`  ${j.id}: not a seeded structure, no band published for it`);
  return false;
});

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** A bone's distance from the camera at each pixel, in metres from the near end of the range. */
async function loadDepth(path: string): Promise<Float32Array> {
  const { data, info } = await sharp(path).toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
  const px = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const out = new Float32Array(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = srgbToLinear(px[i * info.channels] / 65535) * DEPTH_RANGE;
  return out;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const roundRings = (polygons: number[][][]) => polygons.map((ring) => ring.map(([x, y]) => [round4(x), round4(y)]));

mkdirSync(OUT_DIR, { recursive: true });
if (overlaysDir) mkdirSync(overlaysDir, { recursive: true });

interface Band { id: string; core: BinaryMask; catchArea: BinaryMask; seam: number; cut: number; level: number | null }
interface Row { angle: number; view: string; width: number; height: number }
const rows: Row[] = [];
const hotspots: Record<string, string[]> = {};
const report: string[] = [];
let bandsOut = 0;

const VIEWS = spec.views ?? Array.from({ length: 12 }, (_, i) => i * 2);
for (const viewNo of VIEWS) {
  const view = `view-${String(viewNo).padStart(2, '0')}`;
  const angle = (viewNo * 15) % 360;
  let width = 0;
  let height = 0;
  let contextPath: string | null = null;
  const bands: Band[] = [];

  for (const joint of joints) {
    const dir = join(masksRoot, joint.id, view);
    if (!existsSync(join(dir, 'line.png')) || !existsSync(join(dir, 'a.png')) || !existsSync(join(dir, 'b.png'))) continue;
    contextPath ??= existsSync(join(dir, 'context.png')) ? join(dir, 'context.png') : null;
    if (dropped.has(`${joint.id}|${viewNo}`)) {
      report.push(`${joint.id} ${angle}°: dropped by the spec`);
      continue;
    }
    const line = loadMask(join(dir, 'line.png'));
    ({ width, height } = line);
    const a = loadMask(join(dir, 'a.png')).mask;
    const b = loadMask(join(dir, 'b.png')).mask;
    const hasDepth = existsSync(join(dir, 'a.depth.png')) && existsSync(join(dir, 'b.depth.png'));
    const depthA = hasDepth ? await loadDepth(join(dir, 'a.depth.png')) : null;
    const depthB = hasDepth ? await loadDepth(join(dir, 'b.depth.png')) : null;

    // The smallest reach that finds the joint, as jointLineHotspots.ts does it.
    // The reach is chosen on the flat seam, before any depth gate. Widening
    // until a gated seam is big enough would go looking further and further
    // from the joint for pixels that happen to be level, and bring back a blob.
    let raw: BinaryMask = new Uint8Array(width * height);
    let usedSeam = 0;
    for (const seam of [1, 2, 3, 4, 6, 8].map((n) => BASE_SEAM * n)) {
      raw = seamBand(a, b, line.mask, width, height, seam, GATE);
      usedSeam = seam;
      if (countSet(raw) >= MIN_PX) break;
    }
    const gate = (gap: number) => depthGate(raw, a, b, depthA!, depthB!, width, height, usedSeam + 2, gap);
    const core = depthA && depthB && maxDepthGap !== undefined ? gate(maxDepthGap) : raw;
    const cut = countSet(raw) - countSet(core);
    const level = depthA && depthB && countSet(raw) ? countSet(gate(REPORT_LEVEL)) / countSet(raw) : null;
    if (countSet(core) < MIN_PX) {
      report.push(
        countSet(raw) < MIN_PX
          ? `${joint.id} ${angle}°: no seam in view (${countSet(raw)}px)`
          : `${joint.id} ${angle}°: the bones meet on screen but not at one depth (${countSet(core)} of ${countSet(raw)}px level), no band`,
      );
      continue;
    }
    bands.push({ id: joint.id, core, catchArea: dilateBy(core, width, height, margin), seam: usedSeam, cut, level });
  }
  if (!bands.length || !contextPath) continue;

  // ONE OWNER PER PIXEL: the band whose seam is nearer.
  const corePixels = bands.map((band) => {
    const list: number[] = [];
    for (let i = 0; i < band.core.length; i++) if (band.core[i]) list.push(i);
    return list;
  });
  const owner = new Int16Array(width * height).fill(-1);
  let contested = 0;
  for (let i = 0; i < owner.length; i++) {
    const claims: number[] = [];
    for (let k = 0; k < bands.length; k++) if (bands[k].catchArea[i]) claims.push(k);
    if (!claims.length) continue;
    if (claims.length === 1) { owner[i] = claims[0]; continue; }
    contested++;
    const x = i % width;
    const y = Math.floor(i / width);
    let best = Infinity;
    for (const k of claims) {
      let d = Infinity;
      for (const c of corePixels[k]) {
        const dx = (c % width) - x;
        const dy = Math.floor(c / width) - y;
        const dd = dx * dx + dy * dy;
        if (dd < d) d = dd;
      }
      if (d < best) { best = d; owner[i] = k; }
    }
  }
  // The moat: a pixel beside another band's pixel belongs to neither.
  const moat = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (owner[i] < 0) continue;
      for (const j of [i - 1, i + 1, i - width, i + width]) {
        if (owner[j] >= 0 && owner[j] !== owner[i]) { moat[i] = 1; break; }
      }
    }
  }

  const list: string[] = [];
  const outlines: { polygons: number[][][]; core: number[][][] }[] = [];
  for (let k = 0; k < bands.length; k++) {
    const mine = new Uint8Array(width * height);
    for (let i = 0; i < mine.length; i++) if (owner[i] === k && !moat[i]) mine[i] = 1;
    const traced = maskToPolygons(mine, width, height, { maxVertices: 150 });
    const core = maskToPolygons(bands[k].core, width, height, { maxVertices: 150, minComponentPx: 60 });
    if (!traced.polygons.length || !core.polygons.length) {
      report.push(`${bands[k].id} ${angle}°: band too small to trace once split`);
      continue;
    }
    const across = polygonsWidth(traced.polygons, traced.area);
    if (across < MIN_TAPPABLE_WIDTH) {
      report.push(`${bands[k].id} ${angle}°: ${(across * 100).toFixed(2)}% across, under the tap floor`);
      continue;
    }
    outlines.push({ polygons: traced.polygons, core: core.polygons });
    list.push(
      `    { structureId: '${bands[k].id}', polygons: ${JSON.stringify(roundRings(traced.polygons))}, area: ${Number(traced.area.toPrecision(5))}, centroid: ${JSON.stringify(traced.centroid.map(round4))}, targetCore: ${JSON.stringify(roundRings(core.polygons))} },`,
    );
    bandsOut++;
    report.push(
      `${bands[k].id} ${angle}°: seam reach ${bands[k].seam}px, ${(traced.area * 100).toFixed(2)}% of frame, ${(across * 100).toFixed(2)}% across` +
        (bands[k].level !== null ? `, ${Math.round(bands[k].level! * 100)}% of the seam level to ${REPORT_LEVEL * 1000}mm` : '') +
        (bands[k].cut ? `, depth gate cut ${bands[k].cut}px of the seam` : ''),
    );
  }
  if (!list.length) continue;

  // The same check generateSet.test.ts makes of every image.
  let covered = 0;
  let doubled = 0;
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const p: [number, number] = [(x + 0.5) / 100, (y + 0.5) / 100];
      const hits = outlines.filter((o) => pointInAnyPolygon(p, o.polygons)).length;
      if (hits) covered++;
      if (hits > 1) doubled++;
    }
  }
  if (covered && doubled / covered > 0.008) {
    throw new Error(`${view}: ${(100 * doubled / covered).toFixed(1)}% of the covered frame is claimed twice after the split`);
  }

  const slug = `a${String(angle).padStart(3, '0')}`;
  const info = await sharp(contextPath).flatten({ background: '#ffffff' }).webp({ quality }).toFile(join(OUT_DIR, `${spec.plate.id}-${slug}-plate.webp`));
  rows.push({ angle, view: viewForAngle(angle, false), width: info.width, height: info.height });
  hotspots[`gap-${spec.plate.id}-${slug}-plate`] = list;
  report.push(`${angle}°: ${list.length} band(s), ${contested}px were claimed twice before the split`);

  if (overlaysDir) {
    const tint = ['#e6005c', '#0a7cff', '#f08a00', '#12a150', '#8a3ffc'];
    const pts = (ring: number[][]) => ring.map(([x, y]) => `${(x * info.width).toFixed(1)},${(y * info.height).toFixed(1)}`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${outlines
      .map((o, k) =>
        o.polygons.map((r) => `<polygon points="${pts(r)}" fill="${tint[k % 5]}" fill-opacity="0.25" stroke="${tint[k % 5]}" stroke-width="1.5"/>`).join('') +
        o.core.map((r) => `<polygon points="${pts(r)}" fill="${tint[k % 5]}" fill-opacity="0.85"/>`).join(''))
      .join('')}</svg>`;
    await sharp(contextPath).flatten({ background: '#ffffff' }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(join(overlaysDir, `${spec.plate.id}-${slug}.png`));
  }
}

const sizes = new Set(rows.map((r) => `${r.width}x${r.height}`));
if (sizes.size > 1) throw new Error(`frames are not all one size: ${[...sizes].join(', ')}`);

writeFileSync(OUT_TS, `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishGapPlates.ts --masks <renders>
 *
 * One row per file in public/anatomy/gaps/: a bones-only turntable on which
 * several structures are each located by the gap between two bones. See
 * publishGapPlates.ts and carpal-gaps.spec.json.
 */
export interface GapPlate {
  plateId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /** Camera angle around the vertical axis, degrees; 0 is anterior. */
  angle: number;
  width: number;
  height: number;
}

export const GAP_PLATES: GapPlate[] = [
${rows.map((r) => `  { plateId: '${spec.plate.id}', name: '${spec.plate.name}', region: '${spec.plate.region}', subregion: '${spec.plate.subregion}', view: '${r.view}', angle: ${r.angle}, width: ${r.width}, height: ${r.height} },`).join('\n')}
];
`);

writeFileSync(OUT_HOTSPOTS, `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with publishGapPlates.ts (masks from renderJointMasks.py and
 * carpal-gaps.spec.json).
 *
 * One entry per gap plate frame. Each hotspot is the gap between two bones,
 * named by the ligament that is asked there: \`targetCore\` is the seam itself
 * (full marks) and \`polygons\` the catch area around it (a pass). No pixel
 * belongs to two of them.
 */
import type { HotspotPolygon } from '../../types/image';

export const GAP_HOTSPOTS: Record<string, HotspotPolygon[]> = {
${Object.entries(hotspots).sort(([a], [b]) => a.localeCompare(b)).map(([id, list]) => `  '${id}': [\n${list.join('\n')}\n  ],`).join('\n')}
};
`);

const wanted = new Set(rows.map((r) => `${spec.plate.id}-a${String(r.angle).padStart(3, '0')}-plate.webp`));
const stale = readdirSync(OUT_DIR).filter((name) => name.startsWith(`${spec.plate.id}-`) && name.endsWith('.webp') && !wanted.has(name));
for (const name of stale) unlinkSync(join(OUT_DIR, name));

for (const line of report) console.log(`  ${line}`);
console.log(`${rows.length} frame(s), ${bandsOut} band(s) -> public/anatomy/gaps/  (${stale.length} stale removed)`);
