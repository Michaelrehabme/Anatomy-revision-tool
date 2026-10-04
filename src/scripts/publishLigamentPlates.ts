import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isLigament } from '../features/anatomy-revision/types/structure';
import type { ImageVariantKind, ViewType } from '../features/anatomy-revision/types/image';
import { pointInAnyPolygon } from '../features/anatomy-revision/lib/hotspot/pointInPolygon';
import { simplifyRing } from '../features/anatomy-revision/lib/hotspot/polygonGeometry';
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
 *
 * --spec FILE reads what the renderer ignores: per-ligament publishing
 * decisions (see ligament-buried.spec.json).
 *   publish.levelAngles false   only the tilted views are published. The
 *                               meniscotibial pair lie flat on the tibial
 *                               plateau and show nothing from a level camera.
 *   publish.locateOn            the ligament is LOCATED on another plate (the
 *                               interosseous ligaments of the wrist, on the
 *                               carpal gap plate). Only its identify pictures
 *                               are published here and it gets no hotspot.
 *   variant {kind, subject}     what its second render is, and the word the
 *                               viewer switch uses ("Femur", "Bones").
 *
 * --variants hidden=DIR;solid=DIR publishes A SECOND RENDER OF THE SAME
 * CAMERAS beside each frame: the femur cut away instead of ghosted, the
 * carpal bones solid instead of see-through. It is the same frame, so it is
 * not a row of its own: it rides on the default row as `variant`, the viewer
 * offers a switch wherever a frame has one, and locate grades every tap
 * against the default picture's hotspots whichever is showing. That is only
 * honest if the target is in the same place in both, so a variant of a locate
 * picture is published only where its mask matches the default's.
 * The file is <ligament>-<marker>-<kind>.<variant>.webp: the variant stays out
 * of the -aNNN- segment so the name still sorts beside its frame.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/ligaments`;
const OUT_TS = `${ROOT}/src/features/anatomy-revision/data/seed/ligamentPlates.generated.ts`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.ligaments.generated.ts`;
/**
 * THE HOTSPOTS ARE SPLIT BY BODY AREA. With the second tranche there are over
 * 900 locate pictures, and one file of their outlines was 7 MB — past the
 * 2 MiB a service worker will precache, so the build refused. Each group is
 * its own lazily loaded chunk (seed/hotspots.ts); the unsplit
 * hotspots.ligaments.generated.ts only re-exports them all, for scripts.
 * The group names are fixed because the loader lists them.
 */
const HOTSPOT_GROUPS: Record<string, string[]> = {
  upper: ['shoulder', 'elbow'],
  hand: ['wrist-hand'],
  hip: ['hip'],
  knee: ['knee'],
  foot: ['ankle-foot'],
  // The foot's tilted views are its own file: with them the foot alone was
  // past the 2 MiB limit. Chosen by image id, not subregion (see groupFor).
  footTilt: [],
  axial: ['spine', 'torso', 'neck'],
};
const groupOf = (subregion: string | undefined) =>
  Object.entries(HOTSPOT_GROUPS).find(([, subs]) => subregion && subs.includes(subregion))?.[0] ?? 'axial';
const hotspotPartPath = (group: string) => `${ROOT}/src/features/anatomy-revision/data/seed/hotspots.ligaments.${group}.generated.ts`;

/** Four decimals of a 1600px frame is a sixth of a pixel: more is only bytes. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const roundRings = (polygons: number[][][]) => polygons.map((ring) => ring.map(([x, y]) => [round4(x), round4(y)]));
/**
 * A neighbour's outline only has to name a wrong tap, not grade a right one,
 * so it is simplified harder than the target's: 0.003 of the frame (about
 * five pixels) and at most 24 vertices a ring. Neighbours were 90% of the
 * file.
 */
const coarsen = (polygons: number[][][]) =>
  polygons.map((ring) => simplifyRing(ring, { epsilon: 0.003, maxVertices: 24, minVertices: 6 }));

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
/** Absolute, or relative to the repo: the renders live in the main checkout, a worktree publishes from there. */
const fromRoot = (p: string) => (isAbsolute(p) ? p : join(ROOT, p));
const rendersRoot = fromRoot(args.renders ?? 'renders/ligaments-tranche1');

interface SpecEntry {
  key: string;
  objects?: string[];
  publish?: { levelAngles?: boolean; locateOn?: string };
  variant?: { kind: ImageVariantKind; subject: string };
}
const readSpec = (path: string): SpecEntry[] =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')).ligaments ?? []) : [];
const specByKey = new Map<string, SpecEntry>(args.spec ? readSpec(fromRoot(args.spec)).map((e) => [e.key, e]) : []);

/** variant kind -> the renders root that holds it, from --variants hidden=DIR;solid=DIR. */
const variantRoots = new Map<ImageVariantKind, string>(
  (args.variants ?? '').split(';').filter(Boolean).map((pair) => {
    const at = pair.indexOf('=');
    return [pair.slice(0, at) as ImageVariantKind, fromRoot(pair.slice(at + 1))];
  }),
);

/**
 * LIGAMENTS LOCATED ON THE GAP PLATE HAVE NO HOTSPOT ANYWHERE ELSE. The five
 * interosseous ligaments of the wrist are asked by the gap between their two
 * bones (carpal-gaps.spec.json). If they were also traced as a neighbour on
 * another ligament's plate, locate would find that hotspot and ask them a
 * second time there, as a chip seen through a ghosted bone — the question the
 * gap plate exists to replace. Read from the gap spec rather than --spec, so a
 * later run that names neither still leaves them alone.
 */
const gapLocated = new Set<string>(
  existsSync(`${ROOT}/carpal-gaps.spec.json`)
    ? (JSON.parse(readFileSync(`${ROOT}/carpal-gaps.spec.json`, 'utf8')).joints as { id: string }[]).map((j) => j.id)
    : [],
);
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
  // The mapping file was last regenerated for the first tranche alone, so it
  // names 32 ligaments and the other 111 would be scenery on any plate
  // published now. The render specs say which meshes each ligament is drawn
  // from, which is the same fact; a spec key that is not a seeded ligament is
  // ignored, as an unmapped mesh always was.
  for (const file of ['ligament-tranche1.spec.json', 'ligament-tranche2.spec.json', 'ligament-buried.spec.json']) {
    for (const e of readSpec(`${ROOT}/${file}`)) {
      if (!byId.has(e.key)) continue;
      for (const b of e.objects ?? []) {
        const base = b.replace(/\.(o\d?)?[lr]$/, '');
        if (!idByMeshName.has(base)) idByMeshName.set(base, e.key);
      }
    }
  }
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
    // Drawn, and deliberately not askable here: see gapLocated.
    if (gapLocated.has(structureId)) continue;
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
  /** The second render of this frame, when one was published beside it. */
  variant?: { kind: ImageVariantKind; subject: string };
}

/** Share of the two masks' union that both cover: 1 is the same target in the same place. */
function maskAgreement(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) either++;
    if (a[i] && b[i]) both++;
  }
  return either ? both / either : 1;
}
/** Under this a variant's target is not where the default's is, and a tap would be graded against the wrong picture. */
const MIN_VARIANT_AGREEMENT = 0.9;
const variantReport: string[] = [];
const rows: Row[] = [];
const hotspots: Record<string, Hotspot[]> = {};
/** Image ids whose hotspots came from the current seed (--only), not from this run's renders. */
const carried = new Set<string>();
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
    // A TILTED VIEW KEEPS ITS COMPASS NAME. Everything tilted used to be called
    // 'superior', which was true of the one straight-down frame and left the
    // six 45-degree views of the knee with one name between them: the caption
    // under the picture read the same whichever way the student had turned.
    // Only a camera within ten degrees of the pole is the view from above (or
    // below); anything else is the side it was turned to, and the viewer adds
    // "tilted up 45°" from the id. The foot keeps dorsal and plantar, which is
    // what its tilted views are called by everyone who examines one.
    const steep = Math.abs(elevation) >= 80;
    const view: ViewType | undefined = elevation > 0 ? (foot ? 'dorsal' : steep ? 'superior' : VIEW_FOR_ANGLE[angle])
      : elevation < 0 ? (foot ? 'plantar' : steep ? 'inferior' : VIEW_FOR_ANGLE[angle])
      : VIEW_FOR_ANGLE[angle];
    if (!view) { skipped.push(`${ligId} ${angleDir}: no view name for this angle`); continue; }
    const hints = specByKey.get(ligId);
    if (hints?.publish?.levelAngles === false && elevation === 0) {
      skipped.push(`${ligId} ${angleDir}: level angle, and this ligament is published from above only`);
      continue;
    }
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
    // Located on another plate: the identify picture only, and no hotspot.
    const identifyOnly = !!hints?.publish?.locateOn || gapLocated.has(ligId);
    const kinds = identifyOnly ? (['highlight'] as const) : (['context', 'highlight'] as const);

    // The second render of this frame, if there is one and it is the same frame.
    let variant: Row['variant'];
    const variantRoot = hints?.variant ? variantRoots.get(hints.variant.kind) : undefined;
    if (hints?.variant && variantRoot) {
      const vdir = join(variantRoot, ligId, angleDir);
      if (!kinds.every((k) => existsSync(join(vdir, `${k}.png`)))) {
        variantReport.push(`${ligId} ${angleDir}: no ${hints.variant.kind} render, switch disabled on this frame`);
      } else if (!identifyOnly) {
        const vmask = decodePng(join(vdir, 'mask.png'));
        const agreement = vmask.width === mask.width && vmask.height === mask.height
          ? maskAgreement(binariseAlpha(mask.data, mask.width, mask.height), binariseAlpha(vmask.data, vmask.width, vmask.height))
          : 0;
        if (agreement < MIN_VARIANT_AGREEMENT) {
          variantReport.push(`${ligId} ${angleDir}: ${hints.variant.kind} target only ${(agreement * 100).toFixed(0)}% the same as the default's, NOT published`);
        } else {
          variant = hints.variant;
          variantReport.push(`${ligId} ${angleDir}: ${hints.variant.kind} target ${(agreement * 100).toFixed(1)}% the same`);
        }
      } else {
        variant = hints.variant;
      }
    }
    const idPass = identifyOnly ? { neighbours: [], ownerAt: () => '' } : traceNeighbours(dir, ligId);
    const neighbours = makeExclusive(target, idPass.neighbours, idPass.ownerAt);
    if (neighbours.length < idPass.neighbours.length) {
      dropped.push(`${ligId} ${angleDir}: ${idPass.neighbours.length - neighbours.length} neighbour hotspot(s) dropped to keep taps exclusive`);
    }
    const names = [lig.name, ...neighbours.map((n) => byId.get(n.structureId)!.name)];

    for (const kind of kinds) {
      const dest = join(OUT_DIR, `${ligId}-${angleDir}-${kind}.webp`);
      const info = await sharp(join(dir, `${kind}.png`)).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);
      if (variant) {
        const vdest = join(OUT_DIR, `${ligId}-${angleDir}-${kind}.${variant.kind}.webp`);
        const vinfo = await sharp(join(variantRoot!, ligId, angleDir, `${kind}.png`)).flatten({ background: '#ffffff' }).webp({ quality }).toFile(vdest);
        if (vinfo.width !== info.width || vinfo.height !== info.height) {
          throw new Error(`${ligId} ${angleDir} ${kind}: the ${variant.kind} render is ${vinfo.width}x${vinfo.height}, the default ${info.width}x${info.height}`);
        }
        published++;
      }
      rows.push({
        structureId: ligId, name: lig.name, region: lig.region, subregion: lig.subregion,
        view, angle, ...(elevation ? { elevation } : {}), kind, width: info.width, height: info.height,
        panelStructureNames: kind === 'context' ? names : [lig.name],
        ...(variant ? { variant } : {}),
      });
      published++;
    }
    if (!identifyOnly) hotspots[`ligament-${ligId}-${angleDir}-context`] = [target, ...neighbours];
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
    rows.push({ ...plate, panelStructureNames: [...plate.panelStructureNames], ...(plate.variant ? { variant: { ...plate.variant } } : {}) });
  }
  for (const [imageId, list] of Object.entries(LIGAMENT_HOTSPOTS)) {
    const owner = list[0]?.structureId;
    if (owner && only.has(owner)) continue;
    hotspots[imageId] = list.map((h) => ({ structureId: h.structureId, polygons: h.polygons, area: h.area, centroid: h.centroid }));
    carried.add(imageId);
  }
  rows.sort((a, b) =>
    a.structureId.localeCompare(b.structureId) || a.angle - b.angle || (a.elevation ?? 0) - (b.elevation ?? 0) || a.kind.localeCompare(b.kind),
  );
}

// COMPACT ROWS. With the second tranche there are over 1,800 plates, and
// written out in full the list was 890 kB of the app's entry chunk — most of
// it the same ligament's name, region and view repeated on every image, and
// every ligament in view spelled out on every locate picture. Each ligament's
// facts are written once, names are a table, every plate is 1600px square,
// and a row is [ligament, angle, elevation, kind, view, names], with a seventh
// entry — an index into VARIANTS, from 1 — only on a frame that has one.
const VARIANTS = [...new Set(rows.filter((r) => r.variant).map((r) => JSON.stringify([r.variant!.kind, r.variant!.subject])))].sort();
const NAMES = [...new Set(rows.flatMap((r) => r.panelStructureNames))].sort();
const nameIndex = new Map(NAMES.map((n, i) => [n, i]));
const VIEWS = [...new Set(rows.map((r) => r.view))].sort();
const ligFacts: Record<string, [string, string, string]> = {};
for (const r of rows) ligFacts[r.structureId] = [r.name, r.region, r.subregion];
const sizes = new Set(rows.map((r) => `${r.width}x${r.height}`));
if (sizes.size > 1) throw new Error(`plates are not all one size: ${[...sizes].join(', ')}`);
const [W, H] = (rows[0] ? [rows[0].width, rows[0].height] : [1600, 1600]);
const body = rows
  .map((r) => JSON.stringify([
    r.structureId, r.angle, r.elevation ?? 0, r.kind === 'context' ? 0 : 1, VIEWS.indexOf(r.view), r.panelStructureNames.map((n) => nameIndex.get(n)),
    ...(r.variant ? [VARIANTS.indexOf(JSON.stringify([r.variant.kind, r.variant.subject])) + 1] : []),
  ]))
  .join(',\n');

writeFileSync(OUT_TS, `import type { ImageVariantKind, ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishLigamentPlates.ts
 *
 * One row per file in public/anatomy/ligaments/. A ligament has up to eight
 * angles (and a foot ligament four tilted views) and each view two kinds:
 * 'context' (every ligament at rest; the locate picture, with hotspots) and
 * 'highlight' (the target in cyan; the identify picture, no hotspots). Only
 * views where the target traced are here. A ligament located on another plate
 * (publish.locateOn in its spec) has highlight rows only. Stored compactly — see
 * publishLigamentPlates.ts — and expanded to LigamentPlate on load.
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
  /**
   * A second render of this frame through the same camera, published beside it
   * as <ligament>-<marker>-<kind>.<variant>.webp: what it does to the picture,
   * and the word the viewer switch names it by.
   */
  variant?: { kind: ImageVariantKind; subject: string };
}

const W = ${W};
const H = ${H};
const NAMES: string[] = ${JSON.stringify(NAMES)};
const VIEWS: ViewType[] = ${JSON.stringify(VIEWS)};
const LIGS: Record<string, [string, Region, SubRegion]> = ${JSON.stringify(ligFacts)};
const VARIANTS: [ImageVariantKind, string][] = ${JSON.stringify(VARIANTS.map((v) => JSON.parse(v)))};
const ROWS: [string, number, number, 0 | 1, number, number[], number?][] = [
${body}
];

export const LIGAMENT_PLATES: LigamentPlate[] = ROWS.map(([structureId, angle, elevation, kind, view, names, variant]) => {
  const [name, region, subregion] = LIGS[structureId];
  return {
    structureId,
    name,
    region,
    subregion,
    view: VIEWS[view],
    angle,
    ...(elevation ? { elevation } : {}),
    kind: kind === 0 ? 'context' : 'highlight',
    width: W,
    height: H,
    panelStructureNames: names.map((i) => NAMES[i]),
    ...(variant ? { variant: { kind: VARIANTS[variant - 1][0], subject: VARIANTS[variant - 1][1] } } : {}),
  };
});
`);

const HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with publishLigamentPlates.ts (renders from renderLigamentPlates.py).
 *
 * One entry per published context image. The first hotspot is the target
 * ligament, traced from its own mask with the bones and every other strap
 * held out; the rest are the other seeded ligaments in view, traced from the
 * ID pass and simplified, so a click on the wrong ligament can be named.
 */`;
/** Share of the covered frame that two hotspots claim, on a 100x100 grid (as generateSet.test.ts measures it). */
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

const byGroup = new Map<string, string[]>(Object.keys(HOTSPOT_GROUPS).map((g) => [g, []]));
let keptFine = 0;
for (const [imageId, list] of Object.entries(hotspots).sort(([a], [b]) => a.localeCompare(b))) {
  const owner = byId.get(list[0]?.structureId ?? '');
  // Coarsening can push a neighbour's corner across a strap it only touched
  // (the ATFL's plantar view claimed 12% of the leg membrane). makeExclusive
  // checked the detailed outlines, so where the coarse ones overlap, the
  // image keeps its detailed ones.
  // CARRIED OVER MEANS UNTOUCHED. A carried image's outlines were coarsened
  // when it was published; putting them through the simplifier again shaved a
  // vertex here and there off every neighbour on every other ligament's plate,
  // each time any one ligament was re-published with --only (4 Oct 2026: nine
  // ligaments published, 5,400 lines of other plates' hotspots changed). They
  // are written back exactly as they were read.
  const asIs = carried.has(imageId);
  const coarse = list.map((h, i) => (asIs || i === 0 ? roundRings(h.polygons) : roundRings(coarsen(h.polygons))));
  const fine = list.map((h) => roundRings(h.polygons));
  const useFine = !asIs && list.length > 1 && doubledShare(coarse) > 0.008;
  if (useFine) keptFine++;
  const lines = list.map((h, i) => {
    const polygons = (useFine ? fine : coarse)[i];
    return `    { structureId: '${h.structureId}', polygons: ${JSON.stringify(polygons)}, area: ${Number(h.area.toPrecision(5))}, centroid: ${JSON.stringify(h.centroid.map(round4))} },`;
  });
  const base = groupOf(owner?.subregion);
  const group = base === 'foot' && /-a\d{3}[ud]\d{3}-context$/.test(imageId) ? 'footTilt' : base;
  byGroup.get(group)!.push(`  '${imageId}': [\n${lines.join('\n')}\n  ],`);
}
console.log(`${keptFine} image(s) keep detailed neighbour outlines (coarse ones overlapped)`);
for (const [group, entries] of byGroup) {
  writeFileSync(hotspotPartPath(group), `${HEADER}
import type { HotspotPolygon } from '../../types/image';

export const LIGAMENT_HOTSPOTS_PART: Record<string, HotspotPolygon[]> = {
${entries.join('\n')}
};
`);
}
writeFileSync(OUT_HOTSPOTS, `/**
 * GENERATED FILE — do not edit by hand. Every ligament hotspot, for SCRIPTS.
 * The app never imports this: seed/hotspots.ts loads each group as its own
 * chunk, because together they are past the 2 MiB precache limit.
 */
import type { HotspotPolygon } from '../../types/image';
${Object.keys(HOTSPOT_GROUPS).map((g) => `import { LIGAMENT_HOTSPOTS_PART as ${g} } from './hotspots.ligaments.${g}.generated';`).join('\n')}

export const LIGAMENT_HOTSPOTS: Record<string, HotspotPolygon[]> = { ${Object.keys(HOTSPOT_GROUPS).map((g) => '...' + g).join(', ')} };
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
const wanted = new Set(rows.flatMap((r) => [
  `${r.structureId}-${markerOf(r)}-${r.kind}.webp`,
  ...(r.variant ? [`${r.structureId}-${markerOf(r)}-${r.kind}.${r.variant.kind}.webp`] : []),
]));
const stale = readdirSync(OUT_DIR).filter((name) => name.endsWith('.webp') && !wanted.has(name));
for (const name of stale) unlinkSync(join(OUT_DIR, name));
console.log(`${stale.length} stale image(s) removed from public/anatomy/ligaments`);
for (const name of stale) console.log(`  ${name}`);
if (variantReport.length) {
  console.log('Second renders (variants):');
  for (const line of variantReport) console.log(`  ${line}`);
}
if (areaReport.length) {
  console.log('Target size per ligament published from this run:');
  for (const line of areaReport) console.log(line);
}
