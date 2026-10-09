import { isBone, isLandmark } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { FillBlankQuestion, PromptKind } from '../../types/question';
import { parseBlank } from './blankParser';
import { answerItems } from '../answerMatching';
import type { Rng } from '../rng';
import { questionBase } from './questionBase';

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return { ...questionBase(structure, promptKind), type: 'fill-blank' as const };
}

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

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
    // The structure's name is shown above the sentence, so a blank that name
    // fills is not asked: "[Deltoid] insertion" under "Deltoid Tuberosity".
    const named = words(structure.name);
    const blank = words(parsed.answer);
    if (blank.every((w) => named.includes(w)) || named.every((w) => blank.includes(w))) return;
    out.push({
      ...baseFields(structure, promptKind),
      id: `fillblank-${structure.id}-${promptKind}-${index}`,
      before: parsed.before,
      after: parsed.after,
      answer: parsed.answer,
      fullStatement: statement,
      subject: structure.name.replace(' (grouped)', ''),
    });
  });
  // One sentence is one question. Statements that leave the same words
  // around the blank ("____ insertion", three times, on the greater
  // trochanter) were three questions nobody could tell apart; they are one,
  // with a box for each thing that fills it. So is a single statement whose
  // answer is a list.
  const bySentence = new Map<string, FillBlankQuestion[]>();
  for (const q of out) {
    const sentence = `${q.before.trim()}|${q.after.trim()}`.toLowerCase();
    bySentence.set(sentence, [...(bySentence.get(sentence) ?? []), q]);
  }
  return [...bySentence.values()].map((same) => {
    const answers: string[] = [];
    for (const item of same.flatMap((q) => answerItems(q.answer))) {
      if (!answers.some((have) => have.toLowerCase() === item.toLowerCase())) answers.push(item);
    }
    const [first] = same;
    if (answers.length < 2) return first;
    return { ...first, answer: answers.join(', '), fullStatement: same.map((q) => q.fullStatement).join('\n'), answers };
  });
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
