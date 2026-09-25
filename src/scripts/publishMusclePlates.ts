import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isMuscle } from '../features/anatomy-revision/types/structure';
import type { ViewType } from '../features/anatomy-revision/types/image';
import type { SubRegion } from '../features/anatomy-revision/types/region';
import { pointInAnyPolygon } from '../features/anatomy-revision/lib/hotspot/pointInPolygon';
import { simplifyRing } from '../features/anatomy-revision/lib/hotspot/polygonGeometry';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';
import { viewForAngle } from './lib/viewForAngle';
import { MUSCLE_PLATES } from '../features/anatomy-revision/data/seed/musclePlates.generated';
import { MUSCLE_HOTSPOTS } from '../features/anatomy-revision/data/seed/hotspots.muscles.generated';

/**
 * Publishes the muscle plates: two webps per muscle per angle, plus the
 * generated lists images.seed.ts builds its muscle plate assets from.
 *
 *   npx tsx src/scripts/publishMusclePlates.ts --renders renders/muscles
 *   npx tsx src/scripts/publishMusclePlates.ts --renders renders/muscles-sample \
 *     --only deltoid,subscapularis
 *
 * This is publishLigamentPlates.ts applied to the muscles, and deliberately so:
 * the renderer writes the same four files per frame, so the same packer reads
 * them. What differs is the turntable (twelve frames at thirty degrees, as the
 * joints and sub-region plates use, not eight at forty-five) and the ID legend,
 * which already names structures rather than Blender objects.
 *
 * TWO PICTURES PER ANGLE, because the two question types need different ones.
 * `context` draws every muscle in frame in the same red and is the locate
 * picture: it carries a hotspot for the target and for every other seeded
 * muscle in view. `highlight` picks the target out in cyan and is the identify
 * picture — and, since the user asked for it, the atlas picture too: "in the
 * atlas i want the muscle highlighted as if it were an identify question as
 * opposed to on its own". It is pre-highlighted, so it carries no hotspots and
 * can never be a locate question.
 *
 * ONLY ANGLES WHERE THE TARGET TRACES ARE PUBLISHED, so the count of context
 * images is the count of locate questions and a student is never shown a frame
 * with nothing in it to find. A muscle that traces nowhere is reported at the
 * end rather than passing quietly: that is the signal that its layer is wrong.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/muscles`;
const OUT_TS = `${ROOT}/src/features/anatomy-revision/data/seed/musclePlates.generated.ts`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.muscles.generated.ts`;

/**
 * THE HOTSPOTS ARE SPLIT BY AREA, one file per sub-region — the ligaments'
 * lesson, learned there the hard way: one file of outlines for 900 locate
 * pictures was 7 MB, past the 2 MiB a service worker will precache, and the
 * build refused outright. There are more muscle pictures than ligament ones,
 * so each area gets its own lazily loaded chunk from the start. The names are
 * fixed because seed/hotspots.ts lists them.
 */
const HOTSPOT_GROUPS: SubRegion[] = [
  'shoulder', 'elbow', 'wrist-hand', 'hip', 'knee', 'ankle-foot', 'spine', 'torso', 'neck',
];
const hotspotPartPath = (group: string) =>
  `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.muscles.${group}.generated.ts`;

/** Four decimals of a 1500px frame is a sixth of a pixel: more is only bytes. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const roundRings = (polygons: number[][][]) => polygons.map((ring) => ring.map(([x, y]) => [round4(x), round4(y)]));
/** A neighbour's outline only has to name a wrong tap, not grade a right one. */
const coarsen = (polygons: number[][][]) =>
  polygons.map((ring) => simplifyRing(ring, { epsilon: 0.003, maxVertices: 24, minVertices: 6 }));

/**
 * Below this share of the frame a traced target is a few pixels, not a
 * question. The same floor the ligament plates settled on: at 1500px, 0.02% of
 * the frame is about 450 pixels, which is enough of a blob to trace an honest
 * outline from, and the locate screen has zoom.
 */
const MIN_TARGET_AREA = Number(
  process.argv.includes('--min-area') ? process.argv[process.argv.indexOf('--min-area') + 1] : 0.0002,
);

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const rendersRoot = join(ROOT, args.renders ?? 'renders/muscles');
const only = args.only ? new Set(args.only.split(',').map((x) => x.trim()).filter(Boolean)) : null;
const quality = Number(args.quality ?? '82');

if (!existsSync(rendersRoot)) {
  console.error(`No renders at ${rendersRoot} — run renderMusclePlates.py first.`);
  process.exit(1);
}

const muscles = ALL_STRUCTURES.filter(isMuscle);
const byId = new Map(muscles.map((m) => [m.id, m]));
/** Which muscles the renderer drew with the superficial layer taken off. */
const deepLayer = new Set<string>(
  (JSON.parse(readFileSync(`${ROOT}/muscle-plates.spec.json`, 'utf8')).muscles as { key: string; layer: number }[])
    .filter((e) => e.layer >= 1)
    .map((e) => e.key),
);

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

/** The ID pass back into per-muscle outlines. The legend is already keyed by structure id. */
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
  for (const [id, structureId] of Object.entries(legend)) {
    const k = Number(id);
    if (k === 1) continue;
    // Index 1 is the target and carries its NAME; every other index is a
    // structure id the renderer grouped by muscle, not by Blender object.
    if (!byId.has(structureId)) continue;
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
 * resolved to another structure. Lifted from publishLigamentPlates.ts, where
 * the reasoning is written out — every pixel of the ID pass belongs to exactly
 * one muscle, but the tracer keeps outer boundaries only, so a muscle that
 * lies wholly inside another's outline gets swallowed by it.
 */
function makeExclusive(target: Hotspot, neighbours: Hotspot[], ownerAt: (x: number, y: number) => string): Hotspot[] {
  const STEPS = 100;
  const MAX_SHARE = 0.008;
  let kept = [...neighbours];
  for (;;) {
    const all = [target, ...kept];
    let covered = 0;
    let doubled = 0;
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

/**
 * ONE ROW PER ANGLE, NOT PER PICTURE. Every published angle has both a context
 * and a highlight webp — the publisher writes them together or not at all — so
 * a row per picture would say the same thing twice, and this list lives in the
 * app's entry chunk, which has about 200 kB of headroom under the 2 MiB a
 * service worker will precache. The seed expands each row into its two images.
 */
interface Row {
  structureId: string; name: string; region: string; subregion: SubRegion;
  view: ViewType; angle: number;
  deep: boolean; width: number; height: number;
  /** Every seeded muscle in the context picture, the target first. */
  panelStructureNames: string[];
  /**
   * The one angle per muscle where it shows largest — the picture its card and
   * the atlas open on. Without it a card opens on whichever angle sorts first,
   * which is 0 degrees, and trapezius is a back muscle: the reader would meet
   * it from the front, where almost none of it is visible.
   */
  primary: boolean;
}
const rows: Row[] = [];
const hotspots: Record<string, Hotspot[]> = {};
const skipped: string[] = [];
const dropped: string[] = [];
const traceless: string[] = [];
let published = 0;

const areaReport: string[] = [];
for (const muscleId of readdirSync(rendersRoot).sort()) {
  if (only && !only.has(muscleId)) continue;
  if (!statSync(join(rendersRoot, muscleId)).isDirectory()) continue;
  const muscle = byId.get(muscleId);
  if (!muscle) { skipped.push(`${muscleId}: not a seeded muscle`); continue; }
  if (!muscle.subregion) { skipped.push(`${muscleId}: no subregion, cannot place in an Area`); continue; }

  const tracedAreas: number[] = [];
  const muscleDir = join(rendersRoot, muscleId);
  // Written by the renderer: a plate with both sides in it has no medial view
  // (lib/viewForAngle.ts). Missing means an older render; say so rather than
  // guess, because a guess is how every plate came to be labelled backwards.
  const metaPath = join(muscleDir, 'meta.json');
  if (!existsSync(metaPath)) { skipped.push(`${muscleId}: no meta.json, re-render it`); continue; }
  const midline = Boolean(JSON.parse(readFileSync(metaPath, 'utf8')).midline);
  for (const angleDir of readdirSync(muscleDir).filter((n) => /^a\d{3}$/.test(n)).sort()) {
    const dir = join(muscleDir, angleDir);
    const angle = Number(angleDir.slice(1));
    const view = viewForAngle(angle, midline);
    if (!['context', 'highlight', 'mask'].every((f) => existsSync(join(dir, `${f}.png`)))) {
      skipped.push(`${muscleId} ${angleDir}: render incomplete`);
      continue;
    }

    const mask = decodePng(join(dir, 'mask.png'));
    const traced = maskToPolygons(binariseAlpha(mask.data, mask.width, mask.height), mask.width, mask.height,
      { minComponentPx: 60, epsilon: 1.5 });
    if (!traced.polygons.length || traced.area < MIN_TARGET_AREA) {
      skipped.push(`${muscleId} ${angleDir}: target hidden from here (${(traced.area * 100).toFixed(3)}%)`);
      continue;
    }

    const target: Hotspot = { structureId: muscleId, polygons: traced.polygons, area: traced.area, centroid: traced.centroid };
    tracedAreas.push(traced.area);
    const idPass = traceNeighbours(dir, muscleId);
    const neighbours = makeExclusive(target, idPass.neighbours, idPass.ownerAt);
    if (neighbours.length < idPass.neighbours.length) {
      dropped.push(`${muscleId} ${angleDir}: ${idPass.neighbours.length - neighbours.length} neighbour hotspot(s) dropped to keep taps exclusive`);
    }
    const names = [muscle.name, ...neighbours.map((n) => byId.get(n.structureId)!.name)];

    let size = { width: 0, height: 0 };
    for (const kind of ['context', 'highlight'] as const) {
      const dest = join(OUT_DIR, `${muscleId}-${angleDir}-${kind}.webp`);
      const info = await sharp(join(dir, `${kind}.png`)).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);
      size = { width: info.width, height: info.height };
      published++;
    }
    rows.push({
      structureId: muscleId, name: muscle.name, region: muscle.region, subregion: muscle.subregion,
      view, angle, deep: deepLayer.has(muscleId), width: size.width, height: size.height,
      panelStructureNames: names, primary: false,
    });
    hotspots[`muscle-${muscleId}-${angleDir}-context`] = [target, ...neighbours];
  }
  if (tracedAreas.length) {
    const best = Math.max(...tracedAreas);
    const biggest = rows.filter((r) => r.structureId === muscleId)
      .find((r) => hotspots[`muscle-${muscleId}-a${String(r.angle).padStart(3, '0')}-context`]?.[0].area === best);
    if (biggest) biggest.primary = true;
    const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
    areaReport.push(
      `  ${muscleId.padEnd(40)} ${String(tracedAreas.length).padStart(2)}/12 angles  target ${pct(Math.min(...tracedAreas))} - ${pct(Math.max(...tracedAreas))} of the frame`,
    );
  } else {
    // A MUSCLE THAT TRACES NOWHERE IS A LAYER THAT IS WRONG, not a muscle that
    // cannot be drawn: it was rendered with something in front of it at all
    // twelve angles. Named here so it can be moved to the deep layer.
    traceless.push(muscleId);
  }
}

if (only) {
  const missing = [...only].filter((id) => !rows.some((r) => r.structureId === id));
  if (missing.length) {
    console.error(`--only named muscle(s) with nothing published from ${rendersRoot}: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Carry every other muscle over from the current seed, untouched.
  for (const plate of MUSCLE_PLATES) {
    if (only.has(plate.structureId) || plate.kind === 'highlight') continue;
    const { kind: _kind, ...row } = plate;
    rows.push({ ...row, panelStructureNames: [...plate.panelStructureNames] });
  }
  for (const [imageId, list] of Object.entries(MUSCLE_HOTSPOTS)) {
    const owner = list[0]?.structureId;
    if (owner && only.has(owner)) continue;
    hotspots[imageId] = list.map((h) => ({ structureId: h.structureId, polygons: h.polygons, area: h.area, centroid: h.centroid }));
  }
  rows.sort((a, b) => a.structureId.localeCompare(b.structureId) || a.angle - b.angle);
}

// COMPACT ROWS, for the reason publishLigamentPlates.ts gives: 122 muscles at
// twelve angles and two kinds is nearly 3,000 plates, and this list lives in the
// app's ENTRY CHUNK. Each muscle's facts are written once, every plate is square
// and one size, and a row is [muscle, angle, view, primary].
//
// NO NEIGHBOUR NAMES. The locate picture used to list every muscle in it, and
// those lists were 74 kB of the 124 kB this file cost the entry chunk, which had
// 78 kB left under the 2 MiB precache limit. Nothing at runtime needed them:
// whether a picture shows a muscle is read from its hotspots (mcq.ts
// imageDepicts), which load separately and name every muscle traced in it; locate
// and prompt-image selection read only [0], the subject. Their one other reader,
// linkImages -> imageIds, feeds only a tie-break in the diagnostic's ordering.
const VIEWS = [...new Set(rows.map((r) => r.view))].sort();
const facts: Record<string, [string, string, string, 0 | 1]> = {};
for (const r of rows) facts[r.structureId] = [r.name, r.region, r.subregion, r.deep ? 1 : 0];
const sizes = new Set(rows.map((r) => `${r.width}x${r.height}`));
if (sizes.size > 1) throw new Error(`plates are not all one size: ${[...sizes].join(', ')}`);
const [W, H] = rows[0] ? [rows[0].width, rows[0].height] : [1500, 1500];
const body = rows
  .map((r) => JSON.stringify([r.structureId, r.angle, VIEWS.indexOf(r.view), r.primary ? 1 : 0]))
  .join(',\n');

writeFileSync(OUT_TS, `import type { LayerType, ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishMusclePlates.ts
 *
 * One row per angle; each angle is two files in public/anatomy/muscles/:
 * 'context' (every muscle in frame in the same red; the locate picture, with
 * hotspots) and 'highlight' (the target in cyan; the identify and atlas
 * picture, no hotspots). Only angles where the target traced are here. Stored
 * compactly — see publishMusclePlates.ts — and expanded to MusclePlate on load.
 */
export interface MusclePlate {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /** Camera angle around the vertical axis, degrees; 0 is anterior. */
  angle: number;
  kind: 'context' | 'highlight';
  /** True when the plate was drawn with the superficial layer taken off. */
  deep: boolean;
  width: number;
  height: number;
  /**
   * The subject alone. The other muscles in a locate picture are named by its
   * hotspots, which load separately; listing them here cost the entry chunk
   * 74 kB (see publishMusclePlates.ts).
   */
  panelStructureNames: string[];
  /** The one highlight frame per muscle where it shows largest: its card picture. */
  primary: boolean;
}

/** What the image's layer field says, which is what the layer filters key off. */
export const layerOfPlate = (plate: MusclePlate): LayerType =>
  plate.deep ? 'deep-muscle' : 'superficial-muscle';

const W = ${W};
const H = ${H};
const VIEWS: ViewType[] = ${JSON.stringify(VIEWS)};
const MUSCLES: Record<string, [string, Region, SubRegion, 0 | 1]> = ${JSON.stringify(facts)};
const ROWS: [string, number, number, 0 | 1][] = [
${body}
];

/**
 * Two plates per row: every published angle has a context picture and a
 * highlight picture, written together by the publisher.
 */
export const MUSCLE_PLATES: MusclePlate[] = ROWS.flatMap(([structureId, angle, view, primary]) => {
  const [name, region, subregion, deep] = MUSCLES[structureId];
  const shared = {
    structureId,
    name,
    region,
    subregion,
    view: VIEWS[view],
    angle,
    deep: deep === 1,
    width: W,
    height: H,
    panelStructureNames: [name],
  };
  return [
    { ...shared, kind: 'context' as const, primary: false },
    { ...shared, kind: 'highlight' as const, primary: primary === 1 },
  ];
});
`);

const HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with publishMusclePlates.ts (renders from renderMusclePlates.py).
 *
 * One entry per published context image. The first hotspot is the target
 * muscle, traced from its own mask with the bones and every other muscle held
 * out; the rest are the other seeded muscles in view, traced from the ID pass
 * and simplified, so a tap on the wrong muscle can be named.
 */`;

/** Share of the covered frame two hotspots claim, on a 100x100 grid. */
function doubledShare(rings: number[][][][]): number {
  let covered = 0;
  let doubled = 0;
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const p: [number, number] = [(x + 0.5) / 100, (y + 0.5) / 100];
      const hits = rings.filter((r) => pointInAnyPolygon(p, r)).length;
      if (hits) covered++;
      if (hits > 1) doubled++;
    }
  }
  return covered ? doubled / covered : 0;
}

const subregionOf = new Map(rows.map((r) => [r.structureId, r.subregion] as const));
const byGroup = new Map<string, string[]>(HOTSPOT_GROUPS.map((g) => [g, []]));
let keptFine = 0;
for (const [imageId, list] of Object.entries(hotspots).sort(([a], [b]) => a.localeCompare(b))) {
  // Coarsening can push a neighbour's corner across a muscle it only touched,
  // and makeExclusive checked the detailed outlines — so where the coarse ones
  // overlap, the image keeps its detailed ones.
  const coarse = list.map((h, i) => roundRings(i === 0 ? h.polygons : coarsen(h.polygons)));
  const fine = list.map((h) => roundRings(h.polygons));
  const useFine = list.length > 1 && doubledShare(coarse) > 0.008;
  if (useFine) keptFine++;
  const lines = list.map((h, i) => {
    const polygons = (useFine ? fine : coarse)[i];
    return `    { structureId: '${h.structureId}', polygons: ${JSON.stringify(polygons)}, area: ${Number(h.area.toPrecision(5))}, centroid: ${JSON.stringify(h.centroid.map(round4))} },`;
  });
  const group = subregionOf.get(list[0]?.structureId ?? '') ?? 'torso';
  byGroup.get(group)!.push(`  '${imageId}': [\n${lines.join('\n')}\n  ],`);
}
console.log(`${keptFine} image(s) keep detailed neighbour outlines (coarse ones overlapped)`);

/**
 * AN AREA IS SPLIT UNTIL ITS FILE FITS, and the loader is generated from what
 * was written rather than typed by hand.
 *
 * A chunk over 2 MiB is one the service worker will not precache, and the build
 * FAILS at that step rather than shipping something that is not offline. The
 * first full run put the wrist and hand at 2.06 MB — 28 muscles, 257 pictures,
 * and every other muscle in each picture traced so a wrong tap can be named.
 * Splitting by hand would mean a fixed list in seed/hotspots.ts that goes stale
 * the moment a muscle's plates change, so the budget is applied here and the
 * index module is written beside the parts.
 */
const PART_BUDGET = 1_200_000;
const written: string[] = [];
for (const [group, entries] of byGroup) {
  const bytes = entries.reduce((n, e) => n + e.length, 0);
  const parts = Math.max(1, Math.ceil(bytes / PART_BUDGET));
  const per = Math.ceil(entries.length / parts);
  for (let i = 0; i < parts; i++) {
    const slice = entries.slice(i * per, (i + 1) * per);
    const name = parts === 1 ? group : `${group}-${i + 1}`;
    const path = hotspotPartPath(name);
    writeFileSync(path, `${HEADER}
import type { HotspotPolygon } from '../../types/image';

export const MUSCLE_HOTSPOTS_PART: Record<string, HotspotPolygon[]> = {
${slice.join('\n')}
};
`);
    written.push(name);
    const mb = statSync(path).size / 1024 / 1024;
    console.log(`  ${name.padEnd(14)} ${String(slice.length).padStart(4)} image(s)  ${mb.toFixed(2)} MB${mb > 1.8 ? '  <-- OVER the 2 MiB precache limit, lower PART_BUDGET' : ''}`);
  }
}

// Anything left from a run when an area needed more parts than it does now.
const stalePart = /^hotspots\.muscles\.(.+)\.generated\.ts$/;
const seedDir = `${ROOT}/src/features/anatomy-revision/data/seed`;
for (const file of readdirSync(seedDir)) {
  const m = stalePart.exec(file);
  if (m && m[1] !== '' && !written.includes(m[1])) unlinkSync(join(seedDir, file));
}

const camel = (name: string) => name.replace(/-(.)/g, (_, c: string) => c.toUpperCase());
writeFileSync(`${seedDir}/hotspots.muscles.index.generated.ts`, `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with publishMusclePlates.ts.
 *
 * One lazily loaded chunk per part, keyed the way seed/hotspots.ts wants them.
 * Generated rather than typed because how many parts an area needs depends on
 * how much traces, which changes with every render.
 */
import type { HotspotPolygon } from '../../types/image';

export const MUSCLE_HOTSPOT_SETS: Record<string, () => Promise<Record<string, HotspotPolygon[]>>> = {
${written
  .map(
    (name) =>
      `  muscles${camel(name)[0].toUpperCase()}${camel(name).slice(1)}: () => import('./hotspots.muscles.${name}.generated').then((m) => m.MUSCLE_HOTSPOTS_PART),`,
  )
  .join('\n')}
};
`);
writeFileSync(OUT_HOTSPOTS, `/**
 * GENERATED FILE — do not edit by hand. Every muscle hotspot, for SCRIPTS.
 * The app never imports this: seed/hotspots.ts loads each part as its own
 * chunk, because together they are far past the 2 MiB precache limit.
 */
import type { HotspotPolygon } from '../../types/image';
${written.map((name) => `import { MUSCLE_HOTSPOTS_PART as ${camel(name)} } from './hotspots.muscles.${name}.generated';`).join('\n')}

export const MUSCLE_HOTSPOTS: Record<string, HotspotPolygon[]> = { ${written.map((name) => '...' + camel(name)).join(', ')} };
`);

const perMuscle = new Map<string, number>();
for (const r of rows) perMuscle.set(r.structureId, (perMuscle.get(r.structureId) ?? 0) + 1);
const extra = Object.values(hotspots).reduce((n, l) => n + l.length - 1, 0);
console.log(`${published} image(s) -> public/anatomy/muscles/  (${rows.length} locate pictures, ${perMuscle.size} muscles)`);
console.log(`${extra} neighbour hotspot(s) across them`);
console.log(`rows -> ${OUT_TS.replace(ROOT, '.')}\nhotspots -> ${OUT_HOTSPOTS.replace(ROOT, '.')}`);
if (traceless.length) {
  console.log(`\n${traceless.length} muscle(s) traced at NO angle — check their layer:`);
  for (const id of traceless) console.log(`  ${id}`);
}
if (dropped.length) console.log(`\n${dropped.length} picture(s) had a neighbour hotspot dropped for exclusivity`);
if (skipped.length) {
  const hidden = skipped.filter((s) => s.includes('hidden')).length;
  const incomplete = skipped.filter((s) => s.includes('incomplete')).length;
  console.log(`\n${skipped.length} skipped: ${hidden} hidden angles, ${incomplete} incomplete renders, ` +
    `${skipped.length - hidden - incomplete} other`);
  for (const s of skipped.filter((x) => !x.includes('hidden') && !x.includes('incomplete'))) console.log(`  ${s}`);
}

// Delete what nothing points at. A file name is <muscle>-a<angle>-<kind>.webp.
const wanted = new Set(rows.flatMap((r) => ['context', 'highlight'].map(
  (kind) => `${r.structureId}-a${String(r.angle).padStart(3, '0')}-${kind}.webp`)));
const stale = readdirSync(OUT_DIR).filter((name) => name.endsWith('.webp') && !wanted.has(name));
for (const name of stale) unlinkSync(join(OUT_DIR, name));
console.log(`${stale.length} stale image(s) removed from public/anatomy/muscles`);
if (areaReport.length) {
  console.log('Target size per muscle published from this run:');
  for (const line of areaReport) console.log(line);
}
