import type { JointStructure } from '../../types/structure';

/**
 * Joint structures (CR-014) — a pilot vertical slice covering the
 * shoulder-arm complex, mirroring how CR-010 piloted the clinical layer on
 * this same region before considering wider rollout. Hand-authored (no
 * source-of-truth file exists for joints, same as structures.bones.seed.ts)
 * at full clinical depth for the fields that have genuinely well-established
 * content — not every field is forced for every joint; see individual
 * entries for what's deliberately omitted and why.
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
 * ADD MORE JOINTS HERE: append another JointStructure literal.
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
    movements: ['Gliding', 'Rotation (accessory, during scapular movement)'],
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
];
