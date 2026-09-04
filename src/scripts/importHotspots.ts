/**
 * Ingests a hotspots.json and cross-references it against the current seed
 * content. Content stays as typed TS seed modules (see images.seed.ts's own
 * comment on why), so this script does NOT rewrite source files — it
 * validates, reports mismatches, and prints TS for you to place.
 *
 * Two input shapes are accepted:
 *
 *   v1 — { schemaVersion, normalised, hotspots: { region: { structureId: entry } } }
 *        The original Blender/masks_to_svg.py output. Resolves each structure
 *        to its own single-structure image, so it can only ever target
 *        per-muscle panels.
 *
 *   v2 — { schemaVersion, normalised, images: { imageId: { width, height,
 *          panelStructureNames?, hotspots: { structureId: entry } } } }
 *        Produced by masksToHotspots.ts. Names the target image explicitly, so
 *        it works for atlas slides too — several structures on one image, which
 *        v1 had no way to express.
 *
 * Usage:
 *   npx tsx src/scripts/importHotspots.ts path/to/hotspots.json
 *   npx tsx src/scripts/importHotspots.ts path/to/hotspots.json --emit-ts > out.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ALL_STRUCTURES, ALL_IMAGES } from '../features/anatomy-revision/data/seed';

const hotspotEntrySchema = z.object({
  polygons: z.array(z.array(z.tuple([z.number(), z.number()]))),
  area: z.number(),
  centroid: z.tuple([z.number(), z.number()]),
  points: z.number().optional(),
  size: z.tuple([z.number(), z.number()]).optional(),
});

type HotspotEntry = z.infer<typeof hotspotEntrySchema>;

const imageEntrySchema = z.object({
  filePath: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  panelStructureNames: z.array(z.string()).optional(),
  hotspots: z.record(z.string(), hotspotEntrySchema),
});

const hotspotsFileSchema = z
  .object({
    schemaVersion: z.number(),
    // Un-normalised input has never been supported by the consumer, so reject
    // it here rather than silently emitting pixel coordinates as if they were 0-1.
    normalised: z.literal(true),
    images: z.record(z.string(), imageEntrySchema).optional(),
    hotspots: z.record(z.string(), z.record(z.string(), hotspotEntrySchema)).optional(),
  })
  .refine((file) => file.images || file.hotspots, {
    message: 'file must contain either "images" (v2) or "hotspots" (v1)',
  });

const warnings: string[] = [];

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  const path = positional[0];
  const emitTs = args.includes('--emit-ts');
  const outIndex = args.indexOf('--out');
  const outPath = outIndex === -1 ? null : args[outIndex + 1];

  if (!path) {
    console.error('Usage: npx tsx src/scripts/importHotspots.ts path/to/hotspots.json [--emit-ts] [--out FILE]');
    process.exit(1);
  }

  const parsed = hotspotsFileSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));

  const resolved = parsed.images
    ? resolveV2(parsed.images)
    : resolveV1(parsed.hotspots ?? {});

  if (emitTs) {
    const module = renderModule(resolved);
    if (outPath) {
      // Written after the seed data has already been read. Redirecting stdout
      // into the generated file instead would truncate it before this script
      // imports it, which breaks the seed module it is trying to regenerate.
      writeFileSync(outPath, module);
      console.error(`Wrote ${outPath}`);
    } else {
      process.stdout.write(module);
    }
  } else {
    report(resolved);
  }

  // Warnings go to stderr so --emit-ts output can be redirected cleanly.
  if (warnings.length > 0) {
    console.error(`\n${warnings.length} warning(s):`);
    warnings.forEach((w) => console.error(`  - ${w}`));
  }
}

interface ResolvedImage {
  imageId: string;
  width: number;
  height: number;
  panelStructureNames: string[];
  hotspots: { structureId: string; entry: HotspotEntry }[];
}

function resolveV2(images: Record<string, z.infer<typeof imageEntrySchema>>): ResolvedImage[] {
  const structureIds = new Set(ALL_STRUCTURES.map((s) => s.id));
  const out: ResolvedImage[] = [];

  for (const [imageId, image] of Object.entries(images)) {
    const existing = ALL_IMAGES.find((img) => img.id === imageId);
    if (!existing) {
      warnings.push(`image "${imageId}" is not in images.seed.ts yet — add the entry, then re-run`);
    } else if (
      (existing.width && existing.width !== image.width) ||
      (existing.height && existing.height !== image.height)
    ) {
      warnings.push(
        `image "${imageId}" is ${existing.width}x${existing.height} in the seed but ` +
          `${image.width}x${image.height} in this file — polygons would be offset`,
      );
    }

    const hotspots: ResolvedImage['hotspots'] = [];
    for (const [structureId, entry] of Object.entries(image.hotspots)) {
      if (!structureIds.has(structureId)) {
        warnings.push(`${imageId}/${structureId}: no AnatomyStructure with this id`);
        continue;
      }
      validateEntry(`${imageId}/${structureId}`, entry);
      hotspots.push({ structureId, entry });
    }

    out.push({
      imageId,
      width: image.width,
      height: image.height,
      panelStructureNames: image.panelStructureNames ?? hotspots.map((h) => h.structureId),
      hotspots,
    });
  }

  return out;
}

function resolveV1(regions: Record<string, Record<string, HotspotEntry>>): ResolvedImage[] {
  const structureIds = new Set(ALL_STRUCTURES.map((s) => s.id));
  const byImage = new Map<string, ResolvedImage>();

  for (const [region, structures] of Object.entries(regions)) {
    for (const [structureId, entry] of Object.entries(structures)) {
      if (!structureIds.has(structureId)) {
        warnings.push(`${region}/${structureId}: no AnatomyStructure with this id`);
        continue;
      }

      const image = ALL_IMAGES.find((img) => img.mode === 'single-structure' && img.structureId === structureId);
      if (!image) {
        warnings.push(`${structureId}: no single-structure image yet — add one to images.seed.ts first`);
        continue;
      }

      validateEntry(`${image.id}/${structureId}`, entry);

      const existing = byImage.get(image.id);
      if (existing) {
        existing.hotspots.push({ structureId, entry });
      } else {
        byImage.set(image.id, {
          imageId: image.id,
          width: entry.size?.[0] ?? image.width ?? 0,
          height: entry.size?.[1] ?? image.height ?? 0,
          panelStructureNames: [structureId],
          hotspots: [{ structureId, entry }],
        });
      }
    }
  }

  return [...byImage.values()];
}

function validateEntry(label: string, entry: HotspotEntry): void {
  if (entry.polygons.length === 0) warnings.push(`${label}: no polygons`);
  for (const ring of entry.polygons) {
    if (ring.length < 3) {
      warnings.push(`${label}: ring with only ${ring.length} point(s) cannot enclose an area`);
    }
    for (const [x, y] of ring) {
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        warnings.push(`${label}: coordinate (${x}, ${y}) is outside 0-1 — is this file normalised?`);
        return;
      }
    }
  }
  if (entry.area <= 0 || entry.area > 1) {
    warnings.push(`${label}: area ${entry.area} is outside 0-1`);
  }
}

function report(images: ResolvedImage[]): void {
  let total = 0;
  for (const image of images) {
    total += image.hotspots.length;
    console.log(`\n// images.seed.ts entry "${image.imageId}" — width: ${image.width}, height: ${image.height}`);
    for (const { structureId, entry } of image.hotspots) {
      console.log(`//   ${structureId}: ${entry.polygons.length} part(s), area ${entry.area.toFixed(5)}`);
    }
  }
  console.log(`\n${total} hotspot(s) across ${images.length} image(s) matched the current seed data.`);
  console.log('Re-run with --emit-ts to print the generated module.');
}

function renderModule(images: ResolvedImage[]): string {
  const sorted = [...images].sort((a, b) => a.imageId.localeCompare(b.imageId));
  const lines: string[] = [
    '/**',
    ' * GENERATED FILE — do not edit by hand.',
    ' *',
    ' * Regenerate with:',
    ' *   npx tsx src/scripts/masksToHotspots.ts --out hotspots.regions.json',
    ' *   npx tsx src/scripts/importHotspots.ts hotspots.regions.json --emit-ts \\',
    ' *     --out src/features/anatomy-revision/data/seed/hotspots.regions.generated.ts',
    ' *',
    ' * Polygons are depth-subtracted so they are mutually exclusive — see',
    ' * src/scripts/data/occlusionOrder.ts for why that matters.',
    ' */',
    "import type { HotspotPolygon } from '../../types/image';",
    '',
    'export const REGION_HOTSPOTS: Record<string, HotspotPolygon[]> = {',
  ];

  for (const image of sorted) {
    lines.push(`  '${image.imageId}': [`);
    for (const { structureId, entry } of image.hotspots) {
      lines.push('    {');
      lines.push(`      structureId: '${structureId}',`);
      lines.push(`      polygons: ${JSON.stringify(entry.polygons)},`);
      lines.push(`      area: ${entry.area},`);
      lines.push(`      centroid: [${entry.centroid[0]}, ${entry.centroid[1]}],`);
      lines.push('    },');
    }
    lines.push('  ],');
  }

  lines.push('};', '');
  lines.push('/** Drives automatic structure<->image linking in lib/linkImages.ts. */');
  lines.push('export const REGION_PANEL_NAMES: Record<string, string[]> = {');
  for (const image of sorted) {
    lines.push(`  '${image.imageId}': ${JSON.stringify(image.panelStructureNames)},`);
  }
  lines.push('};', '');

  return lines.join('\n');
}

main();
