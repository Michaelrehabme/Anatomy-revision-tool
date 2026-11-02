import { isBone, isLandmark } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { FillBlankQuestion, PromptKind } from '../../types/question';
import { parseBlank } from './blankParser';
import { answerItems } from '../answerMatching';
import { ownBoneNames, siteWithoutBone, withBone } from '../attachmentSites';
import { STRUCTURE_INDEX_BY_ID } from '../../data/structureIndex';
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

/** What a student may add to an answer about this structure: its own bone. */
function ownBonesOf(structure: AnatomyStructure): string[] {
  if (isLandmark(structure)) return ownBoneNames(structure, STRUCTURE_INDEX_BY_ID);
  if (!isBone(structure)) return [];
  const names = [structure.name, ...structure.aliases].map((n) => n.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase());
  return structure.id === 'pelvis' ? [...names, 'hip bone'] : names;
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
    const alsoAccepted = alsoAcceptedFor(structure, answers.length ? answers : [first.answer]);
    if (answers.length < 2) return { ...first, alsoAccepted };
    return { ...first, answer: answers.join(', '), fullStatement: same.map((q) => q.fullStatement).join('\n'), answers, alsoAccepted };
  });
}

const LANDMARK_BY_NAME = new Map(
  [...STRUCTURE_INDEX_BY_ID.values()].filter((s) => s.category === 'landmark').map((s) => [s.name.replace(/\s*\([^)]*\)/g, '').toLowerCase(), s]),
);

/** Each answer with the bone of the subject, or its own bone if it is a landmark, said or left off. */
function alsoAcceptedFor(structure: AnatomyStructure, answers: string[]): Record<string, string[]> {
  const subjectBones = ownBonesOf(structure);
  return Object.fromEntries(
    answers.map((answer) => {
      const short = siteWithoutBone(answer, STRUCTURE_INDEX_BY_ID);
      const named = LANDMARK_BY_NAME.get(answer.toLowerCase().replace(/\bthe\s+/g, '')) ?? LANDMARK_BY_NAME.get((short ?? answer).toLowerCase());
      const bones = [...new Set([...subjectBones, ...(named ? ownBoneNames(named, STRUCTURE_INDEX_BY_ID) : [])])];
      return [answer, [...(short ? [short, ...withBone(short, bones)] : []), ...withBone(answer, bones)]];
    }),
  );
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
