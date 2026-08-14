/**
 * Ingests hotspots.json produced by the Blender/masks_to_svg.py pipeline
 * (Downloads/README.md step 4 — not yet run as of this writing, see project
 * README "Scaling the image library"). Content stays as typed TS seed
 * modules (see data/seed/images.seed.ts's own comment on why), so this
 * script does NOT rewrite source files automatically — it validates the
 * input, cross-references it against existing seed structures/images, and
 * prints ready-to-paste TS snippets plus a mismatch report for you to
 * action by hand.
 *
 * Usage: npx tsx src/scripts/importHotspots.ts path/to/hotspots.json
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ALL_STRUCTURES, ALL_IMAGES } from '../features/anatomy-revision/data/seed';

const hotspotEntrySchema = z.object({
  polygons: z.array(z.array(z.tuple([z.number(), z.number()]))),
  area: z.number(),
  centroid: z.tuple([z.number(), z.number()]),
  points: z.number().optional(),
  size: z.tuple([z.number(), z.number()]).optional(),
});

const hotspotsFileSchema = z.object({
  schemaVersion: z.number(),
  normalised: z.boolean(),
  hotspots: z.record(z.string(), z.record(z.string(), hotspotEntrySchema)),
});

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: npx tsx src/scripts/importHotspots.ts path/to/hotspots.json');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const parsed = hotspotsFileSchema.parse(raw); // throws with a detailed message on shape mismatch

  const structureIds = new Set(ALL_STRUCTURES.map((s) => s.id));
  const unmatchedMuscles: string[] = [];
  const unmatchedImages: string[] = [];
  let printedCount = 0;

  for (const [region, muscles] of Object.entries(parsed.hotspots)) {
    for (const [muscleId, entry] of Object.entries(muscles)) {
      if (!structureIds.has(muscleId)) {
        unmatchedMuscles.push(`${region}/${muscleId} (no AnatomyStructure with this id — add it to structures.muscles.seed.ts first)`);
        continue;
      }

      const image = ALL_IMAGES.find((img) => img.mode === 'single-structure' && img.structureId === muscleId);
      if (!image) {
        unmatchedImages.push(`${muscleId} (no single-structure AnatomyImageAsset yet — add one to images.seed.ts first)`);
        continue;
      }

      printedCount += 1;
      console.log(`\n// Paste into images.seed.ts, entry "${image.id}":`);
      console.log(`// hotspots: [{`);
      console.log(`//   structureId: '${muscleId}',`);
      console.log(`//   polygons: ${JSON.stringify(entry.polygons)},`);
      console.log(`//   area: ${entry.area},`);
      console.log(`//   centroid: [${entry.centroid[0]}, ${entry.centroid[1]}],`);
      console.log(`// }],`);
      if (entry.size) {
        console.log(
          `// Also set width: ${entry.size[0]}, height: ${entry.size[1]} on "${image.id}" if not already set`,
          '(this is the MASK image size — confirm it matches your actual exported render before trusting it).',
        );
      }
    }
  }

  console.log(`\n${printedCount} hotspot(s) matched to existing structures + images.`);
  if (unmatchedMuscles.length) {
    console.log(`\n${unmatchedMuscles.length} muscle id(s) in hotspots.json with no matching AnatomyStructure:`);
    unmatchedMuscles.forEach((m) => console.log(`  - ${m}`));
  }
  if (unmatchedImages.length) {
    console.log(`\n${unmatchedImages.length} muscle(s) with a matching AnatomyStructure but no AnatomyImageAsset yet:`);
    unmatchedImages.forEach((m) => console.log(`  - ${m}`));
  }
}

main();
