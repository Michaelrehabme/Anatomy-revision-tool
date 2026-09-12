import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isLigament } from '../features/anatomy-revision/types/structure';
import type { ViewType } from '../features/anatomy-revision/types/image';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';

/**
 * Publishes the ligament plates: two webps per ligament per angle, plus the
 * generated lists images.seed.ts builds its ligament image assets from.
 *
 *   npx tsx src/scripts/publishLigamentPlates.ts --renders renders/ligaments-tranche1
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

/** Below this share of the frame a traced target is a few pixels, not a question. */
const MIN_TARGET_AREA = 0.0004;

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

function srgbToLinear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** The ID pass back into per-ligament outlines, keyed by seeded ligament id. */
function traceNeighbours(dir: string): { structureId: string; polygons: number[][][]; area: number; centroid: [number, number] }[] {
  if (!existsSync(`${dir}/ids.png`) || !existsSync(`${dir}/ids.json`)) return [];
  const legend: Record<string, string> = JSON.parse(readFileSync(`${dir}/ids.json`, 'utf8'));
  const png = decodePng(`${dir}/ids.png`);
  const index = new Uint8Array(png.width * png.height);
  for (let i = 0; i < index.length; i++) {
    if (png.data[i * 4 + 3] < 128) continue;
    const r = Math.round(srgbToLinear(png.data[i * 4]) * 15);
    const g = Math.round(srgbToLinear(png.data[i * 4 + 1]) * 15);
    index[i] = g * 16 + r;
  }
  const out: { structureId: string; polygons: number[][][]; area: number; centroid: [number, number] }[] = [];
  for (const [id, meshName] of Object.entries(legend)) {
    const k = Number(id);
    if (k === 1) continue;
    const structureId = idByMeshName.get(meshName.replace(/\.(o\d?)?[lr]$/, ''));
    // A strap that is not a seeded ligament is scenery: drawn, not askable.
    if (!structureId) continue;
    const mask = new Uint8Array(index.length);
    let n = 0;
    for (let i = 0; i < index.length; i++) if (index[i] === k) { mask[i] = 1; n++; }
    if (n < 40) continue;
    const t = maskToPolygons(mask, png.width, png.height, { minComponentPx: 40, epsilon: 1.5, maxVertices: 80 });
    if (!t.polygons.length || t.area < MIN_TARGET_AREA) continue;
    out.push({ structureId, polygons: t.polygons, area: t.area, centroid: t.centroid });
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });

interface Row {
  structureId: string; name: string; region: string; subregion: string;
  view: ViewType; angle: number; kind: 'context' | 'highlight';
  width: number; height: number; panelStructureNames: string[];
}
const rows: Row[] = [];
const hotspots: Record<string, unknown[]> = {};
const skipped: string[] = [];
let published = 0;

for (const ligId of readdirSync(rendersRoot).sort()) {
  const lig = byId.get(ligId);
  if (!lig) { skipped.push(`${ligId}: not a seeded ligament`); continue; }
  if (!lig.subregion) { skipped.push(`${ligId}: no subregion, cannot place in an Area`); continue; }

  const ligDir = join(rendersRoot, ligId);
  for (const angleDir of readdirSync(ligDir).filter((n) => /^a\d{3}$/.test(n)).sort()) {
    const dir = join(ligDir, angleDir);
    const angle = Number(angleDir.slice(1));
    const view = VIEW_FOR_ANGLE[angle];
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

    const neighbours = traceNeighbours(dir);
    const names = [lig.name, ...neighbours.map((n) => byId.get(n.structureId)!.name)];

    for (const kind of ['context', 'highlight'] as const) {
      const dest = join(OUT_DIR, `${ligId}-${angleDir}-${kind}.webp`);
      const info = await sharp(join(dir, `${kind}.png`)).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);
      rows.push({
        structureId: ligId, name: lig.name, region: lig.region, subregion: lig.subregion,
        view, angle, kind, width: info.width, height: info.height,
        panelStructureNames: kind === 'context' ? names : [lig.name],
      });
      published++;
    }
    hotspots[`ligament-${ligId}-${angleDir}-context`] = [
      { structureId: ligId, polygons: traced.polygons, area: traced.area, centroid: traced.centroid },
      ...neighbours,
    ];
  }
}

const body = rows.map((r) =>
  `  { structureId: '${r.structureId}', name: ${JSON.stringify(r.name)}, region: '${r.region}', subregion: '${r.subregion}', ` +
  `view: '${r.view}', angle: ${r.angle}, kind: '${r.kind}', width: ${r.width}, height: ${r.height}, ` +
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
 * not seeded ligaments are drawn but carry no hotspot.
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
if (skipped.length) {
  const hidden = skipped.filter((s) => s.includes('hidden')).length;
  const incomplete = skipped.filter((s) => s.includes('incomplete')).length;
  console.log(`\n${skipped.length} skipped: ${hidden} hidden angles, ${incomplete} incomplete renders, ` +
    `${skipped.length - hidden - incomplete} other`);
  for (const s of skipped.filter((x) => !x.includes('hidden') && !x.includes('incomplete'))) console.log(`  ${s}`);
}
