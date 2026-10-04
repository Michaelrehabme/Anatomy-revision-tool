import type { AnatomyStructure, Category, Difficulty, QuestionEligibility } from './structure';
import type { Area, Region, SubRegion } from './region';

/**
 * THE SPLIT BETWEEN WHAT SHIPS TO EVERYONE AND WHAT IS PAID FOR
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md).
 *
 * Every field of every structure is in exactly one of the two lists below, and
 * these lists are the only place that says which. buildContent.ts cuts the seed
 * along them, the coverage tests check the cut against them, and the two type
 * checks at the foot of this file stop a new field on AnatomyStructure
 * compiling until someone has decided which side it belongs on — a field
 * nobody classified would otherwise default to wherever the cutting code
 * happened to put it, and the wrong default here is a fact in the bundle.
 *
 * INDEX: what the app needs to name a structure, find it, draw its picture,
 * count it and scope a session to it. Bundled, readable by anyone.
 *
 * `jointId` and `parentBoneId` are relations between structures and so are
 * arguably facts; they are index because the pictures already give them away
 * (a ligament plate is framed on its joint, a landmark is drawn on its bone)
 * and because select-all attachment questions need the parent bone to stop a
 * landmark being offered as a wrong answer beside the bone it is part of.
 */
export const STRUCTURE_INDEX_FIELDS = [
  'id',
  'name',
  'latin',
  'aliases',
  'phoneticSpelling',
  'audioUrl',
  'category',
  'region',
  'subregion',
  'areas',
  'groups',
  'imageIds',
  'eligibility',
  'difficulty',
  'tags',
  'parentBoneId',
  'jointId',
  'abbreviation',
  'partOf',
] as const;

/**
 * FACTS: what a student is here to learn, served per area to whoever is
 * entitled to that area.
 *
 * `needsReview` travels with the facts because it only ever qualifies one:
 * reviewedAttachmentIds() reads it to decide whether a ligament's attachments
 * may be stated, and a flag that says "these attachments are unchecked"
 * without the attachments beside it says nothing.
 */
export const STRUCTURE_FACT_FIELDS = [
  'description',
  // Muscles.
  'origin',
  'insertion',
  'nerve',
  'actions',
  'actionText',
  // Bones and landmarks.
  'attachments',
  'articulations',
  'palpability',
  // Joints.
  'jointType',
  'articulatingStructureIds',
  'movements',
  'stabilizers',
  // Ligaments.
  'attachmentStructureIds',
  'needsReview',
  // Any family.
  'clinical',
  'notes',
  'source',
  'bloodSupply',
  // The clinical layer (CR-010).
  'myotome',
  'dermatomeRelation',
  'palpationNotes',
  'commonInjuries',
  'specialTests',
  'referredPainPattern',
  'functionalContext',
] as const;

export type StructureIndexField = (typeof STRUCTURE_INDEX_FIELDS)[number];
export type StructureFactField = (typeof STRUCTURE_FACT_FIELDS)[number];

/**
 * A structure without its facts: every STRUCTURE_INDEX_FIELDS field, flattened
 * across the five categories, plus `hasDescription`.
 *
 * A full AnatomyStructure IS one of these — it carries every index field — so
 * the seed can be passed wherever an entry is wanted, which is what lets code
 * be narrowed to this type while the seed is still bundled. Code typed against
 * it cannot read a fact, and that is the point: whatever compiles against
 * StructureIndexEntry keeps working on the day the facts stop being there.
 *
 * The category-specific fields are optional here rather than a discriminated
 * union. `partOf` exists only on muscles and `jointId` only on ligaments, but
 * a union of five near-identical shapes buys nothing for fields that are
 * optional on their own category anyway.
 */
export interface StructureIndexEntry {
  id: string;
  name: string;
  latin?: string | null;
  aliases: string[];
  phoneticSpelling?: string;
  audioUrl?: string;
  category: Category;
  region: Region;
  subregion?: SubRegion;
  areas?: Area[];
  groups?: string[];
  imageIds: string[];
  eligibility: QuestionEligibility;
  difficulty: Difficulty;
  tags: string[];
  /** Landmarks: the bone it is part of. */
  parentBoneId?: string;
  /** Ligaments: the joint it stabilises. */
  jointId?: string;
  /** Ligaments: "ACL". */
  abbreviation?: string;
  /** Muscles: "Iliopsoas" for iliacus. */
  partOf?: string | null;
  /**
   * Whether the structure has a description, for code that used to ask
   * `description.length > 0` as its test of "is there anything to say about
   * this". Written by buildContent.ts; absent on a full structure, which has
   * the description itself — read it through hasDescription(), never directly.
   */
  hasDescription?: boolean;
}

/**
 * One structure's facts as an area payload carries them: its id and whichever
 * fact fields it has. Loosely typed on purpose — it is a wire shape, turned
 * back into an AnatomyStructure by joining it to its index entry
 * (data/content/split.ts), and the join is where the type is restored.
 */
export type StructureFacts = { id: string } & { [K in StructureFactField]?: unknown };

/** True when a structure has a description, whether or not its facts are here. */
export function hasDescription(s: StructureIndexEntry): boolean {
  if (s.hasDescription !== undefined) return s.hasDescription;
  const description = (s as { description?: unknown }).description;
  return typeof description === 'string' && description.length > 0;
}

// --- The two checks that keep the lists honest. Types only; nothing is emitted.

type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

/** A field on some AnatomyStructure that is in neither list. Must be `never`. */
type Unclassified = Exclude<KeysOfUnion<AnatomyStructure>, StructureIndexField | StructureFactField>;
/** A field in both lists. Must be `never`. */
type InBoth = StructureIndexField & StructureFactField;
/** An index field the entry type forgot, or an entry field that is not in the list. Must be `never`. */
type EntryDrift =
  | Exclude<StructureIndexField, keyof StructureIndexEntry>
  | Exclude<keyof StructureIndexEntry, StructureIndexField | 'hasDescription'>;

// If one of these fails to compile, a field was added to a structure type
// without being added to a list above (or was added to both). Decide which
// side of the paywall it is on and put it there.
export type StructureFieldChecks = [
  Assert<IsNever<Unclassified>>,
  Assert<IsNever<InBoth>>,
  Assert<IsNever<EntryDrift>>,
  // A full structure must stay usable as an index entry.
  Assert<AnatomyStructure extends StructureIndexEntry ? true : false>,
];
