import { isMuscle, isBone, isLandmark, isJoint } from '../types/structure';
import type { AnatomyStructure } from '../types/structure';
import { REGION_LABELS, SUBREGION_LABELS } from '../types/region';

/**
 * Shared fact-line builder used by flashcards, MCQ explanations, and
 * StructureFactsPanel — one place that knows how to turn any category of
 * AnatomyStructure into readable prose lines.
 */
export function describeStructure(s: AnatomyStructure): string[] {
  const lines: string[] = [
    `Region: ${REGION_LABELS[s.region]}${s.subregion ? ` (${SUBREGION_LABELS[s.subregion]})` : ''}`,
  ];

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
    lines.push(`Type: ${s.jointType.replace(/-/g, ' ')} joint`);
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
  if (isJoint(s)) return `${s.jointType.replace(/-/g, ' ')} joint — ${s.movements.join('; ')}`;
  if (s.attachments.length) return s.attachments.join('; ');
  if (s.articulations?.length) return s.articulations.join('; ');
  return s.description;
}
