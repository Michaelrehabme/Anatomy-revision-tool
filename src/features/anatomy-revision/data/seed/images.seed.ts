import type { AnatomyImageAsset } from '../../types/image';
import { MUSCLE_PANELS } from './panels.generated';
import type { Region, SubRegion } from '../../types/region';
import { REGION_HOTSPOTS, REGION_PANEL_NAMES } from './hotspots.regions.generated';
import { JOINT_PANELS } from './jointPanels.generated';
import { BONE_PLATES } from './bonePlates.generated';
import { DEEP_PLATES } from './deepPlates.generated';
import { LANDMARK_PANELS } from './landmarkPanels.generated';
import { SUBREGION_PLATES } from './subRegionPlates.generated';
import { LIGAMENT_PLATES } from './ligamentPlates.generated';
import { MUSCLE_PLATES, layerOfPlate } from './musclePlates.generated';

/**
 * Two image sets, in the order they appear below:
 *
 * THE AI-GENERATED ATLAS SLIDES ARE GONE. Fourteen bone and landmark slides
 * lived in /public/anatomy/atlas/ under "All rights reserved" until 18
 * September 2026, when they were removed rather than replaced (CR-033 item 8).
 * Two reasons: CR-026's acceptance criterion was zero images under that
 * licence, and for an app teaching attachments to people who will treat
 * patients, generated anatomy is the content most likely to be confidently
 * wrong. Removing them cost NOTHING measurable — they carried no hotspots, so
 * they generated no locate questions, and the question count was 8,675 before
 * and after. About twenty structures now have no picture on their card, which
 * degrades gracefully; a wrong picture would not.
 *
 * Do not reintroduce a generated slide to fill one of those gaps. Render it
 * with the Blender pipeline under src/scripts/blender/, or leave it empty.
 *
 * 1. 21 single-muscle panels for the Muscle Card screen — one muscle picked out
 *    in blue on the skeleton, anterior/lateral/posterior side by side. No
 *    hotspots. Rendered by src/scripts/blender/renderMusclePanels.py and
 *    stitched by compositePanels.ts, replacing 255px AI crops that were
 *    visibly soft. Note these deliberately show the muscle IN CONTEXT: the
 *    Z-Anatomy isolated renders are sharper still but float the muscle alone
 *    against white, which is worse for learning where it actually sits.
 * 2. 15 Z-Anatomy regional renders (anterior/lateral/posterior x 5 regions).
 *    These carry every hotspot in the app and are what makes locate questions
 *    work. Their hotspots and panel names come from the generated module, not
 *    from this file — see README "Adding hotspots".
 * 4. Joint locate images, one per joint per view, in /public/anatomy/joints/.
 *    Unlike set 2 these are NOT pre-highlighted: the skeleton is drawn plainly
 *    and framed on the joint, because a locate question on a panel that picks
 *    its own structure out in blue is answered by looking. The band a student
 *    has to click is the joint LINE — the space between the two articulating
 *    bones, derived from the bones themselves rather than from any joint
 *    geometry, which the atlas does not have. See renderJointMasks.py.
 *
 * `width`/`height` MUST match the real PNG's pixel dimensions (verified via
 * pngjs — see git history for the one-off script) for every image that has
 * hotspot data. HotspotImage.tsx locks the rendered box to this
 * aspect-ratio specifically so click coordinates line up with the
 * coordinate space the hotspots were authored against; without it,
 * `object-cover` silently crops to whatever shape the surrounding layout
 * happens to produce, and a dead-center click on the correct muscle can
 * register as wrong. Found as a real bug (all 45 images were missing this
 * before), not a hypothetical — see validateContent.ts's matching warning.
 * All panel crops share 255x259; atlas slides are 1122x1402 except the 4
 * spine-atlas-* ones, which are 1254x1254.
 *
 * ADD MORE IMAGES HERE: append another AnatomyImageAsset literal with
 * verbatim panelStructureNames — imageIds link automatically, no manual
 * cross-referencing needed. Set width/height to the file's real pixel
 * dimensions, not a guess.
 */

// Share-alike: anything derived from these renders, the traced polygons
// included, carries the same licence. AttributionBadge renders these strings
// verbatim, so they must stay accurate.
const Z_ANATOMY_CREDIT =
  'Derived from Z-Anatomy (Gauthier Kervyn et al.), based on BodyParts3D (Database Center for Life Science).';
const Z_ANATOMY_LICENCE = 'CC BY-SA 4.0';

/** The muscles that have a twelve-frame plate, so their old panel is skipped. */
const MUSCLE_PLATE_IDS = new Set(MUSCLE_PLATES.map((p) => p.structureId));

export const IMAGE_ASSETS: AnatomyImageAsset[] = [
  // --- Bone / landmark atlas images (14) ---
  // --- Single-muscle panel crops (21), for the Muscle Card screen ---
  // mode: 'single-structure' links via structureId directly (see
  // lib/linkImages.ts) rather than panelStructureNames matching.
  //
  // hotspots is always [] here, deliberately: these panels already render
  // the target muscle pre-highlighted in a distinct colour against the rest
  // of the (bone-coloured) figure — see MuscleCard's identify-by-image MCQ
  // and identify-typed questions ("Which structure is shown?"), which are
  // the right fit for that. A locate ("tap the muscle") question on an
  // image that already visually singles out the answer isn't testing
  // spatial recognition, it's testing whether the student can find the
  // oddly-coloured blob — CR-007 originally hand-traced 4 of these
  // (deltoid, gluteus-maximus, biceps-brachii, trapezius) as a locate
  // proof-of-concept, but CR-015/CR-016 removed them for exactly this
  // reason (see the Change Register). Locate questions belong on images
  // where nothing is pre-highlighted — a genuinely blank/neutral regional
  // diagram — which doesn't exist in this dataset yet.
  // The list itself is generated from the files in public/anatomy/panels/ —
  // 65 of them since CR-026 — so the seed cannot claim an image that is not
  // there, and each entry carries the real pixel dimensions of its own file
  // rather than one nominal pair shared by all of them. Regenerate with
  // src/scripts/generateMusclePanels.ts.
  //
  // A MUSCLE WITH A PLATE IS NOT SHOWN ITS PANEL. The plates below are the same
  // 122 muscles rendered twelve ways in the shared look, and leaving the panel
  // in the list as well would leave the old picture winning wherever a screen
  // takes the FIRST single-structure image for a structure (MuscleCard,
  // MobileMuscleCard) — which is how coracobrachialis was still on its 18
  // September render after the rest of the app had moved on. The panels of
  // bones, landmarks and joints stay: nothing has replaced those.
  ...MUSCLE_PANELS.filter(({ structureId }) => !MUSCLE_PLATE_IDS.has(structureId)).map(
    ({ structureId, region, subregion, layer, width, height }): AnatomyImageAsset => ({
      id: `panel-${structureId}`,
      filePath: `/anatomy/panels/${structureId}.webp`,
      mode: 'single-structure',
      structureId,
      region,
      subregion,
      view: 'posterior',
      layer,
      width,
      height,
      hotspots: [],
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    }),
  ),

  // --- Z-Anatomy regional renders (15): 3 views x 5 regions ---
  // Rendered from the Z-Anatomy 3D model; polygons are traced from the
  // per-muscle Blender masks by src/scripts/masksToHotspots.ts. Both the
  // hotspots and the panel names come from the generated module rather than
  // being typed here, so they cannot drift from the renders they describe.
  // Each view is one frame of the same turntable, so all three share a camera.
  ...([
    ['shoulder-arm', 'shoulder', 'Shoulder and Arm'],
    ['back-core', 'spine', 'Back and Core'],
    ['hip-thigh', 'hip', 'Hip and Thigh'],
    ['lower-leg-foot', 'ankle-foot', 'Lower Leg and Foot'],
    ['forearm-hand', 'wrist-hand', 'Forearm and Hand'],
  ] as [Region, SubRegion, string][]).flatMap(([region, subregion, regionTitle]) =>
    (['anterior', 'lateral', 'posterior'] as const).map((view): AnatomyImageAsset => {
      const id = `region-${region}-${view}`;
      return {
        id,
        filePath: `/anatomy/regions/${region}-${view}.webp`,
        slideTitle: `${regionTitle} — ${view[0].toUpperCase()}${view.slice(1)} View`,
        mode: 'atlas-slide',
        panelStructureNames: REGION_PANEL_NAMES[id] ?? [],
        region,
        subregion,
        view,
        layer: 'superficial-muscle',
        // Required, not decorative: HotspotImage derives its wrapper's
        // aspect-ratio from these, and without them the rendered box stops
        // matching the image 1:1 and every click normalises to the wrong point.
        width: 1400,
        height: 1400,
        hotspots: REGION_HOTSPOTS[id] ?? [],
        credit: Z_ANATOMY_CREDIT,
        licence: Z_ANATOMY_LICENCE,
      };
    }),
  ),

  // --- Joint locate images: one per joint per view ---
  // Rendered by renderJointMasks.py, published by publishJointPanels.ts, and
  // traced into hotspots by jointLineHotspots.ts. Dimensions come from the
  // generated module because they are measured from the files themselves.
  //
  // mode is 'single-structure' with structureId set, so linkImages associates
  // the image with its joint. That is the same mode the muscle panels use, and
  // the reason those carry no hotspots while these do is pre-highlighting, not
  // the mode: these show the answer nowhere.
  ...JOINT_PANELS.map((panel): AnatomyImageAsset => {
    // A TURNTABLE, LIKE EVERY OTHER FAMILY. The angle is what makes twelve
    // frames one picture a student can walk round: lib/rotationFrames.ts reads
    // the `-aNNN-` segment, locate asks once per set, and identify opens on
    // one frame of it. Named views alone could not do this — two of the twelve
    // angles share a name, so the ids collided.
    const slug = `a${String(panel.angle).padStart(3, '0')}`;
    const id = `joint-${panel.structureId}-${slug}-plate`;
    return {
      id,
      filePath: `/anatomy/joints/${panel.structureId}-${slug}-plate.webp`,
      slideTitle: `${panel.name} — ${panel.view[0].toUpperCase()}${panel.view.slice(1)} View (${panel.angle}°)`,
      mode: 'single-structure',
      structureId: panel.structureId,
      region: panel.region,
      subregion: panel.subregion,
      view: panel.view,
      layer: 'skeletal',
      width: panel.width,
      height: panel.height,
      hotspots: [],  // attached by seed/hotspots.ts; see the note there
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),

  // --- Ligament plates: one joint framed on one ligament, up to eight angles ---
  // Two pictures per angle. The context picture shows every ligament of the
  // joint at rest and carries hotspots for the target and every other seeded
  // ligament in view — one picture, many hotspots, like the region plates —
  // so it is the locate picture, and a wrong click can be named. The highlight
  // picture picks the target out in cyan: pre-highlighted, so no hotspots and
  // never a locate question, exactly as the muscle panels are handled. Only
  // angles where the target traced are published. Rendered by
  // renderLigamentPlates.py, published by publishLigamentPlates.ts.
  ...LIGAMENT_PLATES.map((plate): AnatomyImageAsset => {
    // aNNN, or aNNNuMMM / aNNNdMMM for a frame tilted up or down (lib/rotationFrames.ts).
    const tilt = plate.elevation ?? 0;
    const marker = `a${String(plate.angle).padStart(3, '0')}${tilt ? `${tilt > 0 ? 'u' : 'd'}${String(Math.abs(tilt)).padStart(3, '0')}` : ''}`;
    const id = `ligament-${plate.structureId}-${marker}-${plate.kind}`;
    const viewLabel = `${plate.view[0].toUpperCase()}${plate.view.slice(1)}`;
    return plate.kind === 'context'
      ? {
          id,
          filePath: `/anatomy/ligaments/${plate.structureId}-${marker}-context.webp`,
          slideTitle: `${plate.name} — ${viewLabel} View`,
          mode: 'atlas-slide',
          panelStructureNames: plate.panelStructureNames,
          region: plate.region,
          subregion: plate.subregion,
          view: plate.view,
          layer: 'ligament',
          width: plate.width,
          height: plate.height,
          hotspots: [],  // attached by seed/hotspots.ts; see the note there
          credit: Z_ANATOMY_CREDIT,
          licence: Z_ANATOMY_LICENCE,
        }
      : {
          id,
          filePath: `/anatomy/ligaments/${plate.structureId}-${marker}-highlight.webp`,
          slideTitle: `${plate.name} — ${viewLabel} View (highlighted)`,
          mode: 'single-structure',
          structureId: plate.structureId,
          region: plate.region,
          subregion: plate.subregion,
          view: plate.view,
          layer: 'ligament',
          width: plate.width,
          height: plate.height,
          hotspots: [],
          credit: Z_ANATOMY_CREDIT,
          licence: Z_ANATOMY_LICENCE,
        };
  }),

  // --- Muscle plates: one muscle in context, twelve angles ---
  // Two pictures per angle, the same pair the ligament plates ship. The context
  // picture draws every seeded muscle in frame in the same red and carries a
  // hotspot for each, so it is the locate picture and a wrong tap can be named.
  // The highlight picture picks the target out in cyan: pre-highlighted, so no
  // hotspots and never a locate question — it is the identify picture, and the
  // one the muscle's own card opens on, which is what the user asked for ("in
  // the atlas i want the muscle highlighted as if it were an identify question
  // as opposed to on its own"). A deep muscle's plates are drawn with the
  // superficial layer taken off, which is why `layer` is read from the plate.
  // Rendered by renderMusclePlates.py, published by publishMusclePlates.ts.
  //
  // PRIMARY FIRST. MuscleCard takes the first single-structure image it finds
  // for a structure, and the angle where the muscle shows largest is the one
  // worth meeting it at: sorted this way, trapezius opens from behind rather
  // than from the front, where almost none of it can be seen.
  ...[...MUSCLE_PLATES]
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .map((plate): AnatomyImageAsset => {
      const marker = `a${String(plate.angle).padStart(3, '0')}`;
      const id = `muscle-${plate.structureId}-${marker}-${plate.kind}`;
      const viewLabel = `${plate.view[0].toUpperCase()}${plate.view.slice(1)}`;
      const shared: Omit<AnatomyImageAsset, 'mode'> = {
        id,
        filePath: `/anatomy/muscles/${plate.structureId}-${marker}-${plate.kind}.webp`,
        region: plate.region,
        subregion: plate.subregion,
        view: plate.view,
        layer: layerOfPlate(plate),
        width: plate.width,
        height: plate.height,
        hotspots: [],  // attached by seed/hotspots.ts; see the note there
        credit: Z_ANATOMY_CREDIT,
        licence: Z_ANATOMY_LICENCE,
      };
      return plate.kind === 'context'
        ? {
            ...shared,
            slideTitle: `${plate.name} — ${viewLabel} View`,
            mode: 'atlas-slide',
            panelStructureNames: plate.panelStructureNames,
          }
        : {
            ...shared,
            slideTitle: `${plate.name} — ${viewLabel} View (highlighted)`,
            mode: 'single-structure',
            structureId: plate.structureId,
          };
    }),

  // --- Bone plates: the skeleton by region, one image per view ---
  // Bones were the only category already eligible for locate questions with no
  // hotspot anywhere to answer one: every hotspot the app had described a
  // muscle. These are the region idea applied to the skeleton — the plate shows
  // the bones plainly and each bone's silhouette is traced from a mask rendered
  // with the others held out, so a bone behind another claims only what can be
  // seen. Rendered by renderBonePlates.py, traced by bonePlateHotspots.ts.
  ...BONE_PLATES.map((plate): AnatomyImageAsset => {
    const id = `bone-${plate.region}-${plate.view}`;
    return {
      id,
      filePath: `/anatomy/bones/${plate.region}-${plate.view}.webp`,
      slideTitle: `${plate.title} — Skeleton, ${plate.view[0].toUpperCase()}${plate.view.slice(1)} View`,
      mode: 'atlas-slide',
      panelStructureNames: [],
      region: plate.region,
      subregion: plate.subregion,
      view: plate.view,
      layer: 'skeletal',
      width: plate.width,
      height: plate.height,
      hotspots: [],  // attached by seed/hotspots.ts; see the note there
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),

  // --- Deep-muscle plates: the layer under the region plates ---
  // 48 muscles sit behind something on the region plates, so the depth
  // subtraction removed them and they never carried a hotspot. These draw only
  // those muscles on the skeleton: nothing is in front of them because nothing
  // in front of them is rendered. Rendered by renderDeepPlates.py.
  ...DEEP_PLATES.map((plate): AnatomyImageAsset => {
    const id = `deep-${plate.region}-${plate.view}`;
    return {
      id,
      filePath: `/anatomy/deep/${plate.region}-${plate.view}.webp`,
      slideTitle: `${plate.title} — Deep Layer, ${plate.view[0].toUpperCase()}${plate.view.slice(1)} View`,
      mode: 'atlas-slide',
      panelStructureNames: [],
      region: plate.region,
      subregion: plate.subregion,
      view: plate.view,
      layer: 'deep-muscle',
      width: plate.width,
      height: plate.height,
      hotspots: [],  // attached by seed/hotspots.ts; see the note there
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),

  // --- Landmarks: a point on its bone ---
  // A landmark is not separable geometry, so it cannot be highlighted and had
  // only an AI-generated slide. Z-Anatomy marks each with a positioned anchor,
  // which is snapped to the bone and framed; the hotspot is a CIRCLE sized from
  // the landmark's real dimensions rather than a traced outline. Only views
  // where it is on the near side of the bone are published at all.
  ...LANDMARK_PANELS.map((panel): AnatomyImageAsset => {
    const id = `landmark-${panel.structureId}-${panel.view}`;
    return {
      id,
      filePath: `/anatomy/landmarks/${panel.structureId}-${panel.view}.webp`,
      slideTitle: `${panel.name} — ${panel.view[0].toUpperCase()}${panel.view.slice(1)} View`,
      mode: 'single-structure',
      structureId: panel.structureId,
      region: panel.region,
      subregion: panel.subregion,
      view: panel.view,
      layer: 'skeletal',
      width: panel.width,
      height: panel.height,
      hotspots: [],  // attached by seed/hotspots.ts; see the note there
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),

  // --- Sub-region plates: drawn close enough to aim at ---
  // The region and skeleton plates frame a whole limb, and at that scale the
  // small structures — lumbricals, interossei, scaphoid, atlas — came out a few
  // hundred pixels and were dropped rather than traced. Nothing is wrong with
  // them; the camera was in the wrong place. Bones and muscles share a plate
  // deliberately: a student looking at a hand should be asked for the scaphoid
  // and for opponens pollicis from the same picture.
  ...SUBREGION_PLATES.map((plate): AnatomyImageAsset => {
    // A ROTATION SET IS NAMED BY ITS ANGLE, not by its view: at 30 degrees two
    // frames share a view name, and "-aNNN-" is the marker the app groups a
    // turntable by (lib/questionGenerators/locate.ts). A plate with no angle is
    // a single look — the plantar view, which no amount of turning about the
    // vertical axis will ever reach — and keeps the name it always had.
    const turn = plate.angle === undefined ? null : String(plate.angle).padStart(3, '0');
    const id = turn ? `sub-${plate.slug}-a${turn}-plate` : `sub-${plate.slug}-${plate.view}`;
    const file = turn ? `${plate.slug}-a${turn}` : `${plate.slug}-${plate.view}`;
    return {
      id,
      filePath: `/anatomy/subregions/${file}.webp`,
      slideTitle: `${plate.title} — Close, ${plate.view[0].toUpperCase()}${plate.view.slice(1)} View`,
      mode: 'atlas-slide',
      panelStructureNames: [],
      region: plate.region,
      subregion: plate.subregion,
      view: plate.view,
      layer: 'skeletal',
      width: plate.width,
      height: plate.height,
      hotspots: [],  // attached by seed/hotspots.ts; see the note there
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),
];
