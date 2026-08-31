import { areaOf } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { MCQQuestion, PromptKind } from '../../types/question';
import { shuffle, sample, type Rng } from '../rng';

const CHOICE_COUNT = 4;

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return {
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: areaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
    type: 'mcq' as const,
  };
}

function buildChoices(correctValue: string, distractors: string[], rng: Rng): { choices: string[]; correctIndex: number } {
  const pool = [correctValue, ...distractors.filter((d) => d !== correctValue)].slice(0, CHOICE_COUNT);
  const choices = shuffle(pool, rng);
  return { choices, correctIndex: choices.indexOf(correctValue) };
}

/** "Which myotome is tested by resisted contraction of X?" — only for structures explicitly used in the standard bedside myotome exam (see the `myotome` field's own doc comment). */
function buildMyotomeQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  const withMyotome = structures.filter((s) => s.myotome?.length);
  const questions: MCQQuestion[] = [];

  for (const structure of withMyotome) {
    const correctValue = structure.myotome!.join('/');
    const otherValues = withMyotome.filter((s) => s.id !== structure.id).map((s) => s.myotome!.join('/'));
    const distractors = sample([...new Set(otherValues)], CHOICE_COUNT - 1, rng);
    if (distractors.length < 1) continue;

    const { choices, correctIndex } = buildChoices(correctValue, distractors, rng);
    questions.push({
      ...baseFields(structure, 'myotome'),
      id: `clinical-${structure.id}-myotome`,
      prompt: `Resisted contraction of ${structure.name} primarily tests which myotome?`,
      choices,
      correctIndex,
      explanation: `${structure.name} is used to test the ${correctValue} myotome in the standard bedside exam.`,
    });
  }

  return questions;
}

/** "How is X best palpated?" */
function buildPalpationQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  const withNotes = structures.filter((s) => s.palpationNotes);
  const questions: MCQQuestion[] = [];

  for (const structure of withNotes) {
    const correctValue = structure.palpationNotes!;
    const otherValues = withNotes.filter((s) => s.id !== structure.id).map((s) => s.palpationNotes!);
    const distractors = sample([...new Set(otherValues)], CHOICE_COUNT - 1, rng);
    if (distractors.length < 1) continue;

    const { choices, correctIndex } = buildChoices(correctValue, distractors, rng);
    questions.push({
      ...baseFields(structure, 'palpation'),
      id: `clinical-${structure.id}-palpation`,
      prompt: `How is ${structure.name} best palpated?`,
      choices,
      correctIndex,
      explanation: correctValue,
    });
  }

  return questions;
}

/** "Which special test assesses X integrity?" — one question per authored special test. */
function buildSpecialTestQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  const withTests = structures.filter((s) => s.specialTests?.length);
  const allTestNames = withTests.flatMap((s) => s.specialTests!.map((t) => t.name));
  const questions: MCQQuestion[] = [];

  for (const structure of withTests) {
    for (const test of structure.specialTests!) {
      const otherNames = allTestNames.filter((n) => n !== test.name);
      const distractors = sample([...new Set(otherNames)], CHOICE_COUNT - 1, rng);
      if (distractors.length < 1) continue;

      const { choices, correctIndex } = buildChoices(test.name, distractors, rng);
      questions.push({
        ...baseFields(structure, 'special-test'),
        id: `clinical-${structure.id}-special-test-${test.name.toLowerCase().replace(/\s+/g, '-')}`,
        prompt: `Which special test assesses ${structure.name} integrity?`,
        choices,
        correctIndex,
        explanation: `${test.name}: ${test.description} A positive finding is ${test.positiveFinding}`,
      });
    }
  }

  return questions;
}

/**
 * Clinical vignette -> structure, built from each authored injury's
 * presentation — matches the CR's own example ("A patient cannot resist
 * elbow flexion with the forearm pronated..."). Not muscle-only: a joint's
 * commonInjuries (e.g. an AC joint separation) make an equally valid
 * vignette, so this runs over whichever structures actually have the field
 * authored, regardless of category.
 */
function buildInjuryMechanismQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  const withInjuries = structures.filter((s) => s.commonInjuries?.length);
  const questions: MCQQuestion[] = [];

  for (const structure of withInjuries) {
    for (const injury of structure.commonInjuries!) {
      const distractors = sample(
        withInjuries.filter((s) => s.id !== structure.id).map((s) => s.name),
        CHOICE_COUNT - 1,
        rng,
      );
      if (distractors.length < 1) continue;

      const { choices, correctIndex } = buildChoices(structure.name, distractors, rng);
      questions.push({
        ...baseFields(structure, 'injury-mechanism'),
        id: `clinical-${structure.id}-injury-${injury.name.toLowerCase().replace(/\s+/g, '-')}`,
        prompt: `${injury.presentation} Which structure is most likely involved?`,
        choices,
        correctIndex,
        explanation: `${injury.name} — mechanism: ${injury.mechanism}`,
      });
    }
  }

  return questions;
}

/** "Which of these movements is X most responsible for?" */
function buildFunctionalQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  const withContext = structures.filter((s) => s.functionalContext);
  const questions: MCQQuestion[] = [];

  for (const structure of withContext) {
    const correctValue = structure.functionalContext!;
    const otherValues = withContext.filter((s) => s.id !== structure.id).map((s) => s.functionalContext!);
    const distractors = sample([...new Set(otherValues)], CHOICE_COUNT - 1, rng);
    if (distractors.length < 1) continue;

    const { choices, correctIndex } = buildChoices(correctValue, distractors, rng);
    questions.push({
      ...baseFields(structure, 'functional'),
      id: `clinical-${structure.id}-functional`,
      prompt: `${structure.name} is most responsible for which of these?`,
      choices,
      correctIndex,
      explanation: correctValue,
    });
  }

  return questions;
}

/**
 * All 5 CR-010 clinical prompt kinds. Every builder is gated on the
 * corresponding optional field actually being authored — a structure with
 * no clinical content simply generates none of these, which is why all the
 * new structure fields being optional matters (existing content stays valid).
 */
export function buildClinicalQuestions(structures: AnatomyStructure[], rng: Rng): MCQQuestion[] {
  return [
    ...buildMyotomeQuestions(structures, rng),
    ...buildPalpationQuestions(structures, rng),
    ...buildSpecialTestQuestions(structures, rng),
    ...buildInjuryMechanismQuestions(structures, rng),
    ...buildFunctionalQuestions(structures, rng),
  ];
}
