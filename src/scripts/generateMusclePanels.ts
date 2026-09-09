import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ALL_STRUCTURES } from '../features/anatomy-revision/data/seed/index';

/**
 * Regenerates the muscle-panel image list from the files in
 * public/anatomy/panels/.
 *
 *   npx tsx src/scripts/generateMusclePanels.ts
 *
 * WHY GENERATED. The list was 21 hand-typed tuples, and adding CR-026's 44
 * new panels by hand would have meant 65 — every one a chance for the seed to
 * claim an image that is not there, or to miss one that is. The region and
 * subregion are already on the structure, so the only thing a human needs to
 * decide is the layer.
 *
 * IT ALSO FIXES A REAL BUG. Every panel entry carried `width: 255, height:
 * 259`, left over from the retired AI crops the Z-Anatomy renders replaced.
 * Those two numbers become the CSS aspect-ratio of the figure the student
 * looks at, so all 21 panels have been reserving a near-square box for an
 * image that is roughly 3:2 — visible as a band of empty space above and
 * below every panel. Measured from the file, they cannot be wrong again.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PANELS = `${ROOT}/public/anatomy/panels`;
const OUT = `${ROOT}/src/features/anatomy-revision/data/seed/panels.generated.ts`;

/**
 * Layer is an editorial call, not something the model knows: it is what a
 * student would be told about where the muscle sits relative to the ones
 * around it. Only the exceptions are listed — everything not named here is a
 * deep muscle, which is true of the whole CR-026 batch (the intrinsics of the
 * hand and foot, the deep spinal series, the deep hip rotators) and is the
 * safer default: calling a deep muscle superficial is the more misleading
 * error of the two.
 */
const SUPERFICIAL = new Set([
  'deltoid',
  'trapezius',
  'latissimus-dorsi',
  'biceps-brachii',
  'triceps-brachii',
  'brachioradialis',
  'gluteus-maximus',
  'tensor-fasciae-latae',
  'semitendinosus',
  'biceps-femoris',
  'tibialis-anterior',
  'gastrocnemius',
]);

async function main(): Promise<void> {
  const files = readdirSync(PANELS)
    .filter((f) => f.endsWith('.webp'))
    .sort();

  const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s] as const));
  const rows: string[] = [];
  const orphans: string[] = [];

  for (const file of files) {
    const structureId = file.replace(/\.webp$/, '');
    const structure = byId.get(structureId);
    if (!structure) {
      orphans.push(structureId);
      continue;
    }

    const meta = await sharp(`${PANELS}/${file}`).metadata();
    if (!meta.width || !meta.height) throw new Error(`${file}: no dimensions`);

    // A bone is not a deep muscle. Since CR-026 the same panel pipeline
    // produces bone, landmark and joint images too, and layer is what the
    // filters key off — mislabelling them would put the femur in a list of
    // deep muscles.
    const layer =
      structure.category === 'muscle'
        ? SUPERFICIAL.has(structureId)
          ? 'superficial-muscle'
          : 'deep-muscle'
        : structure.category === 'landmark'
          ? 'landmark'
          : 'skeletal';
    rows.push(
      `  { structureId: '${structureId}', region: '${structure.region}', subregion: '${structure.subregion}',` +
        ` layer: '${layer}', width: ${meta.width}, height: ${meta.height} },`,
    );
  }

  if (orphans.length > 0) {
    // A panel with no structure would be a file nobody can ever see, and
    // usually means a render was named after an alias rather than an id.
    throw new Error(`Panels with no matching structure: ${orphans.join(', ')}`);
  }

  writeFileSync(
    OUT,
    `import type { LayerType } from '../../types/image';\n` +
      `import type { Region, SubRegion } from '../../types/region';\n\n` +
      `/**\n` +
      ` * GENERATED — do not edit by hand.\n` +
      ` * Regenerate with: npx tsx src/scripts/generateMusclePanels.ts\n` +
      ` *\n` +
      ` * One row per file in public/anatomy/panels/. Dimensions are measured from\n` +
      ` * the images themselves, so the aspect ratio the app reserves always matches\n` +
      ` * what it is about to load. See that script for why layer is the only field\n` +
      ` * a human still chooses.\n` +
      ` */\n` +
      `export interface MusclePanel {\n` +
      `  structureId: string;\n` +
      `  region: Region;\n` +
      `  subregion: SubRegion;\n` +
      `  layer: LayerType;\n` +
      `  width: number;\n` +
      `  height: number;\n` +
      `}\n\n` +
      `export const MUSCLE_PANELS: MusclePanel[] = [\n${rows.join('\n')}\n];\n`,
  );

  const superficial = rows.filter((r) => r.includes("'superficial-muscle'")).length;
  console.log(`Wrote ${rows.length} panels to ${OUT}`);
  console.log(`  ${superficial} superficial, ${rows.length - superficial} deep`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
