import {
  CATEGORIES,
  JOINT_TYPE_LABELS,
  isBone,
  isJoint,
  isLandmark,
  isMuscle,
  type AnatomyStructure,
  type Category,
} from '../types/structure';

/**
 * What the Atlas shows about a structure, whatever kind it is.
 *
 * The Atlas was a muscle table — origin, insertion, action — and filtered
 * every other kind out at source, so the 223 bones, landmarks, joints and
 * ligaments a student is quizzed on had no page that simply told them what
 * the thing is and what it does. Each kind has its own three facts worth a
 * column; the seed already carries them (types/structure.ts), and this module
 * is where they are turned into columns so both atlas screens agree.
 *
 * Ids are resolved to names here. A ligament's attachments and a joint's
 * articulating surfaces are stored as structure ids (so the quiz can grade
 * them); "tibia" and "medial meniscus" are what a student should read.
 */
export interface AtlasColumn {
  label: string;
  text: string;
}

export interface AtlasRow {
  columns: [AtlasColumn, AtlasColumn, AtlasColumn];
  /** Lower-cased, for the search box: name, aliases, groups and every column. */
  searchText: string;
}

/** Column headings for a list of one kind. The third is always the role. */
export const ATLAS_COLUMN_LABELS: Record<Category, [string, string, string]> = {
  muscle: ['Origin', 'Insertion', 'Action'],
  bone: ['Attachments', 'Articulates with', 'Role'],
  landmark: ['On', 'Attachments', 'Role'],
  joint: ['Type', 'Articulating surfaces', 'Movements'],
  ligament: ['Attaches to', 'Stabilises', 'Role'],
};

/** Headings for a mixed list, where each cell says which fact it is. */
export const ATLAS_MIXED_LABELS: [string, string, string] = ['Fact', 'Fact', 'Role'];

const PALPABILITY: Record<NonNullable<Extract<AnatomyStructure, { category: 'landmark' }>['palpability']>, string> = {
  'easily-palpable': 'Easily palpable',
  'palpable-deep': 'Palpable with deep pressure',
  'not-palpable': 'Not palpable',
};

/** The first sentence of a description: the role, without the paragraph. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
}

function nameOf(id: string, byId: ReadonlyMap<string, AnatomyStructure>): string {
  return byId.get(id)?.name ?? id.replace(/-/g, ' ');
}

const join = (parts: readonly string[]) => parts.filter(Boolean).join('; ');

export function atlasRow(s: AnatomyStructure, byId: ReadonlyMap<string, AnatomyStructure>): AtlasRow {
  const [l1, l2, l3] = ATLAS_COLUMN_LABELS[s.category];
  let columns: [AtlasColumn, AtlasColumn, AtlasColumn];

  if (isMuscle(s)) {
    columns = [
      { label: l1, text: join(s.origin) },
      { label: l2, text: join(s.insertion) },
      { label: l3, text: s.actionText },
    ];
  } else if (isBone(s)) {
    columns = [
      { label: l1, text: join(s.attachments) },
      { label: l2, text: join(s.articulations) },
      { label: l3, text: firstSentence(s.description) },
    ];
  } else if (isLandmark(s)) {
    const on = [s.parentBoneId ? nameOf(s.parentBoneId, byId) : '', s.palpability ? PALPABILITY[s.palpability] : ''];
    columns = [
      { label: l1, text: on.filter(Boolean).join(' · ') },
      { label: l2, text: join(s.attachments) },
      { label: l3, text: firstSentence(s.description) },
    ];
  } else if (isJoint(s)) {
    columns = [
      { label: l1, text: JOINT_TYPE_LABELS[s.jointType] },
      { label: l2, text: join(s.articulatingStructureIds.map((id) => nameOf(id, byId))) },
      { label: l3, text: join(s.movements) },
    ];
  } else {
    columns = [
      { label: l1, text: join(s.attachmentStructureIds.map((id) => nameOf(id, byId))) },
      { label: l2, text: s.jointId ? nameOf(s.jointId, byId) : '' },
      { label: l3, text: firstSentence(s.description) },
    ];
  }

  const searchText = [s.name, ...s.aliases, ...(s.groups ?? []), ...columns.map((c) => c.text)]
    .join(' ')
    .toLowerCase();
  return { columns, searchText };
}

/** Kind filter values in picker order. */
export const ATLAS_KINDS: (Category | 'all')[] = ['all', ...CATEGORIES];
