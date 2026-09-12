import type { AnatomyImageAsset } from '../../types/image';
import { MUSCLE_PANELS } from './panels.generated';
import type { Region, SubRegion } from '../../types/region';
import { REGION_HOTSPOTS, REGION_PANEL_NAMES } from './hotspots.regions.generated';
import { JOINT_PANELS } from './jointPanels.generated';
import { JOINT_HOTSPOTS } from './hotspots.joints.generated';
import { BONE_PLATES } from './bonePlates.generated';
import { BONE_HOTSPOTS } from './hotspots.bones.generated';
import { DEEP_PLATES } from './deepPlates.generated';
import { DEEP_HOTSPOTS } from './hotspots.deep.generated';
import { LANDMARK_PANELS } from './landmarkPanels.generated';
import { LANDMARK_HOTSPOTS } from './hotspots.landmarks.generated';
import { SUBREGION_PLATES } from './subRegionPlates.generated';
import { SUBREGION_HOTSPOTS } from './hotspots.subregions.generated';

/**
 * Three image sets, in the order they appear below:
 *
 * 1. 14 AI-generated bone/landmark atlas slides in /public/anatomy/atlas/.
 *    `panelStructureNames` are transcribed verbatim from each slide's printed
 *    panel labels — lib/linkImages.ts matches those against structure
 *    name/id/aliases to populate `imageIds`, so keep them exact if a slide is
 *    ever regenerated. No hotspots, so these serve flashcard/MCQ prompts only.
 *    (The 10 AI *muscle* slides were retired in favour of set 3.)
 * 2. 21 single-muscle panels for the Muscle Card screen — one muscle picked out
 *    in blue on the skeleton, anterior/lateral/posterior side by side. No
 *    hotspots. Rendered by src/scripts/blender/renderMusclePanels.py and
 *    stitched by compositePanels.ts, replacing 255px AI crops that were
 *    visibly soft. Note these deliberately show the muscle IN CONTEXT: the
 *    Z-Anatomy isolated renders are sharper still but float the muscle alone
 *    against white, which is worse for learning where it actually sits.
 * 3. 15 Z-Anatomy regional renders (anterior/lateral/posterior x 5 regions).
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

const AI_GENERATED_CREDIT = 'Rory Neary (AI-generated illustration)';
const AI_GENERATED_LICENCE = 'All rights reserved';

// Share-alike: anything derived from these renders, the traced polygons
// included, carries the same licence. AttributionBadge renders these strings
// verbatim, so they must stay accurate.
const Z_ANATOMY_CREDIT =
  'Derived from Z-Anatomy (Gauthier Kervyn et al.), based on BodyParts3D (Database Center for Life Science).';
const Z_ANATOMY_LICENCE = 'CC BY-SA 4.0';

export const IMAGE_ASSETS: AnatomyImageAsset[] = [
  // --- Bone / landmark atlas images (14) ---
  {
    id: 'bones-named-overview',
    filePath: '/anatomy/atlas/bones-named-overview.webp',
    slideTitle: 'Named Bones Overview',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Clavicle', 'Scapula', 'Sternum', 'Ribs',
      'Cervical vertebrae', 'Thoracic vertebrae', 'Lumbar vertebrae', 'Sacrum',
      'Coccyx', 'Humerus', 'Radius', 'Ulna',
      'Femur', 'Patella', 'Tibia', 'Fibula',
    ],
    region: 'back-core', subregion: 'torso', view: 'anterior', layer: 'skeletal',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'landmarks-scapula-humerus',
    filePath: '/anatomy/atlas/landmarks-scapula-humerus.webp',
    slideTitle: 'Scapula and Humerus Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Acromion', 'Coracoid process', 'Spine of scapula', 'Glenoid cavity',
      'Superior angle of scapula', 'Inferior angle of scapula', 'Supraspinous fossa', 'Infraspinous fossa',
      'Greater tubercle of humerus', 'Lesser tubercle of humerus', 'Intertubercular sulcus', 'Deltoid tuberosity',
      'Surgical neck of humerus', 'Anatomical neck of humerus', 'Medial epicondyle of humerus', 'Lateral epicondyle of humerus',
    ],
    region: 'shoulder-arm', subregion: 'shoulder', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'landmarks-elbow-wrist-carpals',
    filePath: '/anatomy/atlas/landmarks-elbow-wrist-carpals.webp',
    slideTitle: 'Elbow, Wrist and Carpal Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Olecranon', 'Coronoid process of ulna', 'Trochlear notch', 'Head of radius',
      'Radial tuberosity', 'Ulnar styloid process', 'Radial styloid process', 'Scaphoid',
      'Lunate', 'Triquetrum', 'Pisiform', 'Trapezium',
      'Trapezoid', 'Capitate', 'Hamate', 'Carpals (grouped)',
    ],
    region: 'forearm-hand', subregion: 'wrist-hand', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'bones-hand',
    filePath: '/anatomy/atlas/bones-hand.webp',
    slideTitle: 'Hand Bones',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Metacarpals (grouped)', 'Proximal phalanges of the hand (grouped)', 'Middle phalanges of the hand (grouped)', 'Distal phalanges of the hand (grouped)',
      'First metacarpal', 'Second metacarpal', 'Third metacarpal', 'Fourth metacarpal',
      'Fifth metacarpal', 'Base of first metacarpal', 'Head of first metacarpal', 'Hook of hamate',
      'Pisiform', 'Scaphoid tubercle', 'Trapezium', 'Anatomical snuffbox region',
    ],
    region: 'forearm-hand', subregion: 'wrist-hand', view: 'dorsal', layer: 'skeletal',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'landmarks-spine-thorax-overview',
    filePath: '/anatomy/atlas/landmarks-spine-thorax-overview.webp',
    slideTitle: 'Spine and Thorax Landmarks Overview',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Atlas (C1)', 'Axis (C2)', 'Spinous process', 'Transverse process',
      'Vertebral body', 'Intervertebral foramen', 'Manubrium', 'Body of sternum',
      'Xiphoid process', 'Jugular notch', 'Sternal angle', 'Costal margin',
      'First rib', 'Twelfth rib', 'Sacral promontory', 'Sacral hiatus',
    ],
    region: 'back-core', subregion: 'spine', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'bones-pelvis-hip',
    filePath: '/anatomy/atlas/bones-pelvis-hip.webp',
    slideTitle: 'Pelvis and Hip Bones and Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Ilium', 'Ischium', 'Pubis', 'Acetabulum',
      'Iliac crest', 'Anterior superior iliac spine (ASIS)', 'Anterior inferior iliac spine (AIIS)', 'Posterior superior iliac spine (PSIS)',
      'Ischial tuberosity', 'Pubic tubercle', 'Femoral head', 'Femoral neck',
      'Greater trochanter', 'Lesser trochanter', 'Intertrochanteric line', 'Obturator foramen',
    ],
    region: 'hip-thigh', subregion: 'hip', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'landmarks-knee',
    filePath: '/anatomy/atlas/landmarks-knee.webp',
    slideTitle: 'Knee Region Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Medial condyle of femur', 'Lateral condyle of femur', 'Medial epicondyle of femur', 'Lateral epicondyle of femur',
      'Adductor tubercle', 'Linea aspera', 'Patella', 'Medial condyle of tibia',
      'Lateral condyle of tibia', 'Tibial tuberosity', 'Intercondylar eminence of tibia', 'Head of fibula',
      "Neck of fibula", "Gerdy's tubercle", 'Tibial plateau', 'Intercondylar fossa of femur',
    ],
    region: 'hip-thigh', subregion: 'knee', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'bones-foot',
    filePath: '/anatomy/atlas/bones-foot.webp',
    slideTitle: 'Foot Bones',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Medial malleolus', 'Lateral malleolus', 'Talus', 'Calcaneus',
      'Navicular', 'Cuboid', 'Medial cuneiform', 'Intermediate cuneiform',
      'Lateral cuneiform', 'Metatarsals (grouped)', 'Proximal phalanges of the foot (grouped)', 'Middle phalanges of the foot (grouped)',
      'Distal phalanges of the foot (grouped)', 'Base of fifth metatarsal', 'Head of first metatarsal', 'Tarsals (grouped)',
    ],
    region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'dorsal', layer: 'skeletal',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'landmarks-16-clinical',
    filePath: '/anatomy/atlas/landmarks-16-clinical.webp',
    slideTitle: '16 Core Clinical Bony Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Medial epicondyle of humerus', 'Lateral epicondyle of humerus', 'Olecranon', 'Radial styloid',
      'Ulnar styloid', 'ASIS', 'PSIS', 'Iliac crest',
      'Ischial tuberosity', 'Greater trochanter', 'Tibial tuberosity', 'Head of fibula',
      'Medial malleolus', 'Lateral malleolus', 'Calcaneal tuberosity', 'Navicular tuberosity',
    ],
    region: 'hip-thigh', subregion: 'hip', view: 'anterior', layer: 'landmark',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'bones-landmarks-grouped-overview',
    filePath: '/anatomy/atlas/bones-landmarks-grouped-overview.webp',
    slideTitle: 'Slide 10: Additional Clinically Useful Grouped Bones and Landmarks',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Pelvis (hip bone, grouped)', 'Hand skeleton', 'Foot skeleton', 'Thoracic cage',
      'Vertebral column', 'Sacroiliac joint region', 'Acetabulum', 'Glenoid cavity',
      'Carpometacarpal joint of thumb', 'Distal radioulnar joint', 'Proximal tibiofibular joint', 'Ankle mortise',
      'Sustentaculum tali', 'Calcaneal tuberosity', 'Tibial crest (anterior border of tibia)', 'Base of fifth metatarsal',
    ],
    region: 'back-core', subregion: 'torso', view: 'anterior', layer: 'skeletal',
    width: 1122, height: 1402,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'spine-atlas-cervical',
    filePath: '/anatomy/atlas/spine-atlas-cervical.webp',
    slideTitle: 'Cervical Spine Atlas',
    mode: 'atlas-slide',
    panelStructureNames: [
      'C1 Atlas', 'C2 Axis', 'Typical Cervical Vertebra', 'Dens (Odontoid Process)',
      'Anterior Arch of Atlas', 'Posterior Arch of Atlas', 'Lateral Mass of Atlas', 'Transverse Foramen',
      'Vertebral Body (Cervical)', 'Vertebral Foramen (Cervical)', 'Bifid Spinous Process', 'C7 Spinous Process',
      'Superior Articular Process (Cervical)', 'Inferior Articular Process (Cervical)', 'Intervertebral Disc (Cervical)', 'Cervical Region (C1–C7)',
    ],
    region: 'back-core', subregion: 'neck', view: 'posterior', layer: 'skeletal',
    width: 1254, height: 1254,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'spine-atlas-thoracic',
    filePath: '/anatomy/atlas/spine-atlas-thoracic.webp',
    slideTitle: 'Thoracic Spine Atlas',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Thoracic Region (T1–T12)', 'Typical Thoracic Vertebra', 'Vertebral Body (Thoracic)', 'Vertebral Foramen (Thoracic)',
      'Pedicle (Thoracic)', 'Lamina (Thoracic)', 'Spinous Process (Thoracic)', 'Transverse Process (Thoracic)',
      'Superior Articular Process (Thoracic)', 'Inferior Articular Process (Thoracic)', 'Superior Costal Facet', 'Inferior Costal Facet',
      'Transverse Costal Facet', 'Thoracic Intervertebral Disc', 'Thoracic Zygapophyseal (Facet) Joint', 'Rib Articulation to Thoracic Vertebra',
    ],
    region: 'back-core', subregion: 'spine', view: 'posterior', layer: 'skeletal',
    width: 1254, height: 1254,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'spine-atlas-lumbar',
    filePath: '/anatomy/atlas/spine-atlas-lumbar.webp',
    slideTitle: 'Lumbar Spine Atlas',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Lumbar Region (L1–L5)', 'Typical Lumbar Vertebra', 'Vertebral Body (Lumbar)', 'Vertebral Foramen (Lumbar)',
      'Pedicle (Lumbar)', 'Lamina (Lumbar)', 'Spinous Process (Lumbar)', 'Transverse Process (Lumbar)',
      'Superior Articular Process (Lumbar)', 'Inferior Articular Process (Lumbar)', 'Pars Interarticularis', 'Lumbar Intervertebral Disc',
      'L4 Vertebra', 'L5 Vertebra', 'L5–S1 Junction', 'Lumbar Facet Joint',
    ],
    region: 'back-core', subregion: 'spine', view: 'posterior', layer: 'skeletal',
    width: 1254, height: 1254,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'spine-atlas-sacrum-coccyx',
    filePath: '/anatomy/atlas/spine-atlas-sacrum-coccyx.webp',
    slideTitle: 'Sacrum and Coccyx Atlas',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Sacrum', 'Coccyx', 'Sacral Promontory', 'Sacral Base',
      'Sacral Apex', 'Sacral Canal', 'Sacral Hiatus', 'Median Sacral Crest',
      'Sacral Ala', 'Anterior Sacral Foramina', 'Posterior Sacral Foramina', 'Auricular Surface',
      'Superior Articular Process of Sacrum', 'Sacral Cornua', 'Coccygeal Cornua', 'Sacroiliac Articular Surface',
    ],
    region: 'back-core', subregion: 'spine', view: 'posterior', layer: 'skeletal',
    width: 1254, height: 1254,
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },

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
  ...MUSCLE_PANELS.map(
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
    const id = `joint-${panel.structureId}-${panel.view}`;
    return {
      id,
      filePath: `/anatomy/joints/${panel.structureId}-${panel.view}.webp`,
      slideTitle: `${panel.name} — ${panel.view[0].toUpperCase()}${panel.view.slice(1)} View`,
      mode: 'single-structure',
      structureId: panel.structureId,
      region: panel.region,
      subregion: panel.subregion,
      view: panel.view,
      layer: 'skeletal',
      width: panel.width,
      height: panel.height,
      hotspots: JOINT_HOTSPOTS[id] ?? [],
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
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
      hotspots: BONE_HOTSPOTS[id] ?? [],
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
      hotspots: DEEP_HOTSPOTS[id] ?? [],
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
      hotspots: LANDMARK_HOTSPOTS[id] ?? [],
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
    const id = `sub-${plate.slug}-${plate.view}`;
    return {
      id,
      filePath: `/anatomy/subregions/${plate.slug}-${plate.view}.webp`,
      slideTitle: `${plate.title} — Close, ${plate.view[0].toUpperCase()}${plate.view.slice(1)} View`,
      mode: 'atlas-slide',
      panelStructureNames: [],
      region: plate.region,
      subregion: plate.subregion,
      view: plate.view,
      layer: 'skeletal',
      width: plate.width,
      height: plate.height,
      hotspots: SUBREGION_HOTSPOTS[id] ?? [],
      credit: Z_ANATOMY_CREDIT,
      licence: Z_ANATOMY_LICENCE,
    };
  }),
];
