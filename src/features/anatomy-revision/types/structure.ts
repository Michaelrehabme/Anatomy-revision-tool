import type { Region, SubRegion } from './region';

export type Category = 'muscle' | 'bone' | 'landmark' | 'joint';

/** Standard synovial joint classification — six types, distinguished by shape/range of motion. */
export type JointType = 'ball-and-socket' | 'hinge' | 'pivot' | 'saddle' | 'plane' | 'condyloid';
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
  movements: string[];
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
