import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';
import { isJoint } from '../features/anatomy-revision/types/structure';

/**
 * Publishes the joint locate images: one webp per joint per view, plus the
 * generated list images.seed.ts builds its joint image assets from.
 *
 *   npx tsx src/scripts/publishJointPanels.ts --masks renders/joint-lines
 *
 * WHY THESE ARE THEIR OWN FAMILY. A locate question needs an image whose
 * coordinate space a polygon can live in, which rules out the composited
 * three-view strips in public/anatomy/panels/ — a point in a strip is in no
 * single camera's frame. The region hotspots already solved this by shipping
 * one file per view; joints follow the same shape.
 *
 * WHY THEY ARE NOT HIGHLIGHTED. The muscle panels carry `hotspots: []` on
 * purpose: they pre-highlight their own structure, so a locate question on one
 * would show the student the answer. These render the skeleton plainly, framed
 * on the joint, and let the traced band be the only thing that knows where the
 * joint is.
 *
 * The source is the `context.png` renderJointMasks.py already writes beside
 * each mask — pixel-aligned to it by construction, which is what keeps the
 * picture and the hotspot in agreement.
 *
 * ONLY VIEWS THAT CARRY A BAND ARE PUBLISHED. A view whose joint line is hidden
 * behind other bone produces no hotspot, and an image with no hotspot is an
 * image a student can be shown but never asked about. Tying the two together
 * here means every file in public/anatomy/joints/ is clickable, and the count
 * of images is the count of locate questions.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT_DIR = `${ROOT}/public/anatomy/joints`;
const OUT_TS = `${ROOT}/src/features/anatomy-revision/data/seed/jointPanels.generated.ts`;

const VIEW_NAMES: Record<string, string> = {
  'view-00': 'anterior',
  'view-06': 'lateral',
  'view-12': 'posterior',
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
const masksRoot = join(ROOT, args.masks ?? 'renders/joint-lines');
const quality = Number(args.quality ?? '82');
const hotspotsPath = join(ROOT, args.hotspots ?? 'joint-lines.hotspots.v2.json');

if (!existsSync(masksRoot)) {
  console.error(`No renders at ${masksRoot} — run renderJointMasks.py first.`);
  process.exit(1);
}

const jointById = new Map(ALL_STRUCTURES.filter(isJoint).map((j) => [j.id, j]));

if (!existsSync(hotspotsPath)) {
  console.error(`No hotspots at ${hotspotsPath} — run jointLineHotspots.ts --v2 first.`);
  process.exit(1);
}
const withBands = new Set(
  Object.keys(JSON.parse(readFileSync(hotspotsPath, 'utf8')).images as Record<string, unknown>),
);

mkdirSync(OUT_DIR, { recursive: true });

interface Row {
  structureId: string;
  name: string;
  region: string;
  subregion: string;
  view: string;
  width: number;
  height: number;
}

const rows: Row[] = [];
const skipped: string[] = [];

for (const jointId of readdirSync(masksRoot).sort()) {
  const joint = jointById.get(jointId);
  if (!joint) {
    skipped.push(`${jointId}: no such joint in the seed`);
    continue;
  }

  // subregion is what Area derives from for every structure in the dataset, so
  // an image without one would sit outside the study axis entirely.
  if (!joint.subregion) {
    skipped.push(`${jointId}: no subregion, cannot place the image in an Area`);
    continue;
  }

  for (const [viewDir, viewName] of Object.entries(VIEW_NAMES)) {
    if (!withBands.has(`joint-${jointId}-${viewName}`)) {
      skipped.push(`${jointId} ${viewName}: joint line not visible from here`);
      continue;
    }

    const src = join(masksRoot, jointId, viewDir, 'context.png');
    if (!existsSync(src)) {
      skipped.push(`${jointId} ${viewName}: no context render`);
      continue;
    }

    const dest = join(OUT_DIR, `${jointId}-${viewName}.webp`);
    // Flattened onto the same near-white the region plates use. A transparent
    // PNG would composite against whatever card colour is behind it, and the
    // bone is nearly white, so on a light card the skeleton would vanish.
    const info = await sharp(src)
      .flatten({ background: '#ffffff' })
      .webp({ quality })
      .toFile(dest);

    // Name, region and subregion are baked in rather than looked up in the
    // seed at runtime: images.seed.ts is imported BY the seed index, so reaching
    // back into the structures from there is a cycle waiting to happen.
    rows.push({
      structureId: jointId,
      name: joint.name,
      region: joint.region,
      subregion: joint.subregion,
      view: viewName,
      width: info.width,
      height: info.height,
    });
  }
}

const body = rows
  .map(
    (r) =>
      `  { structureId: '${r.structureId}', name: ${JSON.stringify(r.name)}, ` +
      `region: '${r.region}', subregion: '${r.subregion}', view: '${r.view}', ` +
      `width: ${r.width}, height: ${r.height} },`,
  )
  .join('\n');

writeFileSync(
  OUT_TS,
  `import type { ViewType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';

/**
 * GENERATED — do not edit by hand.
 * Regenerate with: npx tsx src/scripts/publishJointPanels.ts
 *
 * One row per file in public/anatomy/joints/. Dimensions are measured from the
 * images themselves, for the same reason panels.generated.ts measures its own:
 * they become the CSS aspect-ratio of the box the student clicks in, and a box
 * that does not match the image 1:1 normalises every click to the wrong point.
 */
export interface JointPanel {
  structureId: string;
  name: string;
  region: Region;
  subregion: SubRegion;
  view: ViewType;
  width: number;
  height: number;
}

export const JOINT_PANELS: JointPanel[] = [
${body}
];
`,
);

console.log(`${rows.length} image(s) -> public/anatomy/joints/`);
console.log(`${rows.length} row(s) -> ${OUT_TS.replace(ROOT, '.')}`);
if (skipped.length > 0) {
  console.error(`\n${skipped.length} skipped:`);
  for (const s of skipped) console.error(`  ${s}`);
}
