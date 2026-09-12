import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { decodePng } from './lib/png';
import { binariseAlpha, maskToPolygons } from './lib/maskToPolygons';

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
  deep: {
    dir: 'deep', prefix: 'deep',
    hotspotsFile: 'hotspots.deep.generated.ts', platesFile: 'deepPlates.generated.ts',
    hotspotsExport: 'DEEP_HOTSPOTS', platesExport: 'DEEP_PLATES', plateType: 'DeepPlate',
    titleSuffix: 'Deep Layer', subjectWord: 'muscle', renderer: 'renderDeepPlates.py',
  },
};

const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
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

if (!existsSync(masksRoot)) {
  console.error(`No renders at ${masksRoot} — run ${family.renderer} first.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

interface Hotspot {
  structureId: string;
  polygons: number[][][];
  area: number;
  centroid: [number, number];
}
const hotspots: Record<string, Hotspot[]> = {};
interface Plate { region: string; subregion: string; view: string; title: string; width: number; height: number }
const plates: Plate[] = [];
const dropped: string[] = [];

for (const region of readdirSync(masksRoot).sort()) {
  const regionDir = join(masksRoot, region);
  const masksDir = join(regionDir, 'masks');
  if (!existsSync(masksDir)) continue;

  for (const [viewDir, view] of Object.entries(VIEW_NAMES)) {
    const platePath = join(regionDir, `${viewDir}.png`);
    if (!existsSync(platePath)) continue;

    const imageId = `${family.prefix}-${region}-${view}`;
    const found: Hotspot[] = [];

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

      const traced = maskToPolygons(mask, png.width, png.height, { maxVertices });
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
    const dest = join(OUT_DIR, `${region}-${view}.webp`);
    const info = await sharp(platePath).flatten({ background: '#ffffff' }).webp({ quality }).toFile(dest);

    hotspots[imageId] = found;
    plates.push({
      region,
      subregion: SUBREGION[region] ?? 'shoulder',
      view,
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
      `  { region: '${p.region}', subregion: '${p.subregion}', view: '${p.view}', ` +
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
  region: Region;
  subregion: SubRegion;
  view: ViewType;
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
console.log(`\n${plates.length} plate(s), ${total} hotspot(s) -> public/anatomy/bones/`);
if (dropped.length > 0) {
  console.log(`\n${dropped.length} dropped as too hidden to click:`);
  for (const d of dropped) console.log(`  ${d}`);
}
