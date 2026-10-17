import { siteLabel } from './attachmentSites';
import { emphasise, PLACEHOLDER_DESCRIPTION } from './facts';
import { LIGAMENT_ATTACHMENT_DETAIL } from '../data/ligamentAttachmentDetail';
import {
  CATEGORIES,
  JOINT_TYPE_LABELS,
  isBone,
  isJoint,
  isLandmark,
  isLigament,
  isMuscle,
  reviewedAttachmentIds,
  type AnatomyStructure,
  type Category,
  type MuscleStructure,
} from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';

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

function nameOf(id: string, byId: ReadonlyMap<string, StructureIndexEntry>): string {
  return byId.get(id)?.name ?? id.replace(/-/g, ' ');
}

/**
 * Where a ligament attaches, as the questions print it: "Greater Trochanter
 * of the femur" (attachmentSites.ts, 10 Oct 2026). The Atlas is where a
 * student looks an answer up, so it names a site the way the feedback that
 * sent them here did.
 */
function siteOf(id: string, byId: ReadonlyMap<string, StructureIndexEntry>): string {
  const site = byId.get(id);
  return site ? siteLabel(site, byId) : id.replace(/-/g, ' ');
}

const join = (parts: readonly string[]) => parts.filter(Boolean).join('; ');

/**
 * `byId` is for NAMING the structures a row refers to — the bones a ligament
 * joins, the joint it belongs to — and those may be in areas whose facts are
 * not on the device, so it takes the index.
 */
export function atlasRow(s: AnatomyStructure, byId: ReadonlyMap<string, StructureIndexEntry>): AtlasRow {
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
      // Unchecked attachments are not stated as fact (reviewedAttachmentIds).
      { label: l1, text: s.needsReview ? 'Being checked' : join(s.attachmentStructureIds.map((id) => siteOf(id, byId))) },
      { label: l2, text: s.jointId ? nameOf(s.jointId, byId) : '' },
      { label: l3, text: firstSentence(s.description) },
    ];
  }

  const searchText = [s.name, ...s.aliases, ...(s.groups ?? []), ...columns.map((c) => c.text)]
    .join(' ')
    .toLowerCase();
  return { columns, searchText };
}

/**
 * A muscle's four facts as its CARD prints them (MuscleCard, MobileMuscleCard).
 *
 * In one place because three things must say the same words: the two cards,
 * the Atlas table above (origin, insertion and action are its three columns),
 * and the diagnostic papers, whose right answers the owner approved on the
 * condition that they are what the Atlas shows
 * (lib/__tests__/diagnosticPapersAtlas.test.ts holds that, question by
 * question). The cards used to join a muscle's nerves with a comma where
 * every question joins them with a semicolon, so sternocleidomastoid read
 * "…(CN XI), C2–C3 (sensory)" on its card and "…(CN XI); C2–C3 (sensory)" as
 * an answer. Lists are joined one way now: the way origins and insertions
 * always were.
 */
export interface MuscleCardFacts {
  origin: string;
  insertion: string;
  action: string;
  /** Empty when the muscle has no nerve recorded; the card then prints no row. */
  nerve: string;
}

export function muscleCardFacts(m: MuscleStructure): MuscleCardFacts {
  return {
    origin: join(m.origin),
    insertion: join(m.insertion),
    action: m.actionText,
    nerve: join(m.nerve.map((n) => n.name)),
  };
}

/** The card's heading for the row below. */
export const FUNCTIONAL_ROLE_LABEL = 'Functional role';

/**
 * What a structure is used for in everyday or sporting movement, where the
 * dataset says (the shoulder and elbow, so far). Sessions and the diagnostic
 * ask "X is most responsible for which of these?" with this sentence as the
 * right answer, and until October 2026 no card printed it: a student could be
 * marked on a line they had nowhere to read.
 */
export function functionalRole(s: AnatomyStructure): string | null {
  return s.functionalContext?.trim() || null;
}

/** Kind filter values in picker order. */
export const ATLAS_KINDS: (Category | 'all')[] = ['all', ...CATEGORIES];

/**
 * One block of a structure's card: a heading and its lines, each line in the
 * card's rich text (**bold**, see components/shared/RichText).
 */
export interface CardSection {
  label: string;
  items: string[];
}

const bold = (text: string) => `**${text}**`;

/**
 * Everything the card states about a structure, whatever kind it is (owner,
 * 17 Oct 2026: "full facts on every card"). Until then a ligament's card held
 * a role, a blood supply and a clinical note, and its attachments and joint
 * were only in the Atlas table, one click back.
 *
 * The facts are bold, as on the flashcards. A muscle's four are its card's
 * words exactly (muscleCardFacts), because the diagnostic papers mark an
 * answer right on the condition that it is what the card says. The blood
 * supply is not here: BloodSupplyFacts draws it, with its rating.
 *
 * `byId` names the bones a ligament joins and the surfaces a joint has, which
 * may be in areas whose facts are not on the device, so it takes the index.
 */
export function atlasCardSections(s: AnatomyStructure, byId: ReadonlyMap<string, StructureIndexEntry>): CardSection[] {
  const sections: CardSection[] = [];
  const add = (label: string, items: readonly string[]) => {
    const shown = items.filter(Boolean);
    if (shown.length) sections.push({ label, items: shown });
  };

  const siteNames = isLigament(s)
    ? reviewedAttachmentIds(s).flatMap((id) => {
        const site = byId.get(id);
        return site ? [site.name.replace(' (grouped)', ''), ...site.aliases] : [];
      })
    : [];
  // Many muscles' descriptions are their action, word for word: said once, under Action(s).
  const repeatsAction = isMuscle(s) && s.description.trim() === s.actionText.trim();
  if (s.description && !PLACEHOLDER_DESCRIPTION.test(s.description) && !repeatsAction) {
    add('About', s.description.split(/(?<=[.!?])\s+(?=[A-Z])/).map((sentence) => emphasise(sentence.trim(), siteNames)));
  }

  if (isMuscle(s)) {
    const card = muscleCardFacts(s);
    add('Origin(s)', [bold(card.origin)]);
    add('Insertion(s)', [bold(card.insertion)]);
    add('Nerve supply', card.nerve ? [bold(card.nerve)] : []);
    add('Action(s)', [emphasise(card.action)]);
  } else if (isLigament(s)) {
    // Unchecked attachments are not stated as fact (reviewedAttachmentIds).
    const detail = LIGAMENT_ATTACHMENT_DETAIL[s.id] ?? {};
    add(
      'Attaches to',
      s.needsReview
        ? ['Being checked']
        : reviewedAttachmentIds(s).map((id) => `${bold(siteOf(id, byId))}${detail[id] ? ` — ${detail[id]}` : ''}`),
    );
    add('Stabilises', s.jointId ? [bold(nameOf(s.jointId, byId))] : []);
  } else if (isJoint(s)) {
    add('Type', [bold(JOINT_TYPE_LABELS[s.jointType])]);
    add('Articulating surfaces', s.articulatingStructureIds.map((id) => bold(nameOf(id, byId))));
    add('Movements', s.movements.map(bold));
    add('Stabilisers', (s.stabilizers ?? []).map(bold));
  } else if (isBone(s)) {
    add('Attachments', s.attachments.map(bold));
    add('Articulates with', s.articulations.map(bold));
  } else if (isLandmark(s)) {
    add('On', [s.parentBoneId ? bold(nameOf(s.parentBoneId, byId)) : '', s.palpability ? PALPABILITY[s.palpability] : '']);
    add('Attachments', s.attachments.map(bold));
    add('Articulations', (s.articulations ?? []).map(bold));
  }

  const role = functionalRole(s);
  if (role) add(FUNCTIONAL_ROLE_LABEL, [emphasise(role)]);
  if (s.clinical) add('Clinical note', [emphasise(s.clinical, siteNames)]);
  return sections;
}
