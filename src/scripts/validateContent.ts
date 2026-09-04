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
import { isJoint, isMuscle, areaOf } from '../features/anatomy-revision/types/structure';
import { AREAS, AREA_LABELS } from '../features/anatomy-revision/types/region';
import { OINA_PROMPT_KINDS } from '../features/anatomy-revision/types/question';
import { correctValuesFor } from '../features/anatomy-revision/lib/questionGenerators/oina';
import { acceptedVariantsFor, matchesSlot } from '../features/anatomy-revision/lib/oinaAnswer';
import { stripHeadPrefix } from '../features/anatomy-revision/lib/oinaValues';

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

/**
 * OINA Cards (CR-018) ask about each authored value on its own, which makes
 * the content assumptions the generator relies on load-bearing in a way the
 * old joined-string MCQs never made them. Each check below corresponds to a
 * way the question would silently become unanswerable rather than fail.
 */
function validateOina(): void {
  const muscles = ALL_STRUCTURES.filter(isMuscle);

  for (const m of muscles) {
    for (const promptKind of OINA_PROMPT_KINDS) {
      const values = correctValuesFor(m, promptKind);
      if (values.length === 0) {
        fail(
          `Muscle "${m.id}" has no answerable ${promptKind} — OINA would emit a question with ` +
            'no correct choice, so it is skipped entirely and the fact becomes unstudiable',
        );
      }
    }

    // Head prefixes are stripped so a prefixed choice isn't the answer by shape
    // alone. Two heads attaching to the same place then collapse to one value —
    // fine, and deduplicated — but an authored value that strips to nothing, or
    // a colon left behind by a prefix the regex didn't match, is a real problem.
    for (const field of ['origin', 'insertion'] as const) {
      for (const raw of m[field]) {
        const stripped = stripHeadPrefix(raw);
        if (!stripped.trim()) fail(`Muscle "${m.id}" ${field} value ${JSON.stringify(raw)} strips to nothing`);
        if (stripped.includes(':')) {
          warn(
            `Muscle "${m.id}" ${field} value ${JSON.stringify(stripped)} still contains a colon — ` +
              'an unrecognised head prefix would be shown as a choice, giving the answer away',
          );
        }
      }
    }

    // gradeTypedSlots matches inputs to slots first-fit rather than solving an
    // optimal assignment, which is only sound while no muscle has two of its own
    // values that could satisfy the same typed answer.
    for (const promptKind of OINA_PROMPT_KINDS) {
      const values = correctValuesFor(m, promptKind);
      for (const a of values) {
        for (const b of values) {
          if (a === b) continue;
          if (matchesSlot(b, acceptedVariantsFor(promptKind, a))) {
            fail(
              `Muscle "${m.id}" ${promptKind}: ${JSON.stringify(b)} also grades as ${JSON.stringify(a)} — ` +
                'one typed answer could satisfy two slots, so first-fit matching is no longer sound',
            );
          }
        }
      }
    }
  }

  const noNerve = muscles.filter((m) => m.nerve.length > 0 && correctValuesFor(m, 'nerve').length === 0);
  console.log(
    `\nOINA: ${muscles.length} muscles x ${OINA_PROMPT_KINDS.length} facts checked` +
      (noNerve.length ? `; ${noNerve.length} with no answerable nerve` : ''),
  );
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
    for (const hotspot of img.hotspots ?? []) {
      if (!structureIds.has(hotspot.structureId)) {
        warn(`Image "${img.id}" has a hotspot for unknown structureId "${hotspot.structureId}"`);
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

  validateOina();

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
