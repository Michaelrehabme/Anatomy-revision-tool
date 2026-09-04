import type { Area, Region, SubRegion } from './region';
import { areaForSubRegion } from './region';

export type Category = 'muscle' | 'bone' | 'landmark' | 'joint';

/**
 * Joint classification. The first six are the standard synovial classifications
 * (distinguished by shape/range of motion) and were the whole union in CR-014's
 * shoulder-arm pilot, where every joint happened to be synovial. CR-017's wider
 * roster forced the two non-synovial entries: several of the most important
 * joints in the body — the intervertebral discs, the pubic symphysis, the distal
 * tibiofibular syndesmosis — are cartilaginous or fibrous, and omitting them to
 * keep the union tidy would have gutted the back & core group.
 */
export type JointType =
  | 'ball-and-socket'
  | 'hinge'
  | 'pivot'
  | 'saddle'
  | 'plane'
  | 'condyloid'
  | 'symphysis'
  | 'syndesmosis';

/**
 * Display form for each joint type, used for MCQ choices and fact lines alike.
 * A lookup rather than a `.replace(/-/g, ' ') + ' joint'` mangle because that
 * produces "symphysis joint" / "syndesmosis joint", which are not things.
 */
export const JOINT_TYPE_LABELS: Record<JointType, string> = {
  'ball-and-socket': 'ball-and-socket joint',
  hinge: 'hinge joint',
  pivot: 'pivot joint',
  saddle: 'saddle joint',
  plane: 'plane joint',
  condyloid: 'condyloid joint',
  symphysis: 'secondary cartilaginous joint (symphysis)',
  syndesmosis: 'fibrous joint (syndesmosis)',
};

/**
 * Display names for the muscle groups worth offering as a study scope
 * (CR-018). A lookup for the same reason JOINT_TYPE_LABELS is one: a
 * `.replace(/-/g, ' ')` mangle yields "Anterior superficial", "Midpalmar"
 * and "Segmental", which name nothing a student would recognise, and it
 * cannot say which limb "Anterior compartment" belongs to — the forearm and
 * the leg both have one.
 *
 * Deliberately a subset of the 44 authored group tags. The rest are either
 * duplicates of an entry here (`knee-extensors` is the same four muscles as
 * `quadriceps`) or too broad to be a useful scope (`shoulder`, `arm`,
 * `core`). Groups are still matched on the full tag set — this only controls
 * what the picker offers.
 */
export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  hamstrings: 'Hamstrings',
  quadriceps: 'Quadriceps',
  'hip-flexors': 'Hip flexors',
  'hip-adductors': 'Hip adductors',
  'hip-abductors': 'Hip abductors',
  'hip-extensors': 'Hip extensors',
  'hip-external-rotators': 'Deep hip rotators',
  'anterior-compartment': 'Leg — anterior compartment',
  'lateral-compartment': 'Leg — lateral compartment',
  'posterior-compartment': 'Calf — superficial',
  'deep-posterior-compartment': 'Calf — deep',
  'intrinsic-foot': 'Intrinsic foot muscles',
  'rotator-cuff': 'Rotator cuff',
  scapular: 'Scapular muscles',
  chest: 'Chest',
  'elbow-flexors': 'Elbow flexors',
  'elbow-extensors': 'Elbow extensors',
  'anterior-superficial': 'Forearm flexors — superficial',
  'anterior-deep': 'Forearm flexors — deep',
  'posterior-superficial': 'Forearm extensors — superficial',
  'posterior-deep': 'Forearm extensors — deep',
  thenar: 'Thenar muscles',
  hypothenar: 'Hypothenar muscles',
  'intrinsic-hand': 'Intrinsic hand muscles',
  'erector-spinae': 'Erector spinae',
  transversospinales: 'Transversospinales',
  neck: 'Neck',
  breathing: 'Muscles of breathing',
};

/**
 * Canonical movement vocabulary for joints (CR-017). Deliberately a closed
 * union rather than free text, because multiSelect.ts's "which movement is NOT
 * possible here" generator compares movement strings across joints literally:
 * if one joint said 'Medial rotation' and another 'Internal rotation', it would
 * confidently assert that medial rotation is impossible at the glenohumeral
 * joint. With CR-014's 5 joints that never bit; across 29 it would have.
 */
export const JOINT_MOVEMENTS = [
  'Flexion',
  'Extension',
  'Lateral flexion',
  'Abduction',
  'Adduction',
  'Internal rotation',
  'External rotation',
  'Rotation',
  'Circumduction',
  'Pronation',
  'Supination',
  'Elevation',
  'Depression',
  'Protraction',
  'Retraction',
  'Opposition',
  'Reposition',
  'Radial deviation',
  'Ulnar deviation',
  'Dorsiflexion',
  'Plantarflexion',
  'Inversion',
  'Eversion',
  'Gliding',
] as const;

export type JointMovement = (typeof JOINT_MOVEMENTS)[number];

/**
 * Accessory movements that occur at virtually every synovial joint. A joint's
 * `movements` list may name them, but they can never truthfully be the answer
 * to "which movement is NOT possible here" — gliding happens at the
 * tibiofemoral joint too, even though only flexion/extension/rotation are worth
 * listing there.
 */
export const UNIVERSAL_ACCESSORY_MOVEMENTS: JointMovement[] = ['Gliding'];

/**
 * Movement names that describe the same underlying motion under different
 * regional conventions. Radial/ulnar deviation *is* wrist abduction/adduction,
 * and cervical 'Rotation' is the same motion the limbs call internal/external
 * rotation — so neither member of a group may serve as the odd-one-out against
 * a joint that lists another member, or the question asserts something false.
 */
export const EQUIVALENT_MOVEMENT_GROUPS: JointMovement[][] = [
  ['Abduction', 'Radial deviation'],
  ['Adduction', 'Ulnar deviation'],
  ['Rotation', 'Internal rotation', 'External rotation'],
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface NerveRef {
  name: string;
  roots: string[];
}

export interface QuestionEligibility {
  flashcard: boolean;
  mcq: boolean;
  locate: boolean;
}

export interface StructureSource {
  deck?: string;
  author?: string;
  slides?: number[];
}

interface AnatomyStructureBase {
  id: string;
  name: string;
  latin?: string | null;
  region: Region;
  subregion?: SubRegion;
  /**
   * Overrides the area derived from `subregion` (CR-017). Author this ONLY when
   * the derived value is genuinely wrong — currently just sacroiliac-joint, which
   * is subregion 'spine' but is examined as part of the hip/pelvis complex. Every
   * other structure derives correctly, so leaving this unset is the norm.
   */
  area?: Area;
  /** Functional/anatomical groups, e.g. "hip-flexors", "rotator-cuff". */
  groups?: string[];
  /** Short educational summary. Muscles mirror actionText; bones/landmarks are authored directly. */
  description: string;
  /** Synonyms/accepted alternate names, e.g. TA2 English/Latin terms. */
  aliases: string[];
  /** AnatomyImageAsset ids this structure appears in. */
  imageIds: string[];
  eligibility: QuestionEligibility;
  difficulty: Difficulty;
  tags: string[];
  clinical?: string | null;
  notes?: string | null;
  needsReview?: boolean;
  source?: StructureSource | null;
  /** Readable respelling, e.g. "FLEK-sor ha-LOO-sis LONG-us" — survives being read silently, unlike audio. Authored for the 122 muscles first (CR-011). */
  phoneticSpelling?: string;
  /** Hand-recorded pronunciation, overriding Web Speech synthesis when present. None recorded yet — see CR-011. */
  audioUrl?: string;

  // --- Clinical layer (CR-010), aimed at physio/sports-therapy students rather than
  // medical students. All optional — existing content stays valid without them.
  /** Nerve root(s) tested by resisted contraction in the standard bedside myotome exam, e.g. ['C5','C6'] — only set for structures actually used in that exam, not every muscle with a root contribution. */
  myotome?: string[];
  /** The dermatome typically examined alongside this structure's myotome, for context rather than direct equivalence. */
  dermatomeRelation?: string;
  /** How to actually find this structure on a person. */
  palpationNotes?: string;
  commonInjuries?: { name: string; mechanism: string; presentation: string }[];
  /** Where sensitivity/specificity is disputed in the literature, say so in `description` rather than presenting one figure as settled. */
  specialTests?: { name: string; description: string; positiveFinding: string }[];
  referredPainPattern?: string;
  /** Everyday or sporting movements this structure loads. */
  functionalContext?: string;
}

export interface MuscleStructure extends AnatomyStructureBase {
  category: 'muscle';
  /** e.g. "Iliopsoas" for iliacus/psoas-major. */
  partOf?: string | null;
  origin: string[];
  insertion: string[];
  nerve: NerveRef[];
  /** Kebab-case action tags, e.g. "hip-flexion" — used for indexing/distractors. */
  actions: string[];
  actionText: string;
}

export interface BoneStructure extends AnatomyStructureBase {
  category: 'bone';
  /** Muscle/ligament attachment sites, textual. */
  attachments: string[];
  /** Joints this bone forms. */
  articulations: string[];
}

export interface LandmarkStructure extends AnatomyStructureBase {
  category: 'landmark';
  /** Cross-reference to a BoneStructure id. Not FK-enforced — see scripts/validateContent.ts. */
  parentBoneId?: string;
  attachments: string[];
  articulations?: string[];
  palpability?: 'easily-palpable' | 'palpable-deep' | 'not-palpable';
}

export interface JointStructure extends AnatomyStructureBase {
  category: 'joint';
  jointType: JointType;
  /** Structure ids (bones, occasionally landmarks) that form this joint. Not FK-enforced — see scripts/validateContent.ts. */
  articulatingStructureIds: string[];
  /** Movements possible at this joint, e.g. ['Flexion', 'Extension'] — a hinge joint has 2, a ball-and-socket has many. */
  movements: JointMovement[];
  /** Key ligaments/muscles providing stability, textual (not id-linked — some are muscles already modeled elsewhere, some are ligaments this app doesn't model as structures). */
  stabilizers?: string[];
}

/**
 * Discriminated union on `category` so origin/insertion/nerve/actions are
 * compile-time guaranteed absent on bones/landmarks/joints, and attachments/
 * articulations are guaranteed absent on muscles/joints.
 *
 * ADD NEW STRUCTURES to src/features/anatomy-revision/data/seed/ — never here.
 */
export type AnatomyStructure = MuscleStructure | BoneStructure | LandmarkStructure | JointStructure;

export const isMuscle = (s: AnatomyStructure): s is MuscleStructure => s.category === 'muscle';
export const isBone = (s: AnatomyStructure): s is BoneStructure => s.category === 'bone';
export const isLandmark = (s: AnatomyStructure): s is LandmarkStructure => s.category === 'landmark';
export const isJoint = (s: AnatomyStructure): s is JointStructure => s.category === 'joint';

/**
 * The area a structure revises under — its `area` override if one is authored,
 * otherwise derived from its subregion. Undefined only for a structure with no
 * subregion at all, which validateContent treats as an error since such a
 * structure would be unreachable from the area picker.
 */
export function areaOf(s: AnatomyStructure): Area | undefined {
  return s.area ?? areaForSubRegion(s.subregion);
}
