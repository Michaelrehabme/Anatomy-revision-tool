import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isLigament } from '../features/anatomy-revision/types/structure';
import type { ViewType } from '../features/anatomy-revision/types/image';
import { pointInAnyPolygon } from '../features/anatomy-revision/lib/hotspot/pointInPolygon';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';
import { LIGAMENT_PLATES } from '../features/anatomy-revision/data/seed/ligamentPlates.generated';
import { LIGAMENT_HOTSPOTS } from '../features/anatomy-revision/data/seed/hotspots.ligaments.generated';

/**
 * Publishes the ligament plates: two webps per ligament per angle, plus the
 * generated lists images.seed.ts builds its ligament image assets from.
 *
 *   npx tsx src/scripts/publishLigamentPlates.ts --renders renders/ligaments-tranche1
 *   npx tsx src/scripts/publishLigamentPlates.ts --renders renders/ligaments-sample \
 *     --only anterior-cruciate-ligament,acromioclavicular-ligament
 *
 * --only REPLACES THOSE LIGAMENTS AND KEEPS THE REST. Without it the renders
 * directory is the whole truth and the seed is rebuilt from it; with it, the
 * named ligaments are re-published from the directory and every other
 * ligament's plates and hotspots are carried over from the current seed. That
 * is what lets a three-ligament proof render be looked at in the app without
 * re-rendering all 32.
 *
 * STALE IMAGES ARE DELETED. When an angle stops tracing (a re-render, a new
 * MIN_TARGET_AREA), its webps used to stay in public/anatomy/ligaments with no
 * row pointing at them: 22 such files were shipping on 20 Sep 2026. Anything
 * in that directory the final rows do not name is removed.
 *
 * TWO PICTURES PER ANGLE, because the two question types need different ones.
 * The `context` render shows the joint with every ligament in the resting
 * blue and is the locate picture: it carries a hotspot for the target AND for
 * every other seeded ligament in view, traced from the ID pass — one picture,
 * many hotspots, the same shape as the region plates. The `highlight` render
 * picks the target out in cyan and is the identify picture: pre-highlighted,
 * so it carries no hotspots and can never be a locate question, exactly as
 * the muscle panels are handled.
 *
 * ONLY ANGLES WHERE THE TARGET TRACES ARE PUBLISHED. The rotation sets showed
 * that the angle a survey picks and the angle that traces best disagree
 * whenever a strap is seen edge-on; the rule is to render the angles and
 * keep the ones with a target. A frame whose target is under the floor is a
 * picture the student can be shown but never asked about, so it is dropped —
 * and the count of published context images is the count of locate
 * questions.
 *
 * ANGLES BECOME VIEWS. The renders are of the left side with the camera
 * every 45 degrees, so 0 is anterior, 270 is lateral, 90 is medial and the
 * obliques fall between. The angle is also kept on the row, because a
 * rotation widget wants the number, not the word.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/ligaments`;
const OUT_TS = `${ROOT}/src/features/anatomy-revision/data/seed/ligamentPlates.generated.ts`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.ligaments.generated.ts`;

/**
 * Below this share of the frame a traced target is a few pixels, not a
 * question. Tunable, because the right value moved when the plates were
 * reframed: a target is now a smaller share of a much wider picture, and the
 * locate screen gained zoom, so a share that was untappable at 1x is
 * comfortable at 3x. The floor that still matters is TRACEABILITY — at
 * 1600px, 0.02% of the frame is about 500 pixels, which is enough of a blob
 * to trace an honest outline from.
 */
const MIN_TARGET_AREA = Number(
  process.argv.includes('--min-area')
    ? process.argv[process.argv.indexOf('--min-area') + 1]
    : 0.0002,
);

const VIEW_FOR_ANGLE: Record<number, ViewType> = {
  0: 'anterior', 45: 'anteromedial', 90: 'medial', 135: 'posteromedial',
  180: 'posterior', 225: 'posterolateral', 270: 'lateral', 315: 'anterolateral',
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const rendersRoot = join(ROOT, args.renders ?? 'renders/ligaments-tranche1');
const only = args.only ? new Set(args.only.split(',').map((x) => x.trim()).filter(Boolean)) : null;
const quality = Number(args.quality ?? '82');

if (!existsSync(rendersRoot)) {
  console.error(`No renders at ${rendersRoot} — run renderLigamentPlates.py first.`);
  process.exit(1);
}

const ligaments = ALL_STRUCTURES.filter(isLigament);
const byId = new Map(ligaments.map((l) => [l.id, l]));
/** Atlas mesh base name -> seeded ligament id, for naming the neighbours. */
const idByMeshName = new Map<string, string>();
{
  const mapping: { id: string; blenderObjects: string[] }[] = JSON.parse(
    readFileSync(`${ROOT}/ta2-mapping-ligaments.resolved.json`, 'utf8'),
  ).mapping;
  for (const m of mapping) for (const b of m.blenderObjects) idByMeshName.set(b.replace(/\.(o\d?)?[lr]$/, ''), m.id);
}

interface Hotspot { structureId: string; polygons: number[][][]; area: number; centroid: [number, number] }

interface IdPass {
  neighbours: Hotspot[];
  /** Which structure owns a normalised point of the ID render; '' for bone or background. */
  ownerAt: (x: number, y: number) => string;
}

function srgbToLinear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** The ID pass back into per-ligament outlines, keyed by seeded ligament id. */
function traceNeighbours(dir: string, targetId: string): IdPass {
  const none: IdPass = { neighbours: [], ownerAt: () => '' };
  if (!existsSync(`${dir}/ids.png`) || !existsSync(`${dir}/ids.json`)) return none;
  const legend: Record<string, string> = JSON.parse(readFileSync(`${dir}/ids.json`, 'utf8'));
  const png = decodePng(`${dir}/ids.png`);
  const index = new Uint8Array(png.width * png.height);
  for (let i = 0; i < index.length; i++) {
    if (png.data[i * 4 + 3] < 128) continue;
    const r = Math.round(srgbToLinear(png.data[i * 4]) * 15);
    const g = Math.round(srgbToLinear(png.data[i * 4 + 1]) * 15);
    index[i] = g * 16 + r;
  }
  const structureByIndex = new Map<number, string>([[1, targetId]]);
  const out: Hotspot[] = [];
  for (const [id, meshName] of Object.entries(legend)) {
    const k = Number(id);
    if (k === 1) continue;
    const structureId = idByMeshName.get(meshName.replace(/\.(o\d?)?[lr]$/, ''));
    // A strap that is not a seeded ligament is scenery: drawn, not askable.
    if (!structureId) continue;
    structureByIndex.set(k, structureId);
    const mask = new Uint8Array(index.length);
    let n = 0;
    for (let i = 0; i < index.length; i++) if (index[i] === k) { mask[i] = 1; n++; }
    if (n < 40) continue;
    const t = maskToPolygons(mask, png.width, png.height, { minComponentPx: 40, epsilon: 1.5, maxVertices: 80 });
    if (!t.polygons.length || t.area < MIN_TARGET_AREA) continue;
    out.push({ structureId, polygons: t.polygons, area: t.area, centroid: t.centroid });
  }
  return {
    neighbours: out,
    ownerAt: (x, y) => {
      const px = Math.min(png.width - 1, Math.max(0, Math.floor(x * png.width)));
      const py = Math.min(png.height - 1, Math.max(0, Math.floor(y * png.height)));
      return structureByIndex.get(index[py * png.width + px]) ?? '';
    },
  };
}

/**
 * Keeps the hotspots on one picture mutually exclusive, the invariant
 * generateSet.test.ts enforces for every image: a correct tap must never be
 * resolved to another structure.
 *
 * WHY IT CAN HAPPEN HERE. Every pixel of the ID pass belongs to exactly one
 * strap, so the straps partition the picture — but the tracer keeps outer
 * boundaries only (holes would ADD area under the app's OR-of-rings hit
 * test). Where one strap lies wholly inside another's outline, as the
 * ulnocapitate does within the palmar radio-ulnar at the wrist, the outer
 * strap's polygon swallows it, and smallest-wins would hand a tap on the
 * inner one to whichever polygon is smaller — not necessarily the one on top.
 *
 * The ID pass knows who really owns each pixel, so the fix is measured, not
 * guessed: sample the picture, and while more than a hair of the covered
 * area is claimed twice, drop a neighbour. Which neighbour is scored by how
 * many contested pixels it is in AND how many of those it has no claim to,
 * so a strap that swallows others goes first — but blame alone cannot pick
 * it, because on a ligament's own plate the swallower is often the TARGET,
 * which is never dropped (a wrong tap there would then be unnamed rather
 * than misgraded). Counting participation guarantees the loop makes
 * progress instead of stalling with nobody to blame.
 */
function makeExclusive(target: Hotspot, neighbours: Hotspot[], ownerAt: (x: number, y: number) => string): Hotspot[] {
  const STEPS = 100;
  const MAX_SHARE = 0.008;
  let kept = [...neighbours];
  for (;;) {
    const all = [target, ...kept];
    let covered = 0;
    let doubled = 0;
    // score = contested pixels this hotspot sits in, + a penalty for each one
    // the ID pass says belongs to somebody else.
    const score = new Map<string, number>();
    for (let y = 0; y < STEPS; y++) {
      for (let x = 0; x < STEPS; x++) {
        const p: [number, number] = [(x + 0.5) / STEPS, (y + 0.5) / STEPS];
        const hits = all.filter((h) => pointInAnyPolygon(p, h.polygons));
        if (hits.length) covered++;
        if (hits.length > 1) {
          doubled++;
          const owner = ownerAt(p[0], p[1]);
          for (const h of hits) {
            score.set(h.structureId, (score.get(h.structureId) ?? 0) + (h.structureId === owner ? 1 : 2));
          }
        }
      }
    }
    if (!covered || doubled / covered <= MAX_SHARE || !kept.length) return kept;
    const worst = [...score.entries()].filter(([id]) => id !== target.structureId).sort((a, b) => b[1] - a[1])[0];
    if (!worst) return kept;
    kept = kept.filter((h) => h.structureId !== worst[0]);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

interface Row {
  structureId: string; name: string; region: string; subregion: string;
  view: ViewType; angle: number; elevation?: number; kind: 'context' | 'highlight';
  width: number; height: number; panelStructureNames: string[];
}
const rows: Row[] = [];
const hotspots: Record<string, Hotspot[]> = {};
const skipped: string[] = [];
const dropped: string[] = [];
let published = 0;

const areaReport: string[] = [];
for (const ligId of readdirSync(rendersRoot).sort()) {
  if (only && !only.has(ligId)) continue;
  const lig = byId.get(ligId);
  const tracedAreas: number[] = [];
  if (!lig) { skipped.push(`${ligId}: not a seeded ligament`); continue; }
  if (!lig.subregion) { skipped.push(`${ligId}: no subregion, cannot place in an Area`); continue; }

  const ligDir = join(rendersRoot, ligId);
  for (const angleDir of readdirSync(ligDir).filter((n) => /^a\d{3}(?:[ud]\d{3})?$/.test(n)).sort()) {
    const dir = join(ligDir, angleDir);
    const angle = Number(angleDir.slice(1, 4));
    // A tilted frame (aNNNuMMM, aNNNdMMM) is named for where the camera is: a
    // foot seen from above is its dorsum, from below its sole.
    const tiltMatch = /([ud])(\d{3})$/.exec(angleDir);
    const elevation = tiltMatch ? (tiltMatch[1] === 'u' ? 1 : -1) * Number(tiltMatch[2]) : 0;
    const foot = lig?.subregion === 'ankle-foot';
    const view: ViewType | undefined = elevation > 0 ? (foot ? 'dorsal' : 'superior')
      : elevation < 0 ? (foot ? 'plantar' : 'inferior')
      : VIEW_FOR_ANGLE[angle];
    if (!view) { skipped.push(`${ligId} ${angleDir}: no view name for this angle`); continue; }
    if (!['context', 'highlight', 'mask'].every((f) => existsSync(join(dir, `${f}.png`)))) {
      skipped.push(`${ligId} ${angleDir}: render incomplete`);
      continue;
    }

    const mask = decodePng(join(dir, 'mask.png'));
    const traced = maskToPolygons(binariseAlpha(mask.data, mask.width, mask.height), mask.width, mask.height,
      { minComponentPx: 60, epsilon: 1.5 });
    if (!traced.polygons.length || traced.area < MIN_TARGET_AREA) {
      skipped.push(`${ligId} ${angleDir}: target hidden from here (${(traced.area * 100).toFixed(3)}%)`);
      continue;
    }

    const target: Hotspot = { structureId: ligId, polygons: traced.polygons, area: traced.area, centroid: traced.centroid };
    tracedAreas.push(traced.area);
    const idPass = traceNeighbours(dir, ligId);
    const neighbours = makeExclusive(target, idPass.neighbours, idPass.ownerAt);
    if (neighbours.length < idPass.neighbours.length) {
      dropped.push(`${ligId} ${angleDir}: ${idPass.neighbours.length - neighbours.length} neighbour hotspot(s) dropped to keep taps exclusive`);
    }
    const names = [lig.name, ...neighbours.map((n) => byId.get(n.structureId)!.name)];

    for (const kind of ['context', 'highlight'] as const) {
      const dest = join(OUT_DIR, `${ligId}-${angleDir}-${kind}.webp`);
      const info = await sharp(join(dir, `${kind}.png`)).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);
      rows.push({
        structureId: ligId, name: lig.name, region: lig.region, subregion: lig.subregion,
        view, angle, ...(elevation ? { elevation } : {}), kind, width: info.width, height: info.height,
        panelStructureNames: kind === 'context' ? names : [lig.name],
      });
      published++;
    }
    hotspots[`ligament-${ligId}-${angleDir}-context`] = [target, ...neighbours];
  }
  if (tracedAreas.length) {
    const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
    areaReport.push(
      `  ${ligId.padEnd(52)} ${String(tracedAreas.length).padStart(2)} angle(s)  target ${pct(Math.min(...tracedAreas))} - ${pct(Math.max(...tracedAreas))} of the frame`,
    );
  }
}

if (only) {
  const missing = [...only].filter((id) => !rows.some((r) => r.structureId === id));
  if (missing.length) {
    console.error(`--only named ligament(s) with nothing published from ${rendersRoot}: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Carry every other ligament over from the current seed, untouched.
  for (const plate of LIGAMENT_PLATES) {
    if (only.has(plate.structureId)) continue;
    rows.push({ ...plate, panelStructureNames: [...plate.panelStructureNames] });
  }
  for (const [imageId, list] of Object.entries(LIGAMENT_HOTSPOTS)) {
    const owner = list[0]?.structureId;
    if (owner && only.has(owner)) continue;
    hotspots[imageId] = list.map((h) => ({ structureId: h.structureId, polygons: h.polygons, area: h.area, centroid: h.centroid }));
  }
  rows.sort((a, b) =>
    a.structureId.localeCompare(b.structureId) || a.angle - b.angle || (a.elevation ?? 0) - (b.elevation ?? 0) || a.kind.localeCompare(b.kind),
  );
}

const body = rows.map((r) =>
  `  { structureId: '${r.structureId}', name: ${JSON.stringify(r.name)}, region: '${r.region}', subregion: '${r.subregion}', ` +
  `view: '${r.view}', angle: ${r.angle}, ${r.elevation ? `elevation: ${r.elevation}, ` : ''}kind: '${r.kind}', width: ${r.width}, height: ${r.height}, ` +
  `panelStructureNames: ${JSON.stringify(r.panelStructureNames)} },`,
).join('\n');

writeFileSync(OUT_TS, `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishLigamentPlates.ts
 *
 * One row per file in public/anatomy/ligaments/. A ligament has up to eight
 * angles and each angle two kinds: 'context' (every ligament at rest; the
 * locate picture, with hotspots) and 'highlight' (the target in cyan; the
 * identify picture, no hotspots). Only angles where the target traced are
 * here. Dimensions are measured from the files, because they become the
 * aspect ratio of the box the student clicks in.
 */
export interface LigamentPlate {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /** Camera angle around the vertical axis, degrees; 0 is anterior. */
  angle: number;
  /** Degrees above (+) or below (-) the horizontal, for a tilted frame; absent when level. */
  elevation?: number;
  kind: 'context' | 'highlight';
  width: number;
  height: number;
  /** Every seeded ligament visible in the picture, the target first. */
  panelStructureNames: string[];
}

export const LIGAMENT_PLATES: LigamentPlate[] = [
${body}
];
`);

const hsBody = Object.entries(hotspots).map(([id, list]) =>
  `  '${id}': [\n${list.map((h) =>
    `    { structureId: '${h.structureId}', polygons: ${JSON.stringify(h.polygons)}, area: ${h.area}, centroid: ${JSON.stringify(h.centroid)} },`,
  ).join('\n')}\n  ],`,
).join('\n');

writeFileSync(OUT_HOTSPOTS, `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:
 *   blender atlas/Z-Anatomy/Startup.blend --background \\
 *     --python src/scripts/blender/renderLigamentPlates.py -- \\
 *     --spec ligament-tranche1.spec.json --out renders/ligaments-tranche1
 *   npx tsx src/scripts/publishLigamentPlates.ts --renders renders/ligaments-tranche1
 *
 * One entry per published context image. The first hotspot is the target
 * ligament, traced from its own mask with the bones and every other strap
 * held out; the rest are the other seeded ligaments in view, traced from the
 * ID pass, so a click on the wrong ligament can be named. Straps that are
 * not seeded ligaments are drawn but carry no hotspot, and a neighbour whose
 * outline would swallow another's is dropped so that every tap resolves to
 * the strap it landed on.
 */
import type { HotspotPolygon } from '../../types/image';

export const LIGAMENT_HOTSPOTS: Record<string, HotspotPolygon[]> = {
${hsBody}
};
`);

const contexts = rows.filter((r) => r.kind === 'context');
const perLig = new Map<string, number>();
for (const r of contexts) perLig.set(r.structureId, (perLig.get(r.structureId) ?? 0) + 1);
const extra = Object.values(hotspots).reduce((n, l) => n + l.length - 1, 0);
console.log(`${published} image(s) -> public/anatomy/ligaments/  (${contexts.length} locate pictures, ${perLig.size} ligaments)`);
console.log(`${extra} neighbour hotspot(s) across them`);
console.log(`rows -> ${OUT_TS.replace(ROOT, '.')}\nhotspots -> ${OUT_HOTSPOTS.replace(ROOT, '.')}`);
for (const [id, n] of [...perLig.entries()].sort()) console.log(`  ${id.padEnd(52)} ${n}/8 angles`);
if (dropped.length) {
  console.log(`\n${dropped.length} picture(s) had a neighbour hotspot dropped for exclusivity:`);
  for (const d of dropped) console.log(`  ${d}`);
}
if (skipped.length) {
  const hidden = skipped.filter((s) => s.includes('hidden')).length;
  const incomplete = skipped.filter((s) => s.includes('incomplete')).length;
  console.log(`\n${skipped.length} skipped: ${hidden} hidden angles, ${incomplete} incomplete renders, ` +
    `${skipped.length - hidden - incomplete} other`);
  for (const s of skipped.filter((x) => !x.includes('hidden') && !x.includes('incomplete'))) console.log(`  ${s}`);
}

// Delete what nothing points at. A file name is <ligament>-a<angle>-<kind>.webp.
const markerOf = (r: Row) =>
  `a${String(r.angle).padStart(3, '0')}${r.elevation ? `${r.elevation > 0 ? 'u' : 'd'}${String(Math.abs(r.elevation)).padStart(3, '0')}` : ''}`;
const wanted = new Set(rows.map((r) => `${r.structureId}-${markerOf(r)}-${r.kind}.webp`));
const stale = readdirSync(OUT_DIR).filter((name) => name.endsWith('.webp') && !wanted.has(name));
for (const name of stale) unlinkSync(join(OUT_DIR, name));
console.log(`${stale.length} stale image(s) removed from public/anatomy/ligaments`);
for (const name of stale) console.log(`  ${name}`);
if (areaReport.length) {
  console.log('Target size per ligament published from this run:');
  for (const line of areaReport) console.log(line);
}
