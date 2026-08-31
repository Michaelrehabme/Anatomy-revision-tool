import type { AnatomyImageAsset, LayerType } from '../../types/image';
import type { Region, SubRegion } from '../../types/region';
import { REGION_HOTSPOTS, REGION_PANEL_NAMES } from './hotspots.regions.generated';

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
 *
 * ADD MORE IMAGES HERE: append another AnatomyImageAsset literal with
 * verbatim panelStructureNames — imageIds link automatically, no manual
 * cross-referencing needed.
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
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },

  // --- Single-muscle panel crops (21), for the Muscle Card screen ---
  // mode: 'single-structure' links via structureId directly (see
  // lib/linkImages.ts) rather than panelStructureNames matching.
  ...([
    ['supraspinatus', 'shoulder-arm', 'shoulder', 'deep-muscle'],
    ['infraspinatus', 'shoulder-arm', 'shoulder', 'deep-muscle'],
    ['teres-minor', 'shoulder-arm', 'shoulder', 'deep-muscle'],
    ['subscapularis', 'shoulder-arm', 'shoulder', 'deep-muscle'],
    ['deltoid', 'shoulder-arm', 'shoulder', 'superficial-muscle'],
    ['trapezius', 'shoulder-arm', 'shoulder', 'superficial-muscle'],
    ['latissimus-dorsi', 'shoulder-arm', 'shoulder', 'superficial-muscle'],
    ['biceps-brachii', 'shoulder-arm', 'elbow', 'superficial-muscle'],
    ['brachialis', 'shoulder-arm', 'elbow', 'deep-muscle'],
    ['triceps-brachii', 'shoulder-arm', 'elbow', 'superficial-muscle'],
    ['brachioradialis', 'forearm-hand', 'elbow', 'superficial-muscle'],
    ['gluteus-maximus', 'hip-thigh', 'hip', 'superficial-muscle'],
    ['gluteus-medius', 'hip-thigh', 'hip', 'deep-muscle'],
    ['gluteus-minimus', 'hip-thigh', 'hip', 'deep-muscle'],
    ['tensor-fasciae-latae', 'hip-thigh', 'hip', 'superficial-muscle'],
    ['semitendinosus', 'hip-thigh', 'knee', 'superficial-muscle'],
    ['biceps-femoris', 'hip-thigh', 'knee', 'superficial-muscle'],
    ['tibialis-anterior', 'lower-leg-foot', 'ankle-foot', 'superficial-muscle'],
    ['tibialis-posterior', 'lower-leg-foot', 'ankle-foot', 'deep-muscle'],
    ['gastrocnemius', 'lower-leg-foot', 'ankle-foot', 'superficial-muscle'],
    ['soleus', 'lower-leg-foot', 'ankle-foot', 'deep-muscle'],
  ] as [string, Region, SubRegion, LayerType][]).map(
    ([structureId, region, subregion, layer]): AnatomyImageAsset => ({
      id: `panel-${structureId}`,
      filePath: `/anatomy/panels/${structureId}.webp`,
      mode: 'single-structure',
      structureId,
      region,
      subregion,
      view: 'posterior',
      layer,
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
];
