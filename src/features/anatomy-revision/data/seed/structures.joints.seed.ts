import type { JointStructure } from '../../types/structure';

/**
 * Joint structures. Started as a CR-014 pilot covering the shoulder-arm complex
 * only; CR-017 widened it to cover all seven Areas (see types/region.ts), which
 * replaced Region as the axis the whole app is studied by. Hand-authored (no
 * source-of-truth file exists for joints, same as structures.bones.seed.ts).
 *
 * Note there is no per-joint area field here: Area derives from `subregion` for
 * every structure in the dataset. The single exception is sacroiliac-joint,
 * which carries an explicit `area` override — see the comment on that entry.
 *
 * DEPTH IS DELIBERATELY UNEVEN. The five original shoulder-arm joints carry the
 * full CR-010 clinical layer (specialTests, commonInjuries, palpationNotes,
 * functionalContext); the joints added by CR-017 carry the core fields only
 * (description, jointType, articulatingStructureIds, movements, stabilizers),
 * plus `clinical` where there is a single well-established point worth making.
 * Authoring 24 more joints' worth of special tests at once would have meant
 * inventing content to fill a shape rather than recording established teaching
 * — the clinical layer is a deliberate later pass, not an oversight.
 *
 * Six of these entries (sacroiliac, facet, costovertebral, distal radioulnar,
 * carpometacarpal of thumb, proximal tibiofibular) were `category: 'landmark'`
 * before CR-017, tagged `groups: [..., 'joint']` but invisible to every joint
 * generator. Their ids and names are preserved exactly, because user progress
 * records are keyed on structureId and linkImages() matches on name/alias.
 *
 * MOVEMENTS MUST COME FROM THE CANONICAL JointMovement UNION (types/structure.ts).
 * multiSelect.ts compares movement strings across joints literally to build the
 * "which movement is NOT possible here" question, so a one-off spelling would
 * generate a confidently wrong answer rather than a type error.
 *
 * `articulatingStructureIds` reference whole bones (humerus, scapula, ...)
 * rather than fine-grained sub-landmarks like "glenoid fossa" or "humeral
 * head" — no landmark entries for those specific sub-regions exist yet in
 * structures.landmarks.upper-limb.seed.ts, and standard teaching describes
 * joints at the whole-bone level anyway ("the shoulder joint forms between
 * the humerus and the scapula").
 *
 * `movements` are the movement names possible at the joint, used both for
 * display and for the "which of these movements is NOT possible here"
 * multi-select question (see lib/questionGenerators/multiSelect.ts).
 *
 * eligibility.locate is false for every entry here: there's no atlas-slide
 * hotspot data pinpointing a joint space specifically (as opposed to the
 * bones that form it), so a locate question would never have anything to
 * click — false is the honest statement of that, not a placeholder.
 *
 * ADD MORE JOINTS HERE: append another JointStructure literal under the right
 * area heading below.
 */
export const JOINT_STRUCTURES: JointStructure[] = [
  {
    id: 'glenohumeral-joint',
    name: 'Glenohumeral Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'shoulder',
    description:
      'The main shoulder joint — a ball-and-socket synovial joint between the head of the humerus and the ' +
      'shallow glenoid cavity of the scapula. Its shallow socket trades stability for the largest range of ' +
      'motion of any joint in the body, which is why it relies so heavily on the rotator cuff and labrum for ' +
      'dynamic and static stability rather than bony congruence.',
    jointType: 'ball-and-socket',
    articulatingStructureIds: ['humerus', 'scapula'],
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal rotation', 'External rotation', 'Circumduction'],
    stabilizers: ['Rotator cuff (supraspinatus, infraspinatus, teres minor, subscapularis)', 'Glenoid labrum', 'Glenohumeral ligaments', 'Long head of biceps tendon'],
    aliases: ['Shoulder joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'shoulder'],
    palpationNotes: 'Palpate anteriorly just medial to the head of humerus with the arm relaxed, or posteriorly below the scapular spine — the joint line itself is deep and not directly palpable, unlike the bony landmarks around it.',
    specialTests: [
      {
        name: 'Apprehension Test',
        description: 'With the patient supine, passively abduct and externally rotate the shoulder to 90°.',
        positiveFinding: 'A look or feeling of apprehension (fear of dislocation), not necessarily pain, suggests anterior instability.',
      },
      {
        name: 'Sulcus Sign',
        description: 'With the arm relaxed at the side, pull the humerus distally.',
        positiveFinding: 'A visible sulcus (dimple) below the acromion suggests inferior glenohumeral instability.',
      },
    ],
    commonInjuries: [
      {
        name: 'Anterior shoulder dislocation',
        mechanism: 'A fall onto an outstretched, abducted and externally rotated arm — by far the most common direction of dislocation.',
        presentation: 'Visible deformity (loss of the normal deltoid contour), severe pain, and the arm held in slight abduction and external rotation.',
      },
      {
        name: 'Labral tear (SLAP lesion)',
        mechanism: 'Repetitive overhead throwing, or a fall onto an outstretched arm.',
        presentation: 'Deep, poorly localised shoulder pain, sometimes with catching or clicking, worse with overhead activity.',
      },
    ],
    functionalContext: 'Every overhead reaching, throwing, and lifting task relies on this joint\'s exceptional range of motion.',
  },
  {
    id: 'acromioclavicular-joint',
    name: 'Acromioclavicular Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'shoulder',
    description:
      'A small plane synovial joint between the lateral end of the clavicle and the acromion of the scapula. ' +
      'It allows only small gliding and rotational movements, but is essential for the scapula to rotate ' +
      'smoothly against the clavicle during arm elevation.',
    jointType: 'plane',
    articulatingStructureIds: ['clavicle', 'scapula'],
    // Rotation here is accessory, occurring during scapular movement rather than as a
    // volitional motion — that nuance lives in the description above, not in the movement
    // string. CR-017: the string must stay canonical, since the sternoclavicular joint also
    // lists 'Rotation' and the odd-one-out generator compares these literally.
    movements: ['Gliding', 'Rotation'],
    stabilizers: ['Acromioclavicular ligament', 'Coracoclavicular ligament (conoid and trapezoid parts)'],
    aliases: ['AC joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'shoulder'],
    palpationNotes: 'Easily palpable as a small bony step or bump where the distal clavicle meets the acromion, at the very top of the shoulder.',
    specialTests: [
      {
        name: 'Cross-Body Adduction Test (Scarf Test)',
        description: 'Passively adduct the arm horizontally across the chest.',
        positiveFinding: 'Pain localised to the AC joint suggests AC joint pathology.',
      },
    ],
    commonInjuries: [
      {
        name: 'AC joint separation (sprain)',
        mechanism: 'A fall directly onto the point of the shoulder (e.g. in rugby or cycling), rather than onto an outstretched arm.',
        presentation: 'Pain and tenderness directly over the AC joint; a visible "step deformity" if the coracoclavicular ligaments are also torn (higher-grade separation).',
      },
    ],
    functionalContext: 'Transmits load from the arm to the clavicle and axial skeleton, and lets the scapula rotate upward during overhead reaching.',
  },
  {
    id: 'sternoclavicular-joint',
    name: 'Sternoclavicular Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'shoulder',
    description:
      'A saddle-shaped synovial joint between the medial end of the clavicle and the manubrium of the sternum, ' +
      'with an articular disc that lets it move somewhat like a ball-and-socket joint despite its saddle shape. ' +
      'It is the only joint directly connecting the upper limb to the axial skeleton.',
    jointType: 'saddle',
    articulatingStructureIds: ['clavicle'],
    movements: ['Elevation', 'Depression', 'Protraction', 'Retraction', 'Rotation'],
    stabilizers: ['Sternoclavicular ligaments', 'Costoclavicular ligament', 'Interclavicular ligament', 'Articular disc'],
    aliases: ['SC joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'shoulder'],
    palpationNotes: 'Readily palpable at the medial end of the clavicle, immediately lateral to the sternal notch.',
    commonInjuries: [
      {
        name: 'Sternoclavicular joint dislocation',
        mechanism: 'A high-energy direct blow or indirect force through the shoulder; anterior dislocation is far more common than posterior.',
        presentation: 'Anterior: a visible/palpable prominence at the joint. Posterior (rare but more serious): can compress mediastinal structures — a genuine emergency, not just an orthopaedic injury.',
      },
    ],
    functionalContext: 'Every degree of shoulder elevation above the arm hanging at the side involves some rotation at this joint — it is the base the whole shoulder girdle moves from.',
  },
  {
    id: 'humeroulnar-joint',
    name: 'Humeroulnar Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'elbow',
    description:
      'The main hinge joint of the elbow, between the trochlea of the humerus and the trochlear notch of the ' +
      'ulna. As a true hinge joint it permits flexion and extension only — no rotation, unlike the neighbouring ' +
      'proximal radioulnar joint within the same joint capsule.',
    jointType: 'hinge',
    articulatingStructureIds: ['humerus', 'ulna'],
    movements: ['Flexion', 'Extension'],
    stabilizers: ['Ulnar (medial) collateral ligament', 'Radial (lateral) collateral ligament', 'Joint capsule'],
    aliases: ['Elbow hinge joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'elbow'],
    palpationNotes: 'Palpate the joint line between the olecranon and the medial/lateral epicondyles with the elbow flexed to about 90°.',
    specialTests: [
      {
        name: 'Valgus Stress Test',
        description: 'With the elbow flexed to about 20-30°, apply a valgus (outward-bending) force.',
        positiveFinding: 'Excessive gapping or pain on the medial side suggests ulnar collateral ligament insufficiency.',
      },
      {
        name: 'Varus Stress Test',
        description: 'With the elbow flexed to about 20-30°, apply a varus (inward-bending) force.',
        positiveFinding: 'Excessive gapping or pain on the lateral side suggests radial collateral ligament insufficiency.',
      },
    ],
    commonInjuries: [
      {
        name: 'Elbow dislocation',
        mechanism: 'A fall onto an outstretched hand with the elbow extended — posterior dislocation is the most common direction.',
        presentation: 'Visible deformity, severe pain, and inability to move the elbow; check distal pulses and nerve function given the joint\'s proximity to the brachial artery and major nerves.',
      },
      {
        name: 'Ulnar collateral ligament sprain',
        mechanism: 'Repetitive valgus overload from overhead throwing (the classic baseball-pitching injury).',
        presentation: 'Medial elbow pain during the throwing motion, sometimes with a feeling of instability.',
      },
    ],
    functionalContext: 'Elbow flexion/extension at this joint is what brings the hand to the mouth or extends the arm to push or reach.',
  },
  {
    id: 'proximal-radioulnar-joint',
    name: 'Proximal Radioulnar Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'elbow',
    description:
      'A pivot synovial joint between the head of the radius and the radial notch of the ulna, held in place by ' +
      'the annular ligament. It works together with the distal radioulnar joint to allow the radius to rotate ' +
      'around the ulna, producing pronation and supination of the forearm.',
    jointType: 'pivot',
    articulatingStructureIds: ['radius', 'ulna'],
    movements: ['Pronation', 'Supination'],
    stabilizers: ['Annular ligament', 'Quadrate ligament'],
    aliases: ['Superior radioulnar joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'elbow'],
    palpationNotes: 'Palpate the radial head just distal to the lateral epicondyle — it can be felt rotating under the fingers during active pronation and supination.',
    commonInjuries: [
      {
        name: 'Radial head subluxation ("pulled elbow" / nursemaid\'s elbow)',
        mechanism: 'A sudden pulling force on a young child\'s extended, pronated arm (e.g. lifting or swinging a child by the hand) — the annular ligament slips over the radial head.',
        presentation: 'The child refuses to use the arm and holds it slightly flexed and pronated, with no visible deformity or swelling.',
      },
      {
        name: 'Radial head fracture',
        mechanism: 'A fall onto an outstretched hand, transmitting force up through the radius into the elbow.',
        presentation: 'Lateral elbow pain and swelling, with pain specifically on pronation/supination rather than flexion/extension.',
      },
    ],
    functionalContext: 'Pronation and supination at this joint is what lets the hand turn palm-up or palm-down — turning a key, a screwdriver, or a doorknob.',
  },
  // ---------------------------------------------------------------------------
  // ELBOW
  // ---------------------------------------------------------------------------
  {
    id: 'humeroradial-joint',
    name: 'Humeroradial Joint',
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'elbow',
    description:
      'The lateral compartment of the elbow, between the capitulum of the humerus and the head of the radius. ' +
      'It is classified as a ball-and-socket joint by shape, but the annular ligament and its shared capsule ' +
      'with the humeroulnar joint restrict it to flexion/extension plus the rotation of pronation and ' +
      'supination — a rare case where classification by shape overstates the movement actually available.',
    jointType: 'ball-and-socket',
    articulatingStructureIds: ['humerus', 'radius'],
    movements: ['Flexion', 'Extension', 'Pronation', 'Supination'],
    stabilizers: ['Radial (lateral) collateral ligament', 'Annular ligament', 'Joint capsule shared with the humeroulnar joint'],
    aliases: ['Radiocapitellar joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'elbow'],
  },

  // ---------------------------------------------------------------------------
  // WRIST & HAND
  // ---------------------------------------------------------------------------
  {
    id: 'radiocarpal-joint',
    name: 'Radiocarpal Joint',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'The wrist joint proper — a condyloid synovial joint between the distal radius (with the triangular ' +
      'fibrocartilage complex) and the proximal row of carpal bones. No forearm rotation happens here: ' +
      'pronation and supination belong to the radioulnar joints, and the radiocarpal joint simply travels ' +
      'with the radius as it turns.',
    jointType: 'condyloid',
    articulatingStructureIds: ['radius', 'carpals'],
    movements: ['Flexion', 'Extension', 'Radial deviation', 'Ulnar deviation', 'Circumduction'],
    stabilizers: ['Palmar and dorsal radiocarpal ligaments', 'Radial and ulnar collateral ligaments', 'Triangular fibrocartilage complex (TFCC)'],
    aliases: ['Wrist joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: ['synovial', 'wrist'],
  },
  {
    id: 'distal-radioulnar-joint',
    name: 'Distal Radioulnar Joint',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'A pivot synovial joint between the head of the ulna and the ulnar notch of the radius, working with the ' +
      'proximal radioulnar joint to allow forearm pronation and supination. The triangular fibrocartilage ' +
      'complex both stabilises the joint and separates it from the radiocarpal joint.',
    jointType: 'pivot',
    articulatingStructureIds: ['radius', 'ulna'],
    movements: ['Pronation', 'Supination'],
    stabilizers: ['Triangular fibrocartilage complex (TFCC)', 'Palmar and dorsal radioulnar ligaments'],
    aliases: ['DRUJ'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'wrist'],
    clinical: 'Instability here (often with TFCC injury) causes ulnar-sided wrist pain, commonly from a fall on a pronated, outstretched hand.',
  },
  {
    id: 'midcarpal-joint',
    name: 'Midcarpal Joint',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'The compound plane joint between the proximal and distal rows of carpal bones. It contributes roughly ' +
      'half of total wrist flexion and extension, which is why wrist movement is only partly lost when the ' +
      'radiocarpal joint alone is fused.',
    jointType: 'plane',
    articulatingStructureIds: ['carpals'],
    movements: ['Flexion', 'Extension', 'Radial deviation', 'Ulnar deviation'],
    stabilizers: ['Interosseous, palmar and dorsal intercarpal ligaments', 'Scapholunate and lunotriquetral ligaments'],
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'wrist'],
  },
  {
    id: 'carpometacarpal-joint-thumb',
    name: 'Carpometacarpal Joint of Thumb',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'The saddle joint between the trapezium and the base of the first metacarpal. Its saddle geometry is ' +
      'what gives the thumb opposition — the movement that makes the human hand prehensile — at the cost of ' +
      'being one of the least bony-stable joints in the hand.',
    jointType: 'saddle',
    articulatingStructureIds: ['carpals', 'metacarpals'],
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Opposition', 'Reposition', 'Circumduction'],
    stabilizers: ['Anterior and posterior oblique ligaments', 'Intermetacarpal ligament', 'Thenar muscles'],
    aliases: ['CMC joint of thumb', 'First carpometacarpal joint', 'Trapeziometacarpal joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'wrist'],
    clinical: 'One of the most common sites of hand osteoarthritis ("thumb base arthritis").',
  },
  {
    id: 'metacarpophalangeal-joint',
    name: 'Metacarpophalangeal Joint',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'The knuckle joints, between the heads of the metacarpals and the bases of the proximal phalanges. ' +
      'Abduction and adduction (spreading the fingers) are only possible with the joint extended — the ' +
      'collateral ligaments tighten in flexion, which is why these joints are splinted in flexion to stop ' +
      'them stiffening.',
    jointType: 'condyloid',
    articulatingStructureIds: ['metacarpals', 'phalanges-proximal-hand'],
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Circumduction'],
    stabilizers: ['Collateral ligaments', 'Palmar plate', 'Deep transverse metacarpal ligament'],
    aliases: ['MCP joint', 'Knuckle joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'wrist'],
  },
  {
    id: 'interphalangeal-joint-hand',
    name: 'Interphalangeal Joint of the Hand',
    category: 'joint',
    region: 'forearm-hand',
    subregion: 'wrist-hand',
    description:
      'The hinge joints between adjacent phalanges — proximal (PIP) and distal (DIP) in the fingers, and a ' +
      'single IP joint in the thumb. As true hinges they permit flexion and extension only, with no abduction ' +
      'or rotation at all.',
    jointType: 'hinge',
    articulatingStructureIds: ['phalanges-proximal-hand', 'phalanges-middle-hand', 'phalanges-distal-hand'],
    movements: ['Flexion', 'Extension'],
    stabilizers: ['Collateral ligaments', 'Palmar plate'],
    aliases: ['IP joint', 'PIP joint', 'DIP joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: ['synovial', 'wrist'],
  },

  // ---------------------------------------------------------------------------
  // HIP
  // ---------------------------------------------------------------------------
  {
    id: 'hip-joint',
    name: 'Hip Joint',
    category: 'joint',
    region: 'hip-thigh',
    subregion: 'hip',
    description:
      'A ball-and-socket synovial joint between the head of the femur and the deep acetabulum of the pelvis. ' +
      'It is the direct counterpart to the glenohumeral joint, and the comparison is the point: the deep, ' +
      'labrum-rimmed socket here trades range of motion for the bony stability the shoulder gives up.',
    jointType: 'ball-and-socket',
    articulatingStructureIds: ['femur', 'pelvis', 'acetabulum'],
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal rotation', 'External rotation', 'Circumduction'],
    stabilizers: ['Iliofemoral, pubofemoral and ischiofemoral ligaments', 'Acetabular labrum', 'Ligamentum teres', 'Deep gluteal and short external rotator muscles'],
    aliases: ['Acetabulofemoral joint', 'Coxofemoral joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: ['synovial', 'hip'],
  },
  {
    id: 'sacroiliac-joint',
    name: 'Sacroiliac Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'spine',
    // The one structure in the dataset whose area is not the one its subregion implies:
    // it sits in the spine subregion anatomically, but is examined and revised as part
    // of the hip/pelvis complex. Everything else derives (see areaOf in types/structure.ts).
    area: 'hip',
    description:
      'The joint between the auricular surfaces of the sacrum and ilium, transferring load between the spine ' +
      'and the lower limbs. It is a synovial joint with unusually strong ligamentous reinforcement and very ' +
      'limited movement — the little that occurs (nutation and counternutation) is a gliding motion, not a ' +
      'range you can voluntarily produce.',
    jointType: 'plane',
    articulatingStructureIds: ['sacrum', 'ilium'],
    movements: ['Gliding'],
    stabilizers: ['Anterior and posterior sacroiliac ligaments', 'Sacrotuberous ligament', 'Sacrospinous ligament'],
    aliases: ['SI joint', 'Sacroiliac joint region', 'Sacroiliac Articular Surface'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'pelvis', 'spine'],
    clinical: 'A common source of low back/buttock pain (SI joint dysfunction), often assessed with provocation tests (e.g. FABER, thigh thrust).',
  },
  {
    id: 'pubic-symphysis',
    name: 'Pubic Symphysis',
    category: 'joint',
    region: 'hip-thigh',
    subregion: 'hip',
    description:
      'The midline secondary cartilaginous joint between the two pubic bones, united by an interpubic ' +
      'fibrocartilaginous disc. Not a synovial joint at all — it permits only slight gliding, and softens ' +
      'under relaxin in late pregnancy to let the pelvic ring widen for delivery.',
    jointType: 'symphysis',
    articulatingStructureIds: ['pubis', 'pelvis'],
    movements: ['Gliding'],
    stabilizers: ['Superior pubic ligament', 'Inferior (arcuate) pubic ligament', 'Interpubic fibrocartilaginous disc'],
    aliases: ['Symphysis pubis'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['cartilaginous', 'pelvis'],
    clinical: 'Pelvic girdle pain in pregnancy (symphysis pubis dysfunction) and osteitis pubis in kicking/pivoting athletes both centre on this joint.',
  },

  // ---------------------------------------------------------------------------
  // KNEE
  // ---------------------------------------------------------------------------
  {
    id: 'tibiofemoral-joint',
    name: 'Tibiofemoral Joint',
    category: 'joint',
    region: 'hip-thigh',
    subregion: 'knee',
    description:
      'The main knee joint, between the femoral condyles and the tibial plateau. Usually called a hinge, but a ' +
      'modified one: the rotation available in flexion is what allows the "screw-home" mechanism that locks ' +
      'the knee in full extension, and it is that rotation under load that tears menisci and cruciates.',
    jointType: 'hinge',
    articulatingStructureIds: ['femur', 'tibia'],
    movements: ['Flexion', 'Extension', 'Internal rotation', 'External rotation'],
    stabilizers: ['Anterior and posterior cruciate ligaments', 'Medial and lateral collateral ligaments', 'Medial and lateral menisci', 'Quadriceps and patellar tendon'],
    aliases: ['Knee joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: ['synovial', 'knee'],
  },
  {
    id: 'patellofemoral-joint',
    name: 'Patellofemoral Joint',
    category: 'joint',
    region: 'hip-thigh',
    subregion: 'knee',
    description:
      'The articulation between the posterior surface of the patella and the trochlear groove of the femur, ' +
      'sharing a capsule with the tibiofemoral joint. The patella acts as a pulley that increases the ' +
      'quadriceps lever arm, and tracks through the groove as the knee flexes and extends.',
    jointType: 'plane',
    articulatingStructureIds: ['patella', 'femur'],
    movements: ['Gliding'],
    stabilizers: ['Medial patellofemoral ligament', 'Vastus medialis obliquus', 'Depth of the trochlear groove', 'Patellar retinacula'],
    aliases: ['PFJ'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'knee'],
    clinical: 'Patellofemoral pain syndrome is one of the most common causes of anterior knee pain, and lateral patellar dislocation typically tears the medial patellofemoral ligament.',
  },
  {
    id: 'proximal-tibiofibular-joint',
    name: 'Proximal Tibiofibular Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'knee',
    description:
      'A small plane synovial joint between the head of the fibula and the lateral condyle of the tibia, just ' +
      'below the knee. It takes no significant weight-bearing load itself, but dissipates torsional forces ' +
      'travelling up the fibula from the ankle.',
    jointType: 'plane',
    articulatingStructureIds: ['tibia', 'fibula'],
    movements: ['Gliding'],
    stabilizers: ['Anterior and posterior ligaments of the fibular head', 'Biceps femoris tendon', 'Lateral collateral ligament'],
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'knee'],
    clinical: 'The common fibular nerve wraps the fibular neck immediately distal to this joint, so injury or surgery here risks a foot drop.',
  },

  // ---------------------------------------------------------------------------
  // ANKLE & FOOT
  // ---------------------------------------------------------------------------
  {
    id: 'talocrural-joint',
    name: 'Talocrural Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    description:
      'The ankle joint proper — a hinge between the mortise formed by the distal tibia and fibula and the ' +
      'trochlea of the talus. Inversion and eversion are not available here, despite being "ankle movements" ' +
      'in everyday speech: they belong to the subtalar joint below it.',
    jointType: 'hinge',
    articulatingStructureIds: ['tibia', 'fibula', 'talus'],
    movements: ['Dorsiflexion', 'Plantarflexion'],
    stabilizers: ['Deltoid (medial) ligament', 'Lateral ligament complex (anterior talofibular, calcaneofibular, posterior talofibular)', 'Bony congruence of the mortise'],
    aliases: ['Ankle joint', 'Mortise joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'easy',
    tags: ['synovial', 'ankle'],
  },
  {
    id: 'subtalar-joint',
    name: 'Subtalar Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    description:
      'The joint between the talus and the calcaneus, below the ankle joint proper. This is where inversion ' +
      'and eversion happen — the movements commonly but wrongly attributed to the ankle joint — and it is the ' +
      'inversion mechanism here that produces the classic lateral ankle sprain.',
    jointType: 'plane',
    articulatingStructureIds: ['talus', 'calcaneus'],
    movements: ['Inversion', 'Eversion'],
    stabilizers: ['Interosseous talocalcaneal ligament', 'Cervical ligament', 'Calcaneofibular ligament'],
    aliases: ['Talocalcaneal joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'ankle'],
  },
  {
    id: 'distal-tibiofibular-joint',
    name: 'Distal Tibiofibular Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    description:
      'A fibrous joint (syndesmosis) binding the distal tibia and fibula together with no joint cavity. It is ' +
      'not synovial and permits almost no movement — but that rigidity is the point, since it holds the ankle ' +
      'mortise closed around the talus.',
    jointType: 'syndesmosis',
    articulatingStructureIds: ['tibia', 'fibula'],
    movements: ['Gliding'],
    stabilizers: ['Anterior and posterior inferior tibiofibular ligaments', 'Interosseous ligament and membrane'],
    aliases: ['Ankle syndesmosis', 'Inferior tibiofibular joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['fibrous', 'ankle'],
    clinical: 'A "high ankle sprain" is an injury to this syndesmosis, and takes considerably longer to recover than a lateral ankle sprain.',
  },
  {
    id: 'transverse-tarsal-joint',
    name: 'Transverse Tarsal Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    description:
      'The combined talonavicular and calcaneocuboid joints, forming an S-shaped line across the midfoot. It ' +
      'works with the subtalar joint to let the foot alternate between a mobile shock absorber at heel strike ' +
      'and a rigid lever at push-off.',
    jointType: 'plane',
    articulatingStructureIds: ['talus', 'calcaneus', 'tarsals'],
    movements: ['Inversion', 'Eversion'],
    stabilizers: ['Spring (plantar calcaneonavicular) ligament', 'Bifurcate ligament', 'Long and short plantar ligaments'],
    aliases: ['Midtarsal joint', 'Chopart joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'foot'],
  },
  {
    id: 'metatarsophalangeal-joint',
    name: 'Metatarsophalangeal Joint',
    category: 'joint',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    description:
      'The joints between the metatarsal heads and the proximal phalanges of the toes. The first MTP joint ' +
      'carries the most load of any joint in the foot at push-off, which is why it dominates forefoot ' +
      'pathology.',
    jointType: 'condyloid',
    articulatingStructureIds: ['metatarsals', 'phalanges-proximal-foot'],
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction'],
    stabilizers: ['Collateral ligaments', 'Plantar plate', 'Deep transverse metatarsal ligament'],
    aliases: ['MTP joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'foot'],
    clinical: 'Hallux valgus (bunion) and hallux rigidus both affect the first MTP joint; "turf toe" is a hyperextension sprain of its plantar plate.',
  },

  // ---------------------------------------------------------------------------
  // BACK & CORE (TRUNK)
  // ---------------------------------------------------------------------------
  {
    id: 'intervertebral-joint',
    name: 'Intervertebral Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'spine',
    description:
      'The secondary cartilaginous joint between adjacent vertebral bodies, united by an intervertebral disc. ' +
      'Each individual joint moves only slightly, but summed over the whole column they produce the entire ' +
      'range of spinal movement. Each spinal segment is really a three-joint complex: this joint anteriorly, ' +
      'plus the paired facet joints posteriorly.',
    jointType: 'symphysis',
    articulatingStructureIds: ['vertebral-body', 'intervertebral-disc'],
    movements: ['Flexion', 'Extension', 'Lateral flexion', 'Rotation'],
    stabilizers: ['Anterior longitudinal ligament', 'Posterior longitudinal ligament', 'Anulus fibrosus of the intervertebral disc'],
    aliases: ['Interbody joint', 'Intervertebral disc joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['cartilaginous', 'spine'],
    clinical: 'Disc herniation here compresses the nerve root exiting nearby — the anatomical basis of sciatica and cervical radiculopathy.',
  },
  {
    id: 'facet-joint',
    name: 'Facet (Zygapophyseal) Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'spine',
    description:
      'The paired plane synovial joints between the superior and inferior articular processes of adjacent ' +
      'vertebrae. Their facet orientation is what decides which movements each spinal region allows — near-' +
      'horizontal in the cervical spine (free rotation), near-sagittal in the lumbar spine (rotation blocked).',
    jointType: 'plane',
    articulatingStructureIds: ['cervical-vertebrae', 'thoracic-vertebrae', 'lumbar-vertebrae'],
    movements: ['Gliding'],
    stabilizers: ['Facet joint capsule', 'Ligamentum flavum'],
    aliases: ['Zygapophyseal Joint', 'Lumbar Facet Joint', 'Thoracic Zygapophyseal (Facet) Joint', 'Apophyseal joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: ['synovial', 'spine'],
    clinical: 'A common source of mechanical back/neck pain (facet joint syndrome) and target for diagnostic/therapeutic medial branch blocks.',
  },
  {
    id: 'atlanto-occipital-joint',
    name: 'Atlanto-occipital Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'neck',
    description:
      'The paired condyloid joints between the occipital condyles of the skull and the superior articular ' +
      'facets of the atlas (C1). This is the "yes" joint — it provides most of the nodding movement of the ' +
      'head, and essentially no rotation.',
    jointType: 'condyloid',
    articulatingStructureIds: ['atlas-c1'],
    movements: ['Flexion', 'Extension', 'Lateral flexion'],
    stabilizers: ['Anterior and posterior atlanto-occipital membranes', 'Alar ligaments', 'Joint capsules'],
    aliases: ['AO joint', 'C0-C1 joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'neck'],
  },
  {
    id: 'atlantoaxial-joint',
    name: 'Atlantoaxial Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'neck',
    description:
      'The pivot joint between the atlas (C1) and the dens of the axis (C2). This is the "no" joint — it ' +
      'supplies roughly half of all cervical rotation, far more than any other single segment, and the ' +
      'transverse ligament holding the dens against the atlas is what keeps that rotation off the spinal cord.',
    jointType: 'pivot',
    articulatingStructureIds: ['atlas-c1', 'axis-c2'],
    movements: ['Rotation'],
    stabilizers: ['Transverse ligament of the atlas', 'Alar ligaments', 'Cruciate ligament complex'],
    aliases: ['AA joint', 'C1-C2 joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'neck'],
    clinical: 'Transverse ligament laxity (rheumatoid arthritis, Down syndrome) risks atlantoaxial instability and cord compression — a specific contraindication to high-velocity cervical manipulation.',
  },
  {
    id: 'costovertebral-joint',
    name: 'Costovertebral Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'spine',
    description:
      'The plane synovial joint between the head of a rib and the costal facets on the bodies of the thoracic ' +
      'vertebrae. Together with the costotransverse joints it sets the axis each rib swings on during ' +
      'breathing.',
    jointType: 'plane',
    articulatingStructureIds: ['ribs', 'thoracic-vertebrae'],
    movements: ['Gliding', 'Rotation'],
    stabilizers: ['Radiate ligament of the rib head', 'Intra-articular ligament', 'Costotransverse ligaments'],
    aliases: ['Rib Articulation to Thoracic Vertebra'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'spine', 'thorax'],
  },
  {
    id: 'sternocostal-joint',
    name: 'Sternocostal Joint',
    category: 'joint',
    region: 'back-core',
    subregion: 'torso',
    description:
      'The joints between the costal cartilages of ribs 1-7 and the sternum. The first is a synchondrosis ' +
      'with no movement at all; the second to seventh are plane synovial joints that glide as the ribcage ' +
      'expands.',
    jointType: 'plane',
    articulatingStructureIds: ['sternum', 'ribs'],
    movements: ['Gliding'],
    stabilizers: ['Radiate sternocostal ligaments', 'Costal cartilages', 'Intra-articular sternocostal ligament'],
    aliases: ['Sternochondral joint'],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'hard',
    tags: ['synovial', 'thorax'],
    clinical: 'Costochondritis (Tietze syndrome when swollen) causes reproducible anterior chest wall pain on palpation here — a common benign mimic of cardiac chest pain.',
  },
];
