import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';
import { viewForAngle } from './lib/viewForAngle';

/**
 * Turns a set of plates and masks into shipped images and hotspots.
 *
 *   npx tsx src/scripts/platesToHotspots.ts --family bone --masks renders/bones
 *   npx tsx src/scripts/platesToHotspots.ts --family deep --masks renders/deep
 *
 * Two families, one shape. BONE plates are the skeleton by region: bones were
 * the only category already eligible for locate questions with no hotspot
 * anywhere to answer one, because every hotspot the app had described a muscle.
 * DEEP plates are the layer underneath the region plates: 48 muscles that sit
 * behind something on the muscle plates and so never survived into a hotspot.
 *
 * Both publish one plate per region per view, trace each subject's silhouette
 * from masks rendered with everything else held out, and write the two
 * generated modules images.seed.ts reads.
 *
 * It deliberately imports nothing from the seed. Its own output is imported BY
 * the seed, and a script that reads the seed to write a module the seed needs
 * cannot run the first time — the joint publisher hit exactly that and needed a
 * placeholder file to break the cycle. Region and subregion come from the
 * mapping and the table below instead.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
interface Family {
  dir: string;
  prefix: string;
  hotspotsFile: string;
  platesFile: string;
  hotspotsExport: string;
  platesExport: string;
  plateType: string;
  titleSuffix: string;
  subjectWord: string;
  renderer: string;
}

const FAMILIES: Record<string, Family> = {
  bone: {
    dir: 'bones', prefix: 'bone',
    hotspotsFile: 'hotspots.bones.generated.ts', platesFile: 'bonePlates.generated.ts',
    hotspotsExport: 'BONE_HOTSPOTS', platesExport: 'BONE_PLATES', plateType: 'BonePlate',
    titleSuffix: 'Skeleton', subjectWord: 'bone', renderer: 'renderBonePlates.py',
  },
  sub: {
    dir: 'subregions', prefix: 'sub',
    hotspotsFile: 'hotspots.subregions.generated.ts', platesFile: 'subRegionPlates.generated.ts',
    hotspotsExport: 'SUBREGION_HOTSPOTS', platesExport: 'SUBREGION_PLATES', plateType: 'SubRegionPlate',
    titleSuffix: 'Close', subjectWord: 'structure', renderer: 'renderSubRegionPlates.py',
  },
  deep: {
    dir: 'deep', prefix: 'deep',
    hotspotsFile: 'hotspots.deep.generated.ts', platesFile: 'deepPlates.generated.ts',
    hotspotsExport: 'DEEP_HOTSPOTS', platesExport: 'DEEP_PLATES', plateType: 'DeepPlate',
    titleSuffix: 'Deep Layer', subjectWord: 'muscle', renderer: 'renderDeepPlates.py',
  },
};

/**
 * A name for each angle of a turntable, at 30 degrees.
 *
 * Nothing filters on view — it is a label and a slide title — so the eight
 * angles between the cardinals take the name of the nearest named direction
 * rather than inventing four more. The angle itself is kept on the row, and the
 * viewer shows degrees beside the name, which is what "turn it a bit further"
 * actually needs.
 *
 * THE NAME COMES FROM lib/viewForAngle.ts. This table used to say 90 was
 * lateral, arguing that a region plate turns the other way from a ligament
 * plate. It does not: every renderer uses the same camera and frames a limb on
 * its left copy, so 90 looks at it from the inside. The leg plate at 270 shows
 * the fibula and lateral malleolus face-on, and was labelled medial.
 *
 * The axial regions are midline plates: turned 90 degrees either way, the
 * camera is at the body's side, so neither view is medial.
 */
const isAxial = (dirName: string) => dirName.startsWith('back-core');

const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
  // Looking up from below. The sole of a foot is not reachable by spinning:
  // the plantar muscles are under the foot bones from every angle on the
  // vertical axis, so the foot plate is also rendered from underneath.
  // 'plantar' is the anatomical name for that view and the app already has it.
  'view-00-e-45': 'plantar',
};

/** Area derives from subregion for every structure, so a plate needs one. */
const SUBREGION: Record<string, string> = {
  'shoulder-arm': 'shoulder',
  'back-core': 'spine',
  'hip-thigh': 'hip',
  'lower-leg-foot': 'ankle-foot',
  'forearm-hand': 'wrist-hand',
};

const REGION_TITLE: Record<string, string> = {
  'shoulder-arm': 'Shoulder and Arm',
  'back-core': 'Back and Core',
  'hip-thigh': 'Hip and Thigh',
  'lower-leg-foot': 'Lower Leg and Foot',
  'forearm-hand': 'Forearm and Hand',
};

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const familyName = args.family ?? 'bone';
const family = FAMILIES[familyName];
if (!family) {
  console.error(`Unknown --family ${familyName}. Use one of: ${Object.keys(FAMILIES).join(', ')}`);
  process.exit(1);
}
const OUT_DIR = `${ROOT}/public/anatomy/${family.dir}`;
const OUT_HOTSPOTS = `${ROOT}/src/features/anatomy-revision/data/seed/${family.hotspotsFile}`;
const OUT_PLATES = `${ROOT}/src/features/anatomy-revision/data/seed/${family.platesFile}`;
const masksRoot = join(ROOT, args.masks ?? `renders/${family.dir}`);
const quality = Number(args.quality ?? '82');
/** A bone showing less than this of the frame is a sliver behind another bone. */
const minPx = Number(args['min-px'] ?? '2500');
const maxVertices = Number(args['max-vertices'] ?? '150');
/**
 * How much of a subject may sit inside another subject's holes before that
 * other subject stops being a fair target on this view.
 *
 * maskToPolygons traces OUTER BOUNDARIES ONLY and says why: the app resolves a
 * multi-part structure by OR-ing its rings, with no even-odd rule, so an emitted
 * hole would add its area instead of subtracting it. The cost is that a subject
 * drawn INSIDE another one's silhouette is inside its polygon too. On the
 * forefoot seen from the side, the plantar interossei are four slots cut through
 * the middle of the metatarsals, and the metatarsal ring closes over all four:
 * 8% of that plate answered to two structures at once, and "tap the metatarsals"
 * scored a tap on a muscle as correct.
 *
 * So the plate keeps the small structure and drops the large one FROM THAT VIEW.
 * It is the large one that is wrong — its silhouette is claiming ground it does
 * not cover — and it is the large one that has other views to be asked from.
 * Half is deliberately far above the incidental case: two rings simplified
 * independently kiss along a shared border by a percent or so, and that is not
 * this.
 */
const maxHoleShare = Number(args['max-hole-share'] ?? '0.5');
/**
 * The same fault measured the other way: how much of the PICTURE a subject's
 * outline wrongly claims, as a share of everything claimed on that view.
 *
 * Containment is not the only shape this takes. On the forefoot seen from the
 * side the metatarsals closed over all four plantar interossei, which the share
 * test above catches; turned to 120 degrees they close over part of each, which
 * it does not, and 2.15% of that frame still answered to two structures at once.
 * generateSet.test.ts asserts the invariant at 1% per image, so this sits below
 * it with room.
 *
 * Dropping a subject from a view is cheap in a way it was not before: a
 * turntable has twelve of them, and the structure keeps the other eleven.
 */
const maxClaimShare = Number(args['max-claim-share'] ?? '0.005');

if (!existsSync(masksRoot)) {
  console.error(`No renders at ${masksRoot} — run ${family.renderer} first.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

/**
 * The enclosed background of a mask: every pixel the subject does not cover
 * that cannot reach the border without crossing it. That is exactly the area a
 * traced outer ring closes over and the polygons therefore claim.
 *
 * A flood fill inward from the frame edge, four-connected, which matches how
 * the tracer walks a boundary.
 */
function holesOf(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (mask[i] === 0 && outside[i] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x + 1 < width) push(i + 1);
    if (y > 0) push(i - width);
    if (y + 1 < height) push(i + width);
  }
  const holes = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) if (mask[i] === 0 && outside[i] === 0) holes[i] = 1;
  return holes;
}

interface Hotspot {
  structureId: string;
  polygons: number[][][];
  area: number;
  centroid: [number, number];
}
const hotspots: Record<string, Hotspot[]> = {};
/** `slug` is the file's own key, and must match the image id: a sub-region
 *  plate is filed under its subregion, every other family under its region. */
interface Plate { slug: string; region: string; subregion: string; view: string; angle?: number; title: string; width: number; height: number }
const plates: Plate[] = [];
const dropped: string[] = [];

for (const dirName of readdirSync(masksRoot).sort()) {
  // Sub-region plates are named "<region>__<subregion>" because one region has
  // several; the other families are one plate per region and carry no suffix.
  //
  // A THIRD SEGMENT SPLITS ONE SUBREGION ACROSS TWO PLATES at different scales.
  // The subregion taxonomy groups a structure by the joint it acts on, so every
  // forearm muscle is filed under "wrist-hand" — right for revision, wrong for
  // framing, because a plate's camera is set by the largest subject on it and
  // extensor digitorum would turn the hand plate back into a forearm plate. The
  // slug is then the third segment and the subregion stays what the structures
  // say it is, so filtering and area labels are untouched.
  const [region, subOverride, slugOverride] = dirName.split('__') as [string, string | undefined, string | undefined];
  const regionDir = join(masksRoot, dirName);
  const masksDir = join(regionDir, 'masks');
  if (!existsSync(masksDir)) continue;

  // A turntable leaf is "aNNN"; a single named view is "view-NN" as before. The
  // rotation set is the level angles, because turning about the vertical axis
  // never shows a sole — a plantar view is a different look, not another frame
  // of the same one, and stays the single picture it has always been.
  const turntable = readdirSync(regionDir)
    .filter((n) => /^a\d{3}\.png$/.test(n))
    .map((n) => [n.slice(0, 4), viewForAngle(Number(n.slice(1, 4)), isAxial(dirName)) as string, Number(n.slice(1, 4))] as const)
    .filter(([, view]) => view)
    .sort((x, y) => x[2] - y[2]);
  const leaves: (readonly [string, string, number | undefined])[] = [
    ...turntable,
    ...Object.entries(VIEW_NAMES).map(([dir, view]) => [dir, view, undefined] as const),
  ];

  for (const [viewDir, view, angle] of leaves) {
    const platePath = join(regionDir, `${viewDir}.png`);
    if (!existsSync(platePath)) continue;

    const leafSlug = slugOverride ?? subOverride ?? region;
    // Two angles share a view name, so the id has to be the angle. "-aNNN-" is
    // also what the app's rotation code looks for: lib/questionGenerators/locate.ts
    // groups frames by it, and HotspotImage draws the turn controls when it finds
    // more than one. Nothing else needs changing to make a plate turnable.
    const imageId = angle === undefined
      ? `${family.prefix}-${leafSlug}-${view}`
      : `${family.prefix}-${leafSlug}-a${String(angle).padStart(3, '0')}-plate`;
    const found: Hotspot[] = [];

    // Every mask first, because whether one subject is a fair target depends on
    // where the others on this view are.
    const masks: { subjectId: string; mask: Uint8Array; on: number; width: number; height: number }[] = [];
    for (const subjectId of readdirSync(masksDir).sort()) {
      const maskPath = join(masksDir, subjectId, `${viewDir}.png`);
      if (!existsSync(maskPath)) continue;

      const png = decodePng(maskPath);
      const mask = binariseAlpha(png.data, png.width, png.height);
      let on = 0;
      for (let i = 0; i < mask.length; i++) on += mask[i];
      if (on < minPx) {
        dropped.push(`${region} ${view} ${subjectId}: ${on}px visible`);
        continue;
      }
      masks.push({ subjectId, mask, on, width: png.width, height: png.height });
    }

    // A subject whose holes are where another subject lives. Two ways to be too
    // much: swallowing most of one structure, or wrongly claiming enough of the
    // whole picture to matter. See maxHoleShare and maxClaimShare.
    const claimed = new Uint8Array(masks[0]?.mask.length ?? 0);
    for (const m of masks) for (let i = 0; i < m.mask.length; i++) if (m.mask[i]) claimed[i] = 1;
    let claimedPx = 0;
    for (let i = 0; i < claimed.length; i++) claimedPx += claimed[i];

    const swallows = new Set<string>();
    for (const outer of masks) {
      const holes = holesOf(outer.mask, outer.width, outer.height);
      let worst: { id: string; share: number } | null = null;
      let stolen = 0;
      for (const inner of masks) {
        if (inner.subjectId === outer.subjectId || inner.on > outer.on) continue;
        let inside = 0;
        for (let i = 0; i < inner.mask.length; i++) if (inner.mask[i] === 1 && holes[i] === 1) inside++;
        stolen += inside;
        const share = inside / inner.on;
        if (!worst || share > worst.share) worst = { id: inner.subjectId, share };
      }
      const claimShare = claimedPx ? stolen / claimedPx : 0;
      if ((worst && worst.share >= maxHoleShare) || claimShare >= maxClaimShare) {
        swallows.add(outer.subjectId);
        dropped.push(
          `${region} ${view} ${outer.subjectId}: closes over ${(worst!.share * 100).toFixed(0)}% of ` +
          `${worst!.id}, ${(claimShare * 100).toFixed(2)}% of the picture`,
        );
      }
    }

    for (const { subjectId, mask, width, height } of masks) {
      if (swallows.has(subjectId)) continue;
      const traced = maskToPolygons(mask, width, height, { maxVertices });
      found.push({
        structureId: subjectId,
        polygons: traced.polygons,
        area: traced.area,
        centroid: traced.centroid,
      });
    }

    if (found.length === 0) continue;

    // Flattened onto white for the same reason the joint images are: the bone
    // is nearly white itself, and a transparent plate would composite against
    // whatever card colour sits behind it.
    const slug = leafSlug;
    const dest = join(OUT_DIR, angle === undefined
      ? `${slug}-${view}.webp`
      : `${slug}-a${String(angle).padStart(3, '0')}.webp`);
    const info = await sharp(platePath).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);

    hotspots[imageId] = found;
    plates.push({
      slug,
      region,
      subregion: subOverride ?? SUBREGION[region] ?? 'shoulder',
      view,
      ...(angle === undefined ? {} : { angle }),
      title: REGION_TITLE[region] ?? region,
      width: info.width,
      height: info.height,
    });
    console.log(`${imageId.padEnd(34)} ${found.length} ${family.subjectWord}(s)`);
  }
}

const hotspotLines = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * Regenerate with:',
  ' *   blender atlas/Z-Anatomy/Startup.blend --background \\',
  ` *     --python src/scripts/blender/${family.renderer} -- \\`,
  ` *     --out renders/${family.dir}`,
  ` *   npx tsx src/scripts/platesToHotspots.ts --family ${familyName}`,
  ' *',
  ` * Each polygon is a ${family.subjectWord}'s visible silhouette on its plate,`,
  ' * traced from a mask rendered with everything else held out — so anything',
  ' * behind something claims only the pixels a student can actually see.',
  ' */',
  "import type { HotspotPolygon } from '../../types/image';",
  '',
  `export const ${family.hotspotsExport}: Record<string, HotspotPolygon[]> = {`,
];
for (const id of Object.keys(hotspots).sort()) {
  hotspotLines.push(`  '${id}': [`);
  for (const h of hotspots[id]) {
    hotspotLines.push('    {');
    hotspotLines.push(`      structureId: '${h.structureId}',`);
    hotspotLines.push(`      polygons: ${JSON.stringify(h.polygons)},`);
    hotspotLines.push(`      area: ${h.area},`);
    hotspotLines.push(`      centroid: [${h.centroid[0]}, ${h.centroid[1]}],`);
    hotspotLines.push('    },');
  }
  hotspotLines.push('  ],');
}
hotspotLines.push('};', '');
writeFileSync(OUT_HOTSPOTS, hotspotLines.join('\n'));

const plateBody = plates
  .map(
    (p) =>
      `  { slug: '${p.slug}', region: '${p.region}', subregion: '${p.subregion}', view: '${p.view}', ` +
      (p.angle === undefined ? '' : `angle: ${p.angle}, `) +
      `title: ${JSON.stringify(p.title)}, width: ${p.width}, height: ${p.height} },`,
  )
  .join('\n');

writeFileSync(
  OUT_PLATES,
  `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/platesToHotspots.ts --family ${familyName}
 *
 * One row per file in public/anatomy/${family.dir}/. Dimensions are measured from the
 * images, because they become the aspect-ratio of the box a student clicks in
 * and a box that does not match the image normalises every click wrongly.
 */
export interface ${family.plateType} {
  slug: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  /**
   * Camera angle around the vertical axis, degrees, 0 anterior — present only on
   * a rotation set. Two angles share a view name, so this is what tells them
   * apart and what builds the image id the app groups frames by.
   */
  angle?: number;
  title: string;
  width: number;
  height: number;
}

export const ${family.platesExport}: ${family.plateType}[] = [
${plateBody}
];
`,
);

const total = Object.values(hotspots).reduce((n, h) => n + h.length, 0);
console.log(`\n${plates.length} plate(s), ${total} hotspot(s) -> public/anatomy/${family.dir}/`);
if (dropped.length > 0) {
  console.log(`\n${dropped.length} dropped as too hidden to click:`);
  for (const d of dropped) console.log(`  ${d}`);
}
