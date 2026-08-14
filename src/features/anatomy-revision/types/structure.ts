import type { Region, SubRegion } from './region';

export type Category = 'muscle' | 'bone' | 'landmark';
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

/**
 * Discriminated union on `category` so origin/insertion/nerve/actions are
 * compile-time guaranteed absent on bones/landmarks, and attachments/
 * articulations are guaranteed absent on muscles.
 *
 * ADD NEW STRUCTURES to src/features/anatomy-revision/data/seed/ — never here.
 */
export type AnatomyStructure = MuscleStructure | BoneStructure | LandmarkStructure;

export const isMuscle = (s: AnatomyStructure): s is MuscleStructure => s.category === 'muscle';
export const isBone = (s: AnatomyStructure): s is BoneStructure => s.category === 'bone';
export const isLandmark = (s: AnatomyStructure): s is LandmarkStructure => s.category === 'landmark';
