import { isMuscle, isBone, isLandmark, isJoint, areaOf, JOINT_TYPE_LABELS } from '../types/structure';
import type { AnatomyStructure } from '../types/structure';
import { REGION_LABELS, SUBREGION_LABELS, AREA_LABELS } from '../types/region';

/**
 * Shared fact-line builder used by flashcards, MCQ explanations, and
 * StructureFactsPanel — one place that knows how to turn any category of
 * AnatomyStructure into readable prose lines.
 */
export function describeStructure(s: AnatomyStructure): string[] {
  // Leads with the area, since that is what the user filtered by (CR-017). The
  // finer subregion is kept in brackets where it adds something the area does not —
  // "Back & Core (Cervical)" is worth more than "Back & Core" alone — but it is
  // dropped where the two would just repeat each other ("Shoulder (Shoulder)").
  const area = areaOf(s);
  const areaLabel = area ? AREA_LABELS[area] : REGION_LABELS[s.region];
  const sub = s.subregion ? SUBREGION_LABELS[s.subregion] : undefined;
  const lines: string[] = [`Area: ${areaLabel}${sub && sub !== areaLabel ? ` (${sub})` : ''}`];

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
  } else if (isJoint(s)) {
    lines.push(`Type: ${JOINT_TYPE_LABELS[s.jointType]}`);
    lines.push(`Movements: ${s.movements.join('; ')}`);
    if (s.stabilizers?.length) lines.push(`Stabilizers: ${s.stabilizers.join('; ')}`);
  }

  if (s.clinical) lines.push(`Clinical relevance: ${s.clinical}`);
  return lines;
}

export function summarizeStructure(s: AnatomyStructure): string {
  return [s.description, ...describeStructure(s)].join('\n');
}

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
  if (s.attachments.length) return s.attachments.join('; ');
  if (s.articulations?.length) return s.articulations.join('; ');
  return s.description;
}
