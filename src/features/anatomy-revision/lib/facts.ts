import { isMuscle, isBone, isLandmark, isJoint, isLigament, reviewedAttachmentIds, areasOf, JOINT_TYPE_LABELS } from '../types/structure';
import type { AnatomyStructure, LigamentStructure } from '../types/structure';
import { REGION_LABELS, SUBREGION_LABELS, AREA_LABELS } from '../types/region';
import type { OinaPromptKind } from '../types/question';

/**
 * Shared fact-line builder used by flashcards, MCQ explanations, and
 * StructureFactsPanel — one place that knows how to turn any category of
 * AnatomyStructure into readable prose lines.
 */
export function describeStructure(s: AnatomyStructure): string[] {
  // Leads with the area, since that is what the user filtered by (CR-017). A
  // structure can sit in several — a pedicle revises under all three spine levels —
  // so they are all named. The finer subregion is kept in brackets where it adds
  // something the areas do not ("Hip (Spine)" for the sacroiliac joint), and dropped
  // where they would just repeat each other ("Shoulder (Shoulder)", or "Lumbar Spine
  // (Spine)", whose area label already contains the word).
  const areas = areasOf(s);
  const areaLabel = areas.length ? areas.map((a) => AREA_LABELS[a]).join(', ') : REGION_LABELS[s.region];
  const sub = s.subregion ? SUBREGION_LABELS[s.subregion] : undefined;
  const subAddsInfo =
    !!sub && !areas.some((a) => AREA_LABELS[a].toLowerCase().includes(sub.toLowerCase()));
  const lines: string[] = [`Area: ${areaLabel}${subAddsInfo ? ` (${sub})` : ''}`];

  if (isMuscle(s)) {
    lines.push(`Origin: ${s.origin.join('; ')}`);
    lines.push(`Insertion: ${s.insertion.join('; ')}`);
    lines.push(
      `Nerve: ${s.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ')}`,
    );
    lines.push(`Action: ${s.actionText}`);
  } else if (isBone(s)) {
    if (s.attachments.length) lines.push(`Attachments: ${s.attachments.join('; ')}`);
    if (s.articulations.length) lines.push(`Articulations: ${s.articulations.join('; ')}`);
  } else if (isLandmark(s)) {
    if (s.attachments.length) lines.push(`Attachments: ${s.attachments.join('; ')}`);
    if (s.articulations?.length) lines.push(`Articulations: ${s.articulations.join('; ')}`);
  } else if (isLigament(s)) {
    const attachments = reviewedAttachmentIds(s);
    if (attachments.length) {
      lines.push(`Attaches to: ${attachments.map((id) => id.replace(/-/g, ' ')).join('; ')}`);
    }
    if (s.jointId) lines.push(`Stabilises: ${s.jointId.replace(/-/g, ' ')}`);
  } else if (isJoint(s)) {
    lines.push(`Type: ${JOINT_TYPE_LABELS[s.jointType]}`);
    lines.push(`Movements: ${s.movements.join('; ')}`);
    if (s.stabilizers?.length) lines.push(`Stabilizers: ${s.stabilizers.join('; ')}`);
  }

  if (s.bloodSupply) {
    const b = s.bloodSupply;
    const rating = { rich: 'rich', moderate: 'moderate', poor: 'poor' }[b.rating];
    const vessels = b.primary ? [b.primary, ...b.assisting].join(', ') : 'no single named artery';
    lines.push(`Blood supply (${rating}): ${vessels}`);
  }
  if (s.clinical) lines.push(`Clinical relevance: ${s.clinical}`);
  return lines;
}

export function summarizeStructure(s: AnatomyStructure): string {
  return [s.description, ...describeStructure(s)].join('\n');
}

/**
 * One fact of one muscle, for OINA explanations (CR-018). Deliberately not
 * summarizeStructure: OINA asks origin, insertion, nerve and action as four
 * separate questions about the same muscle, so an explanation that printed
 * all four would answer the next three the moment the student got one wrong.
 *
 * Origins and insertions keep their authored head prefixes here even though
 * the choices strip them — once the answer is being explained, knowing that
 * the ischial tuberosity is specifically the long head is the useful part.
 */
export function describeFact(s: AnatomyStructure, promptKind: OinaPromptKind): string {
  const b = s.bloodSupply;
  if (promptKind === 'blood-supply') {
    return b?.primary ? `${s.name} — primary blood supply: ${b.primary}` : '';
  }
  if (promptKind === 'blood-supply-assisting') {
    return b?.primary && b.assisting.length
      ? `${s.name} — primary blood supply: ${b.primary}; also supplied by: ${b.assisting.join('; ')}`
      : '';
  }
  if (!isMuscle(s)) return '';
  switch (promptKind) {
    case 'origin':
      return `${s.name} — origin: ${s.origin.join('; ')}`;
    case 'insertion':
      return `${s.name} — insertion: ${s.insertion.join('; ')}`;
    case 'nerve':
      return `${s.name} — nerve supply: ${s.nerve
        .map((n) => `${n.name}${n.roots.length ? ` (${n.roots.join(', ')})` : ''}`)
        .join('; ')}`;
    case 'action':
      return `${s.name} — action: ${s.actionText}`;
  }
}

/**
 * The generator's stand-in for a description nobody has written yet
 * (generateLigamentSeed.ts): "Ligament of the hip." or "Ligament of the knee,
 * running between the tibia and the femur." It says less than the attachment
 * list does, and two ligaments can share one word for word.
 */
const PLACEHOLDER_DESCRIPTION = /^Ligament of the [^,.]+(?:, running between .+)?\.$/;

/** Lower case, no punctuation, and none of the small words a name may or may not carry. */
const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:the|of|ligaments?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The opening sentence of a ligament's authored description, which is where
 * every one of them says what it runs from and to. Undefined when there is
 * no authored description, or when the sentence gives the answer away: the
 * ligament of the head of the femur runs "to the fovea on the head of the
 * femur".
 */
export function ligamentCourse(s: LigamentStructure): string | undefined {
  if (PLACEHOLDER_DESCRIPTION.test(s.description)) return undefined;
  const sentence = s.description.split(/(?<=\.)\s+(?=[A-Z])/)[0]?.trim();
  if (!sentence || ` ${plain(sentence)} `.includes(` ${plain(s.name)} `)) return undefined;
  return sentence;
}

const attachmentClue = (ids: string[]) => `attaches to: ${ids.map((id) => id.replace(/-/g, ' ')).join('; ')}`;

/**
 * A short text "clue" built from a structure's own facts, used as the
 * fallback prompt for text-only identify questions (mirrors quiz.py's
 * gen_identify fallback for when no image is available). Must never return
 * an empty string — that turns "Name the structure: <clue>" into an
 * unguessable "Name the structure:" with nothing after the colon (found via
 * a real bug report: 42 landmarks across the seed data have an empty
 * `attachments` array — e.g. costovertebral-joint only has `articulations`
 * authored — so attachments alone isn't a safe single source for the clue).
 */
export function buildIdentifyClue(s: AnatomyStructure): string {
  if (isMuscle(s)) return `${s.origin.join('; ')} — ${s.actionText}`;
  if (isJoint(s)) return `${JOINT_TYPE_LABELS[s.jointType]} — ${s.movements.join('; ')}`;
  if (isLigament(s)) {
    // Where it runs, in the description's words. The bones alone were the clue
    // until 8 Oct 2026, and "attaches to: pelvis" is true of five hip
    // ligaments: 110 of 166 shared their bone list with a neighbour.
    const course = ligamentCourse(s);
    if (course) return course;
    // By id rather than name: facts.ts has no structure lookup, and "attaches
    // to: talus; fibula" reads fine from the ids. Not a clue that picks one
    // ligament out — clueAlsoFits below is what keeps its question fair.
    const attachments = reviewedAttachmentIds(s);
    if (attachments.length) return attachmentClue(attachments);
    return s.description;
  }
  if (s.attachments.length) return s.attachments.join('; ');
  if (s.articulations?.length) return s.articulations.join('; ');
  return s.description;
}

/**
 * Whether the clue written for `correct` is just as true of `other`, which
 * would make `other` a second right answer if it were offered as a wrong one.
 *
 * Two structures can produce the same clue outright (two plane joints that
 * both glide). And a ligament still on its bone list is matched by every
 * ligament reaching all of those bones, in whatever order they are listed and
 * whatever else it reaches: "attaches to: pelvis" fits the sacrotuberous
 * ligament too.
 */
export function clueAlsoFits(correct: AnatomyStructure, other: AnatomyStructure): boolean {
  const clue = buildIdentifyClue(correct);
  if (buildIdentifyClue(other) === clue) return true;
  if (!isLigament(correct) || !isLigament(other)) return false;
  const bones = reviewedAttachmentIds(correct);
  if (!bones.length || clue !== attachmentClue(bones)) return false;
  const reached = new Set(reviewedAttachmentIds(other));
  return bones.every((id) => reached.has(id));
}
