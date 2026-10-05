import type { AnatomyStructure, Category, Difficulty, QuestionEligibility } from './structure';
import type { Area, Region, SubRegion } from './region';
import type { FactKind } from './question';

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

/**
 * FACT FIELDS THAT ARE NOT SERVED AT ALL — on neither side of the paywall.
 *
 * `notes` is the author's working notes and `source` the provenance record
 * (deck, slides, works cited). No screen renders either: /sources is built
 * from its own generated summary, and nothing asks a question from them. They
 * were a fifth of every area payload, and authoring notes are not something
 * to hand a student because they happen to sit on the same object.
 *
 * THE OWNER HAS NOT RULED ON THIS (docs/CONTENT-SERVER-STATUS.md, decision 4);
 * leaving them out is the conservative default. To serve them, empty this
 * list — nothing else needs to change.
 *
 * One thing would make that necessary: isHeld() (types/structure.ts) reads
 * `source.grade`, and a structure graded 'held' must be kept out of questions.
 * None is held today and nothing calls isHeld; split.test.ts fails the day a
 * held structure appears, so that it cannot be asked about by a build that
 * was never told.
 */
export const STRUCTURE_FACT_FIELDS_NOT_SERVED: readonly (typeof STRUCTURE_FACT_FIELDS)[number][] = ['notes', 'source'];

export type StructureIndexField = (typeof STRUCTURE_INDEX_FIELDS)[number];
export type StructureFactField = (typeof STRUCTURE_FACT_FIELDS)[number];

/** The fact fields an area payload carries: all of them, less the ones above. */
export const SERVED_FACT_FIELDS: readonly StructureFactField[] = STRUCTURE_FACT_FIELDS.filter(
  (field) => !STRUCTURE_FACT_FIELDS_NOT_SERVED.includes(field),
);

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
  /**
   * Which kinds of fact this structure has to be mastered on: origin,
   * insertion, nerve and action for a muscle, and whichever of the three
   * blood-supply kinds it has (lib/factMastery.ts requiredFactKinds).
   *
   * In the index because a student's LEVEL on a structure is worked out from
   * it, and levels are shown for structures whose facts are not on the device
   * — the whole body on the progress screen of a free account, every
   * structure a lapsed subscriber ever studied, every row a student's device
   * sums for their educator. Without it those levels would be computed as if
   * the structure had no facts to know, and read higher than they are.
   *
   * What it gives away is the KIND of fact a structure has — that the scaphoid
   * has a named primary artery, not which artery. Written by buildContent.ts;
   * absent on a full structure, where the facts themselves answer. Read it
   * through requiredFactKinds(), never directly.
   */
  factKinds?: FactKind[];
}

/**
 * One structure's facts as an area payload carries them: its id and whichever
 * fact fields it has. Loosely typed on purpose — it is a wire shape, turned
 * back into an AnatomyStructure by joining it to its index entry
 * (data/content/split.ts), and the join is where the type is restored.
 */
export type StructureFacts = { id: string } & { [K in StructureFactField]?: unknown };

/** The fields the index adds that no structure is authored with: stand-ins for facts that are elsewhere. */
export const DERIVED_INDEX_FIELDS = ['hasDescription', 'factKinds'] as const;

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
  | Exclude<keyof StructureIndexEntry, StructureIndexField | 'hasDescription' | 'factKinds'>;

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
