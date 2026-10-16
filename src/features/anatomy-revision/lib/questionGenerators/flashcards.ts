import { isMuscle } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import { BLOOD_SUPPLY_TAUGHT, HEALING_CARDS, type FlashcardQuestion, type OinaPromptKind, type PromptKind } from '../../types/question';
import { STRUCTURE_HEALING, TISSUE_HEALING, type StructureHealing } from '../../data/seed/healing.seed';
import { summarizeStructure, type SiteLookup } from '../facts';
import { questionBase } from './questionBase';

export interface FlashcardGenOptions {
  /** Also emit an image-first variant when a single-structure image exists. Default true. */
  imageFirstWhenAvailable?: boolean;
  /**
   * Every structure by id, for naming a ligament's attachments on the back of
   * its card as "Greater Trochanter of the femur" (attachmentSites.ts).
   * Defaults to the structures handed in, which is wrong whenever they are a
   * narrowed pool: a session of ligaments alone has no bone in it to look up,
   * and its cards read "greater trochanter; ischium" (found at the merge,
   * 10 Oct 2026). A caller that holds the index passes it.
   */
  sites?: SiteLookup;
}

const MUSCLE_FIELD_KINDS: OinaPromptKind[] = ['origin', 'insertion', 'nerve', 'action'];

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return { ...questionBase(structure, promptKind), type: 'flashcard' as const };
}

function fieldBackText(structure: AnatomyStructure, promptKind: PromptKind): string {
  if (!isMuscle(structure)) return '';
  switch (promptKind) {
    case 'origin':
      return structure.origin.join('; ');
    case 'insertion':
      return structure.insertion.join('; ');
    case 'nerve':
      return structure.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ');
    case 'action':
      return structure.actionText;
    default:
      return '';
  }
}

/**
 * Builds flashcards for every eligible structure. Text-first "identify"
 * cards always generate (front = name, back = facts). When a matching
 * single-structure image exists, an additional image-first card is
 * generated (front = image, back = name + facts) — this is what lets a
 * student practice recognising a structure from its picture, not just
 * recalling facts about its name.
 *
 * Muscles additionally get one card per field (origin/insertion/nerve/
 * action) so a student can be quizzed on a single fact at a time rather
 * than always recalling everything about a muscle at once.
 */
export function buildFlashcardQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  options: FlashcardGenOptions = {},
): FlashcardQuestion[] {
  const { imageFirstWhenAvailable = true } = options;
  const questions: FlashcardQuestion[] = [];
  const byId: SiteLookup = options.sites ?? new Map(structures.map((s) => [s.id, s]));

  for (const structure of structures) {
    if (!structure.eligibility.flashcard) continue;

    const backText = summarizeStructure(structure, byId);
    const image = images.find(
      (img) => img.mode === 'single-structure' && img.structureId === structure.id,
    );

    questions.push({
      ...baseFields(structure, 'identify'),
      id: `flashcard-${structure.id}-text`,
      front: { text: structure.name },
      back: { text: backText, imageId: image?.id },
    });

    if (imageFirstWhenAvailable && image) {
      questions.push({
        ...baseFields(structure, 'identify'),
        id: `flashcard-${structure.id}-image`,
        front: { imageId: image.id },
        back: { text: `${structure.name}\n\n${backText}` },
      });
    }

    if (isMuscle(structure)) {
      for (const promptKind of MUSCLE_FIELD_KINDS) {
        const card = buildFieldFlashcard(structure, promptKind);
        if (card) questions.push(card);
      }
    }

    const supply = BLOOD_SUPPLY_TAUGHT ? buildBloodSupplyFlashcard(structure) : null;
    if (supply) questions.push(supply);

    if (HEALING_CARDS) {
      for (const entry of HEALING_BY_STRUCTURE.get(structure.id) ?? []) questions.push(buildHealingFlashcard(structure, entry));
    }
  }

  return questions;
}

const HEALING_BY_STRUCTURE = new Map<string, StructureHealing[]>();
for (const entry of STRUCTURE_HEALING) {
  HEALING_BY_STRUCTURE.set(entry.structureId, [...(HEALING_BY_STRUCTURE.get(entry.structureId) ?? []), entry]);
}

/**
 * Why a structure heals well or badly, and how long its tissue takes
 * (data/seed/healing.seed.ts), with the sources named on the back. A
 * contested point says so. The links themselves are on /sources: a card is
 * read in a session, and a student should not be sent out of it.
 */
export function buildHealingFlashcard(structure: AnatomyStructure, entry: StructureHealing): FlashcardQuestion {
  const tissue = TISSUE_HEALING[entry.tissue];
  const sources = [...entry.sources.map((s) => s.label), ...(entry.sources.some((s) => s.url === tissue.source.url) ? [] : [tissue.source.label])];
  const back = [
    entry.answer,
    ...(entry.contested ? [`Contested: ${entry.contested}`] : []),
    `How ${entry.tissue === 'cartilage' ? 'articular cartilage' : entry.tissue} heals: ${tissue.text}`,
    `Sources: ${sources.join('; ')}`,
  ].join('\n\n');
  return {
    ...baseFields(structure, 'blood-supply'),
    id: `flashcard-${structure.id}-healing-${entry.key}`,
    front: { text: entry.question },
    back: { text: back },
  };
}

/**
 * A structure's blood supply, as a card to learn from.
 *
 * This is where blood supply lives while it is unscored (owner's decision,
 * 12 October 2026; types/question.ts BLOOD_SUPPLY_SCORED): shown and
 * self-rated, never marked. Every family but landmarks, which carry none.
 *
 * THE ARTERIES, AND THE POORLY SUPPLIED PART WHERE ONE IS RECORDED. Not the
 * rich / moderate / poor rating: it has no source, and a card states what it
 * says as fact. The zone is the part worth remembering, since it is where
 * the structure heals badly.
 */
export function buildBloodSupplyFlashcard(structure: AnatomyStructure): FlashcardQuestion | null {
  const b = structure.category === 'landmark' ? undefined : structure.bloodSupply;
  if (!b?.primary) return null;
  const lines = [`Main artery: ${b.primary}`];
  if (b.assisting.length) lines.push(`Also supplied by: ${b.assisting.join('; ')}`);
  if (b.zone) lines.push(`Poorly supplied part: ${b.zone}`);
  return {
    ...baseFields(structure, 'blood-supply'),
    id: `flashcard-${structure.id}-blood-supply-card`,
    front: { text: `What is the blood supply of ${structure.name}?` },
    back: { text: lines.join('\n') },
  };
}

/**
 * One muscle's card for one fact. Extracted so generateSet can put it in
 * front of the matching OINA question as a teaching step (CR-018) — a
 * student cannot recall an attachment they have never been shown, and a
 * first encounter that is a blind guess teaches nothing.
 */
export function buildFieldFlashcard(
  structure: AnatomyStructure,
  promptKind: OinaPromptKind,
): FlashcardQuestion | null {
  if (!isMuscle(structure)) return null;
  return {
    ...baseFields(structure, promptKind),
    id: `flashcard-${structure.id}-${promptKind}`,
    front: { text: `What is the ${promptKind === 'nerve' ? 'nerve supply' : promptKind} of ${structure.name}?` },
    back: { text: fieldBackText(structure, promptKind) },
  };
}

/**
 * The card shown after a student has missed the same skill three times
 * running (lib/relearn.ts), built for the MCQ they keep missing.
 *
 * A muscle fact gets the same card a learn card would. Anything else gets the
 * question with its answer and the explanation the MCQ already carries, plus
 * the structure's own picture where one shows it alone: a region plate cannot
 * go on a card, because a card draws no highlight and the plate shows a dozen
 * structures.
 */
export function buildRelearnCard(
  structure: AnatomyStructure,
  question: { id: string; promptKind: PromptKind; prompt: string; choices: string[]; correctIndex: number; explanation: string },
  ownImageId?: string,
): FlashcardQuestion {
  const field = (MUSCLE_FIELD_KINDS as PromptKind[]).includes(question.promptKind)
    ? buildFieldFlashcard(structure, question.promptKind as OinaPromptKind)
    : null;
  if (field) return { ...field, id: `relearn-${question.id}` };
  const answer = question.choices[question.correctIndex];
  return {
    ...baseFields(structure, question.promptKind),
    id: `relearn-${question.id}`,
    front: { text: question.prompt },
    back: {
      text: [answer, question.explanation].filter((line) => line && line !== answer).join('\n\n') || answer,
      imageId: ownImageId,
    },
  };
}
