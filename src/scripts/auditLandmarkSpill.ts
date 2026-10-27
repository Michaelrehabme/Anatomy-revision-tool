import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LANDMARK_HOTSPOTS } from '../features/anatomy-revision/data/seed/hotspots.landmarks.generated';
import { isAccuratePass, scoreAccuracy, scoreRegion } from '../features/anatomy-revision/lib/hotspot/accuracy';

/**
 * How much of each landmark's PASS ZONE lies off the bone.
 *
 *   npx tsx src/scripts/auditLandmarkSpill.ts [--out landmark-spill.json] [--overlays dir] [--only id,id]
 *
 * The hitboxes were grown generously so a student could hit a small landmark,
 * and some of that growth runs past the edge of the bone into empty picture —
 * a tap on nothing that is marked right. The render's alpha is the bone
 * silhouette (every bone in shot), so "off the bone" is measured exactly.
 * It cannot see a hitbox that spills onto a NEIGHBOURING bone: that needs a
 * parent-bone mask, and is judged by eye on the review page.
 *
 * Every pixel is graded with the app's own scoring (scoreAccuracy /
 * scoreRegion), so the zone measured is the zone a tap is marked right in.
 * With --overlays it writes each panel with the pass zone over bone in orange,
 * the anatomy (a region's core) in green, and the spill in red.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MASKS = join(ROOT, 'renders/landmarks');
/**
 * Pixels past the silhouette edge still counted as on the bone. A ridge seen
 * side-on — the linea aspera from the lateral view — is traced ON the outline,
 * and the region's 0.4mm lift plus the mask blur leave a fringe of a few
 * pixels outside it. 3px reported that fringe as a tracing fault on 102 panels.
 */
const EDGE_TOLERANCE_PX = 6;
/**
 * A target that is an OPENING — a foramen, a canal, the hiatus — is meant to
 * sit over background: the gap is the anatomy. Reported, never trimmed.
 */
const OPENING = /foramen|foramina|canal|hiatus/;
/** Grading every pixel of a 1400px panel is needless; every second one is exact enough for a percentage. */
const STEP = 2;

const VIEW_DIRS: Record<string, string> = {
  anterior: 'view-00',
  lateral: 'view-06',
  posterior: 'view-12',
  superior: 'view-top',
  medial: 'view-18',
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

/** The bone silhouette grown by `radius` pixels: everything a tap can land on and still be on the bone. */
function nearBone(bone: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(bone.length);
  const tmp = new Uint8Array(bone.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let d = -radius; d <= radius && !on; d++) {
        const nx = x + d;
        if (nx >= 0 && nx < w && bone[y * w + nx]) on = 1;
      }
      tmp[y * w + x] = on;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let d = -radius; d <= radius && !on; d++) {
        const ny = y + d;
        if (ny >= 0 && ny < h && tmp[ny * w + x]) on = 1;
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outPath = join(ROOT, args.out ?? 'landmark-spill.json');
const overlayDir = args.overlays;
if (overlayDir) mkdirSync(overlayDir, { recursive: true });
/** Landmark ids to measure, when re-checking a few after a fix; a full run is ~12 minutes. */
const only = args.only ? new Set(args.only.split(',')) : null;

interface Row {
  imageId: string;
  structureId: string;
  view: string;
  kind: 'region' | 'capsule' | 'point';
  /** A gap in the bone: its spill is the anatomy, so the trim leaves it alone. */
  opening: boolean;
  /** Share of the pass zone more than EDGE_TOLERANCE_PX off the bone. */
  passSpill: number;
  /** The same for the anatomy itself — should be ~0; anything more is a tracing fault, not a margin one. */
  coreSpill: number;
  passPx: number;
}
const rows: Row[] = [];

for (const [imageId, hotspots] of Object.entries(LANDMARK_HOTSPOTS)) {
  const view = imageId.split('-').pop()!;
  const hs = hotspots[0];
  const id = hs.structureId;
  if (only && !only.has(id)) continue;
  const png = join(MASKS, id, `${VIEW_DIRS[view]}.png`);
  if (!existsSync(png)) {
    console.warn(`${imageId}: no render at ${png}`);
    continue;
  }
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const bone = new Uint8Array(w * h);
  for (let i = 0; i < bone.length; i++) bone[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  const onBone = nearBone(bone, w, h, EDGE_TOLERANCE_PX);

  const kind: Row['kind'] = hs.targetCore?.length ? 'region' : hs.targetAxis && hs.targetAxis.length > 1 ? 'capsule' : 'point';
  let passPx = 0;
  let spillPx = 0;
  let corePx = 0;
  let coreSpillPx = 0;
  // 0 none, 1 pass on bone, 2 core/landmark, 3 spill
  const paint = overlayDir ? new Uint8Array(w * h) : null;
  for (let y = 0; y < h; y += STEP) {
    for (let x = 0; x < w; x += STEP) {
      const p: [number, number] = [(x + 0.5) / w, (y + 0.5) / h];
      const score = hotspots.reduce<number | null>((best, s) => {
        const sc = scoreAccuracy(p, s) ?? scoreRegion(p, s);
        return sc !== null && (best === null || sc > best) ? sc : best;
      }, null);
      if (!isAccuratePass(score)) continue;
      const i = y * w + x;
      passPx++;
      const off = !onBone[i];
      if (off) spillPx++;
      const isCore = kind === 'region' ? score === 10 : false;
      if (isCore) {
        corePx++;
        if (off) coreSpillPx++;
      }
      if (paint) {
        // An opening is meant to be over background, so none of it is painted as spill.
        const c = off && !OPENING.test(id) ? 3 : isCore ? 2 : 1;
        for (let dy = 0; dy < STEP && y + dy < h; dy++) for (let dx = 0; dx < STEP && x + dx < w; dx++) paint[i + dy * w + dx] = c;
      }
    }
  }
  rows.push({
    imageId,
    structureId: id,
    view,
    kind,
    opening: OPENING.test(id),
    passSpill: passPx ? Number((spillPx / passPx).toFixed(4)) : 0,
    coreSpill: corePx ? Number((coreSpillPx / corePx).toFixed(4)) : 0,
    passPx: passPx * STEP * STEP,
  });

  if (paint && overlayDir) {
    const COLOURS: Record<number, [number, number, number, number]> = {
      1: [240, 140, 20, 105],
      2: [30, 170, 80, 140],
      3: [225, 30, 40, 190],
    };
    const over = Buffer.alloc(w * h * 4);
    for (let i = 0; i < paint.length; i++) {
      const c = COLOURS[paint[i]];
      if (!c) continue;
      over[i * 4] = c[0];
      over[i * 4 + 1] = c[1];
      over[i * 4 + 2] = c[2];
      over[i * 4 + 3] = c[3];
    }
    // Composited first and resized after: sharp resizes before it composites
    // within one pipeline, and a full-size overlay will not fit a shrunk base.
    const full = await sharp(png)
      .flatten({ background: '#ffffff' })
      .composite([{ input: over, raw: { width: w, height: h, channels: 4 } }])
      .png()
      .toBuffer();
    await sharp(full)
      .resize(720)
      .webp({ quality: 78 })
      .toFile(join(overlayDir, `${imageId}.webp`));
  }
}

rows.sort((a, b) => b.passSpill - a.passSpill);
writeFileSync(outPath, `${JSON.stringify(rows, null, 1)}\n`);
const over = (t: number) => rows.filter((r) => !r.opening && r.passSpill > t).length;
console.log(`${rows.length} panels, ${rows.filter((r) => r.opening).length} of them openings (not counted). Pass zone >5% off the bone: ${over(0.05)}; >15%: ${over(0.15)}; >30%: ${over(0.3)}.`);
console.log(`Anatomy itself >2% off the bone (tracing fault): ${rows.filter((r) => !r.opening && r.coreSpill > 0.02).length}.`);
for (const r of rows.filter((x) => !x.opening).slice(0, 15)) console.log(`  ${(r.passSpill * 100).toFixed(1).padStart(5)}%  ${r.kind.padEnd(7)} ${r.imageId}`);
