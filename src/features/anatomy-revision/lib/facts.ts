import { isMuscle, isBone, isLandmark } from '../types/structure';
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
    lines.push(`Attachments: ${s.attachments.join('; ')}`);
    lines.push(`Articulations: ${s.articulations.join('; ')}`);
  } else if (isLandmark(s)) {
    lines.push(`Attachments: ${s.attachments.join('; ')}`);
    if (s.articulations?.length) lines.push(`Articulations: ${s.articulations.join('; ')}`);
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
 * gen_identify fallback for when no image is available).
 */
export function buildIdentifyClue(s: AnatomyStructure): string {
  if (isMuscle(s)) return `${s.origin.join('; ')} — ${s.actionText}`;
  if (isBone(s)) return s.attachments.join('; ');
  return s.attachments.join('; ');
}
