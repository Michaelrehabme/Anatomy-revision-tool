import type { AnatomyImageAsset } from '../../types/image';

/**
 * 24 real atlas-slide images, copied into /public/anatomy/atlas/ from
 * AI-generated illustrations the user produced (see README "Licensing").
 * `panelStructureNames` are transcribed verbatim from each image's panel
 * labels — this is what lib/linkImages.ts matches against structure
 * name/id/aliases to auto-populate every structure's `imageIds`, so keep
 * these exact if a slide is ever regenerated/retitled.
 *
 * `hotspots: []` on every entry is still accurate: no pixel/polygon data
 * exists for any of these images yet (unaffected by this content
 * expansion) — see README "Adding hotspots" for the two authoring paths
 * (Blender pipeline for muscles, manual/dev-route for bones/landmarks).
 * Until populated, these images are usable for flashcard/MCQ prompts but
 * generate zero locate questions.
 *
 * ADD MORE IMAGES HERE: append another AnatomyImageAsset literal with
 * verbatim panelStructureNames — imageIds link automatically, no manual
 * cross-referencing needed.
 */

const AI_GENERATED_CREDIT = 'Rory Neary (AI-generated illustration)';
const AI_GENERATED_LICENCE = 'All rights reserved';

export const IMAGE_ASSETS: AnatomyImageAsset[] = [
  // --- Muscle atlas slides (10) ---
  {
    id: 'muscle-slide-01',
    filePath: '/anatomy/atlas/muscle-slide-01-neck-upper-back.png',
    slideTitle: 'Slide 1 – Neck and Upper Back Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Trapezius', 'Levator scapulae', 'Splenius capitis', 'Splenius cervicis',
      'Semispinalis capitis', 'Semispinalis cervicis', 'Semispinalis thoracis', 'Multifidus',
      'Rotatores', 'Interspinales', 'Intertransversarii', 'Iliocostalis',
      'Longissimus', 'Spinalis', 'Rhomboid minor', 'Rhomboid major',
    ],
    region: 'back-core', subregion: 'neck', view: 'posterior', layer: 'deep-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-02',
    filePath: '/anatomy/atlas/muscle-slide-02-shoulder-scapular.png',
    slideTitle: 'Slide 2 – Shoulder and Scapular Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Deltoid', 'Supraspinatus', 'Infraspinatus', 'Subscapularis',
      'Teres minor', 'Teres major', 'Serratus anterior', 'Pectoralis minor',
      'Pectoralis major', 'Latissimus dorsi', 'Coracobrachialis', 'Subclavius',
      'Rhomboid minor', 'Rhomboid major', 'Levator scapulae', 'Trapezius',
    ],
    region: 'shoulder-arm', subregion: 'shoulder', view: 'posterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-03',
    filePath: '/anatomy/atlas/muscle-slide-03-arm-anterior-forearm.png',
    slideTitle: 'Slide 3 – Arm and Anterior Forearm Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Biceps brachii', 'Brachialis', 'Triceps brachii', 'Brachioradialis',
      'Pronator teres', 'Supinator', 'Flexor carpi radialis', 'Palmaris longus',
      'Flexor carpi ulnaris', 'Flexor digitorum superficialis', 'Flexor digitorum profundus', 'Flexor pollicis longus',
      'Pronator quadratus', 'Extensor carpi radialis longus', 'Extensor carpi radialis brevis', 'Anconeus',
    ],
    region: 'shoulder-arm', subregion: 'elbow', view: 'anterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-04',
    filePath: '/anatomy/atlas/muscle-slide-04-posterior-forearm-wrist-hand.png',
    slideTitle: 'Slide 4 – Posterior Forearm, Wrist and Hand Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Extensor digitorum', 'Extensor digiti minimi', 'Extensor carpi ulnaris', 'Abductor pollicis longus',
      'Extensor pollicis brevis', 'Extensor pollicis longus', 'Extensor indicis', 'Abductor pollicis brevis',
      'Flexor pollicis brevis', 'Opponens pollicis', 'Adductor pollicis', 'Abductor digiti minimi',
      'Flexor digiti minimi brevis', 'Opponens digiti minimi', 'Lumbricals', 'Dorsal interossei',
    ],
    region: 'forearm-hand', subregion: 'wrist-hand', view: 'posterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-05',
    filePath: '/anatomy/atlas/muscle-slide-05-trunk-abdominal-pelvic-wall.png',
    slideTitle: 'Slide 5 – Trunk, Abdominal Wall and Pelvic Wall Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Rectus abdominis', 'External oblique', 'Internal oblique', 'Transversus abdominis',
      'Quadratus lumborum', 'Iliacus', 'Psoas major', 'Psoas minor',
      'Piriformis', 'Obturator internus', 'Obturator externus', 'Superior gemellus',
      'Inferior gemellus', 'Quadratus femoris', 'Levator ani', 'Coccygeus',
    ],
    region: 'back-core', subregion: 'torso', view: 'anterior', layer: 'deep-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-06',
    filePath: '/anatomy/atlas/muscle-slide-06-hip-gluteal.png',
    slideTitle: 'Slide 6 – Hip and Gluteal Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Gluteus maximus', 'Gluteus medius', 'Gluteus minimus', 'Tensor fasciae latae',
      'Piriformis', 'Obturator internus', 'Obturator externus', 'Superior gemellus',
      'Inferior gemellus', 'Quadratus femoris', 'Iliacus', 'Psoas major',
      'Pectineus', 'Adductor longus', 'Adductor brevis', 'Adductor magnus',
    ],
    region: 'hip-thigh', subregion: 'hip', view: 'posterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-07',
    filePath: '/anatomy/atlas/muscle-slide-07-anterior-medial-thigh.png',
    slideTitle: 'Slide 7 – Anterior and Medial Thigh Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Rectus femoris', 'Vastus lateralis', 'Vastus medialis', 'Vastus intermedius',
      'Sartorius', 'Gracilis', 'Tensor fasciae latae', 'Pectineus',
      'Adductor longus', 'Adductor brevis', 'Adductor magnus', 'Iliopsoas',
      'Articularis genus', 'Semitendinosus', 'Semimembranosus', 'Biceps femoris',
    ],
    region: 'hip-thigh', subregion: 'hip', view: 'anterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-08',
    filePath: '/anatomy/atlas/muscle-slide-08-posterior-thigh-leg.png',
    slideTitle: 'Slide 8 – Posterior Thigh and Leg Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Biceps femoris', 'Semitendinosus', 'Semimembranosus', 'Popliteus',
      'Gastrocnemius', 'Soleus', 'Plantaris', 'Tibialis posterior',
      'Flexor hallucis longus', 'Flexor digitorum longus', 'Fibularis longus', 'Fibularis brevis',
      'Tibialis anterior', 'Extensor digitorum longus', 'Extensor hallucis longus', 'Fibularis tertius',
    ],
    region: 'lower-leg-foot', subregion: 'knee', view: 'posterior', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-09',
    filePath: '/anatomy/atlas/muscle-slide-09-foot-ankle.png',
    slideTitle: 'Slide 9 – Foot and Ankle Muscles',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Extensor digitorum brevis', 'Extensor hallucis brevis', 'Abductor hallucis', 'Flexor digitorum brevis',
      'Abductor digiti minimi', 'Quadratus plantae', 'Flexor hallucis brevis', 'Adductor hallucis',
      'Flexor digiti minimi brevis', 'Lumbricals', 'Dorsal interossei', 'Plantar interossei',
      'Tibialis posterior', 'Fibularis longus', 'Fibularis brevis', 'Flexor hallucis longus',
    ],
    region: 'lower-leg-foot', subregion: 'ankle-foot', view: 'plantar', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },
  {
    id: 'muscle-slide-10',
    filePath: '/anatomy/atlas/muscle-slide-10-intrinsic-hand-foot.png',
    slideTitle: 'Slide 10 – Intrinsic Hand and Foot Muscle Groups',
    mode: 'atlas-slide',
    panelStructureNames: [
      'Palmar interossei', 'Dorsal interossei (hand)', 'Lumbricals (hand)', 'Abductor pollicis brevis',
      'Flexor pollicis brevis', 'Opponens pollicis', 'Adductor pollicis', 'Abductor digiti minimi (hand)',
      'Flexor digiti minimi brevis (hand)', 'Opponens digiti minimi', 'Lumbricals (foot)', 'Plantar interossei',
      'Dorsal interossei (foot)', 'Flexor digitorum brevis', 'Quadratus plantae', 'Abductor hallucis',
    ],
    region: 'forearm-hand', subregion: 'wrist-hand', view: 'palmar', layer: 'superficial-muscle',
    hotspots: [], credit: AI_GENERATED_CREDIT, licence: AI_GENERATED_LICENCE,
  },

  // --- Bone / landmark atlas images (14) ---
  {
    id: 'bones-named-overview',
    filePath: '/anatomy/atlas/bones-named-overview.png',
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
    filePath: '/anatomy/atlas/landmarks-scapula-humerus.png',
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
    filePath: '/anatomy/atlas/landmarks-elbow-wrist-carpals.png',
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
    filePath: '/anatomy/atlas/bones-hand.png',
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
    filePath: '/anatomy/atlas/landmarks-spine-thorax-overview.png',
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
    filePath: '/anatomy/atlas/bones-pelvis-hip.png',
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
    filePath: '/anatomy/atlas/landmarks-knee.png',
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
    filePath: '/anatomy/atlas/bones-foot.png',
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
    filePath: '/anatomy/atlas/landmarks-16-clinical.png',
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
    filePath: '/anatomy/atlas/bones-landmarks-grouped-overview.png',
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
    filePath: '/anatomy/atlas/spine-atlas-cervical.png',
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
    filePath: '/anatomy/atlas/spine-atlas-thoracic.png',
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
    filePath: '/anatomy/atlas/spine-atlas-lumbar.png',
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
    filePath: '/anatomy/atlas/spine-atlas-sacrum-coccyx.png',
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
];
