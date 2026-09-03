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
import { isJoint, areaOf } from '../features/anatomy-revision/types/structure';
import { AREAS, AREA_LABELS } from '../features/anatomy-revision/types/region';

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
    if (isJoint(s)) {
      for (const articulatingId of s.articulatingStructureIds) {
        if (!structureIds.has(articulatingId)) {
          warn(`Joint "${s.id}" has articulatingStructureIds entry "${articulatingId}" which does not resolve to a structure`);
        }
      }
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
    // Hotspot coordinates are normalized against the image's own natural size,
    // so an image carrying hotspots without dimensions cannot be rendered with
    // a matching aspect-ratio box and every click lands off-target.
    if ((img.hotspots?.length ?? 0) > 0 && (!img.width || !img.height)) {
      warn(`Image "${img.id}" has hotspots but no width/height — clicks will not line up`);
    }
    for (const hotspot of img.hotspots ?? []) {
      if (!structureIds.has(hotspot.structureId)) {
        warn(`Image "${img.id}" has a hotspot for unknown structureId "${hotspot.structureId}"`);
      }
      if (hotspot.area <= 0 || hotspot.area > 1) {
        warn(`Image "${img.id}" hotspot "${hotspot.structureId}" has area ${hotspot.area} outside 0-1`);
      }
      const [cx, cy] = hotspot.centroid;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
        warn(`Image "${img.id}" hotspot "${hotspot.structureId}" has a centroid outside the image`);
      }
      for (const ring of hotspot.polygons) {
        if (ring.length < 3) {
          warn(`Image "${img.id}" hotspot "${hotspot.structureId}" has a ring with only ${ring.length} point(s)`);
        }
      }
    }
    if ((img.hotspots ?? []).length > 0 && (!img.width || !img.height)) {
      warn(
        `Image "${img.id}" has hotspot data but no width/height — HotspotImage.tsx can't lock the ` +
          'aspect ratio without them, so the rendered click area silently drifts from the coordinates ' +
          'the hotspots were authored against (found via a real misalignment bug — see CR register).',
      );
    }
    if (img.licence.toLowerCase().includes('todo')) {
      warn(`Image "${img.id}" has an unconfirmed licence — see README "Licensing" section`);
    }
  }

  // Area is the axis the whole app filters by (CR-017), so a structure with no area is
  // unreachable from the picker, and an empty area is a dead end in the UI: the user
  // selects it and gets a zero-question session.
  const joints = ALL_STRUCTURES.filter(isJoint);
  for (const s of ALL_STRUCTURES) {
    if (!areaOf(s)) {
      fail(
        `Structure "${s.id}" resolves to no area (needs a subregion, or an explicit area ` +
          'override) — it would be unreachable from the area picker',
      );
    }
  }
  for (const area of AREAS) {
    const inArea = ALL_STRUCTURES.filter((s) => areaOf(s) === area);
    if (inArea.length === 0) {
      fail(`Area "${AREA_LABELS[area]}" has no structures — it is offered in the area picker and would yield an empty session`);
    } else if (!inArea.some(isJoint)) {
      warn(`Area "${AREA_LABELS[area]}" has ${inArea.length} structures but no joints`);
    }
  }

  console.log(
    `\nStructures per area: ` +
      AREAS.map((a) => `${AREA_LABELS[a]} ${ALL_STRUCTURES.filter((s) => areaOf(s) === a).length}`).join(', '),
  );
  console.log(
    `Checked ${ALL_STRUCTURES.length} structures (${joints.length} joints) across ${AREAS.length} areas ` +
      `and ${ALL_IMAGES.length} images: ${errors} error(s), ${warnings} warning(s).`,
  );

  if (errors > 0) process.exit(1);
}

main();
