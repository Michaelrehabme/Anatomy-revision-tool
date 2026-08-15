import { isBone, isLandmark } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { FillBlankQuestion, PromptKind } from '../../types/question';
import { parseBlank } from './blankParser';
import type { Rng } from '../rng';

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
    type: 'fill-blank' as const,
  };
}

function buildFor(
  structure: AnatomyStructure,
  statements: string[],
  promptKind: PromptKind,
  rng: Rng,
): FillBlankQuestion[] {
  const out: FillBlankQuestion[] = [];
  statements.forEach((statement, index) => {
    const parsed = parseBlank(statement, rng);
    if (!parsed) return;
    out.push({
      ...baseFields(structure, promptKind),
      id: `fillblank-${structure.id}-${promptKind}-${index}`,
      before: parsed.before,
      after: parsed.after,
      answer: parsed.answer,
      fullStatement: statement,
    });
  });
  return out;
}

/**
 * Builds one fill-in-the-blank question per bone/landmark attachment or
 * articulation statement (skipping any statement blankParser can't parse
 * cleanly), rather than the old MCQ approach of joining every statement for
 * a structure into one hard-to-recall/hard-to-type block.
 */
export function buildFillBlankQuestions(structures: AnatomyStructure[], rng: Rng): FillBlankQuestion[] {
  const questions: FillBlankQuestion[] = [];

  for (const structure of structures) {
    if (!(isBone(structure) || isLandmark(structure))) continue;

    questions.push(...buildFor(structure, structure.attachments, 'attachment', rng));

    const articulations = structure.articulations ?? [];
    if (articulations.length) {
      questions.push(...buildFor(structure, articulations, 'articulation', rng));
    }
  }

  return questions;
}
