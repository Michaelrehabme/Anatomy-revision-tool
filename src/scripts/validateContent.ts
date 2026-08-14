/**
 * Referential-integrity check over the seed content. Run via `npm run
 * validate-content` (see package.json), or wire into a pre-commit hook /
 * CI step once this becomes a real git repo.
 *
 * This is warn-only for soft references (parentBoneId, image hotspot
 * structureId cross-refs) since content can legitimately be mid-authoring,
 * but exits non-zero on hard errors (duplicate ids) since those indicate a
 * real bug, not just incomplete content.
 */
import { ALL_STRUCTURES, ALL_IMAGES } from '../features/anatomy-revision/data/seed';

let errors = 0;
let warnings = 0;

function fail(message: string): void {
  console.error(`ERROR: ${message}`);
  errors += 1;
}

function warn(message: string): void {
  console.warn(`WARN:  ${message}`);
  warnings += 1;
}

function main(): void {
  const structureIds = new Set<string>();
  for (const s of ALL_STRUCTURES) {
    if (structureIds.has(s.id)) fail(`Duplicate structure id "${s.id}"`);
    structureIds.add(s.id);
  }

  const imageIds = new Set<string>();
  for (const img of ALL_IMAGES) {
    if (imageIds.has(img.id)) fail(`Duplicate image id "${img.id}"`);
    imageIds.add(img.id);
  }

  for (const s of ALL_STRUCTURES) {
    for (const imageId of s.imageIds) {
      if (!imageIds.has(imageId)) {
        warn(`Structure "${s.id}" references unknown image id "${imageId}"`);
      }
    }
    if (s.category === 'landmark' && s.parentBoneId && !structureIds.has(s.parentBoneId)) {
      warn(`Landmark "${s.id}" has parentBoneId "${s.parentBoneId}" which does not resolve to a bone`);
    }
    if (s.needsReview) {
      warn(`Structure "${s.id}" is flagged needsReview — verify before publishing`);
    }
  }

  for (const img of ALL_IMAGES) {
    if (img.mode === 'single-structure') {
      if (!img.structureId) {
        fail(`Image "${img.id}" has mode "single-structure" but no structureId`);
      } else if (!structureIds.has(img.structureId)) {
        warn(`Image "${img.id}" references unknown structureId "${img.structureId}"`);
      }
    }
    for (const hotspot of img.hotspots ?? []) {
      if (!structureIds.has(hotspot.structureId)) {
        warn(`Image "${img.id}" has a hotspot for unknown structureId "${hotspot.structureId}"`);
      }
    }
    if (img.licence.toLowerCase().includes('todo')) {
      warn(`Image "${img.id}" has an unconfirmed licence — see README "Licensing" section`);
    }
  }

  console.log(
    `\nChecked ${ALL_STRUCTURES.length} structures and ${ALL_IMAGES.length} images: ${errors} error(s), ${warnings} warning(s).`,
  );

  if (errors > 0) process.exit(1);
}

main();
