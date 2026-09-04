import { isMuscle, areaOf } from '../../types/structure';
import type { AnatomyStructure, MuscleStructure } from '../../types/structure';
import type { FactMastery } from '../../types/attempt';
import type { OinaPromptKind, OinaQuestion, OinaSelectQuestion, OinaTypedQuestion } from '../../types/question';
import { OINA_PROMPT_KINDS } from '../../types/question';
import type { StructureIndexes } from '../indexes';
import { pickItemDistractors, pickTieredKeyDistractors } from '../distractors';
import { describeFact } from '../facts';
import { shuffle, sample, type Rng } from '../rng';
import { acceptedVariantsFor } from '../oinaAnswer';
import {
  actionsConflict,
  canonicalNerveNames,
  conflictsWith,
  humanizeActionTag,
  stripHeadPrefix,
} from '../oinaValues';
import { factMasteryKey, pickOinaFormat } from '../factMastery';

/**
 * OINA Cards (CR-018): one question per (muscle, fact), asked about each
 * authored value individually rather than about the whole field joined into
 * one string the way mcq.ts does it.
 */
export interface OinaGenOptions {
  /** Which of the four facts to generate. Omit for all of them. */
  promptKinds?: readonly OinaPromptKind[];
  /** Drives the select/typed escalation per (muscle, fact). Omit and everything stays on select. */
  factMastery?: readonly FactMastery[];
  /** Overrides the escalation entirely — the setup screen's explicit difficulty override. */
  forceFormat?: 'select' | 'typed';
}

/**
 * Distractors offered beyond the correct answers, so a question shows
 * correctCount + 3 choices, capped so a five-action muscle doesn't produce an
 * eight-button wall. Not fewer: with 104 of 122 insertions having a single
 * value, three distractors is already the floor for the question to be worth
 * asking.
 */
const DISTRACTOR_COUNT = 3;
const MAX_CHOICES = 7;
/** Below this a select question is answerable by elimination, so it is not emitted. */
const MIN_DISTRACTORS = 2;

const FACT_NOUN: Record<OinaPromptKind, string> = {
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve supply',
  action: 'action',
};

/** Carries the preposition, since "nerves supplying X" does not take "of". */
const FACT_NOUN_PLURAL: Record<OinaPromptKind, string> = {
  origin: 'origins of',
  insertion: 'insertions of',
  nerve: 'nerves supplying',
  action: 'actions of',
};

/**
 * The answerable values for one fact of one muscle: head prefixes stripped so
 * a prefixed choice is not the answer by shape alone, and deduplicated —
 * triceps brachii's lateral and medial heads both read "Posterior humerus"
 * once the prefix is gone, and two identical choice buttons is not a question.
 */
export function correctValuesFor(muscle: MuscleStructure, promptKind: OinaPromptKind): string[] {
  switch (promptKind) {
    case 'origin':
      return [...new Set(muscle.origin.map(stripHeadPrefix))];
    case 'insertion':
      return [...new Set(muscle.insertion.map(stripHeadPrefix))];
    case 'nerve':
      return canonicalNerveNames(muscle.nerve);
    case 'action':
      return [...new Set(muscle.actions)];
  }
}

/** The authored value behind each canonical one, so typed answers accept the original wording too. */
function rawValuesFor(muscle: MuscleStructure, promptKind: OinaPromptKind): Map<string, string> {
  const map = new Map<string, string>();
  if (promptKind === 'origin' || promptKind === 'insertion') {
    for (const raw of promptKind === 'origin' ? muscle.origin : muscle.insertion) {
      const canonical = stripHeadPrefix(raw);
      if (!map.has(canonical)) map.set(canonical, raw);
    }
  }
  return map;
}

function baseFields(structure: MuscleStructure, promptKind: OinaPromptKind) {
  return {
    type: 'oina' as const,
    structureId: structure.id,
    region: structure.region,
    subregion: structure.subregion,
    area: areaOf(structure),
    category: structure.category,
    difficulty: structure.difficulty,
    promptKind,
  };
}

/** Action tags compare by equivalence group; everything else by wording overlap. */
function rejectsFor(promptKind: OinaPromptKind) {
  return promptKind === 'action' ? actionsConflict : conflictsWith;
}

function buildDistractors(
  muscle: MuscleStructure,
  all: AnatomyStructure[],
  indexes: StructureIndexes,
  promptKind: OinaPromptKind,
  correctValues: string[],
  rng: Rng,
): string[] {
  const reject = rejectsFor(promptKind);

  if (promptKind === 'origin' || promptKind === 'insertion') {
    return pickItemDistractors(
      correctValues,
      muscle,
      all,
      (s) => (isMuscle(s) ? (promptKind === 'origin' ? s.origin : s.insertion) : undefined),
      stripHeadPrefix,
      DISTRACTOR_COUNT,
      rng,
      reject,
    );
  }

  // Nerve and action alternatives are drawn from the muscles nearest this one
  // — same group first, then region — so they cannot be eliminated on region
  // alone. Nerve names are canonicalised on the way out, or "Deep fibular
  // (peroneal) nerve" is offered against "Deep fibular nerve".
  const keysOf = (s: AnatomyStructure): string[] => {
    if (!isMuscle(s)) return [];
    return promptKind === 'nerve' ? canonicalNerveNames(s.nerve) : s.actions;
  };
  const tiered = pickTieredKeyDistractors(correctValues, muscle, all, keysOf, DISTRACTOR_COUNT, rng, reject);
  if (tiered.length >= DISTRACTOR_COUNT) return tiered;

  // A muscle whose neighbours all share its nerve can run short — the
  // hamstrings are all tibial nerve, so every group-mate's key is rejected as
  // a true answer. Top up from the dataset-wide index rather than dropping
  // the question; these are the eliminable-by-region ones, so they are a last
  // resort, not the first choice.
  const index = promptKind === 'nerve' ? indexes.byNerve : indexes.byAction;
  const globalKeys = (
    promptKind === 'nerve'
      ? [...index.keys()].flatMap((key) => canonicalNerveNames([{ name: key, roots: [] }]))
      : [...index.keys()]
  ).filter((key) => !tiered.includes(key) && !correctValues.some((correctValue) => reject(correctValue, key)));
  return [...tiered, ...sample([...new Set(globalKeys)], DISTRACTOR_COUNT - tiered.length, rng)];
}

function buildSelect(
  muscle: MuscleStructure,
  promptKind: OinaPromptKind,
  correctValues: string[],
  distractors: string[],
  display: (value: string) => string,
  rng: Rng,
): OinaSelectQuestion | null {
  if (distractors.length < MIN_DISTRACTORS) return null;
  const room = Math.max(MIN_DISTRACTORS, Math.min(MAX_CHOICES - correctValues.length, DISTRACTOR_COUNT));
  const used = distractors.slice(0, room);
  if (used.length < MIN_DISTRACTORS) return null;

  const correctSet = new Set(correctValues);
  const choiceValues = shuffle([...correctValues, ...used], rng);
  return {
    ...baseFields(muscle, promptKind),
    format: 'select',
    id: `oina-${muscle.id}-${promptKind}-select`,
    prompt: `Select every ${FACT_NOUN[promptKind]} of ${muscle.name}.`,
    choices: choiceValues.map(display),
    correctIndices: choiceValues.flatMap((value, index) => (correctSet.has(value) ? [index] : [])),
    explanation: describeFact(muscle, promptKind),
  };
}

function buildTyped(
  muscle: MuscleStructure,
  promptKind: OinaPromptKind,
  correctValues: string[],
  display: (value: string) => string,
): OinaTypedQuestion {
  const raws = rawValuesFor(muscle, promptKind);
  const multiple = correctValues.length > 1;
  const slots = correctValues.map((value, index) => ({
    // The label states the count. With 104 of 122 insertions having a single
    // value, a student who sees two boxes should read that as the shape of the
    // answer, not as a trick.
    label: multiple ? `${FACT_NOUN[promptKind]} ${index + 1} of ${correctValues.length}` : FACT_NOUN[promptKind],
    accepted: acceptedVariantsFor(promptKind, raws.get(value) ?? display(value)),
  }));

  return {
    ...baseFields(muscle, promptKind),
    format: 'typed',
    id: `oina-${muscle.id}-${promptKind}-typed`,
    prompt: multiple
      ? `Name all ${correctValues.length} ${FACT_NOUN_PLURAL[promptKind]} ${muscle.name}.`
      : `What is the ${FACT_NOUN[promptKind]} of ${muscle.name}?`,
    slots,
    explanation: describeFact(muscle, promptKind),
  };
}

export function buildOinaQuestions(
  structures: AnatomyStructure[],
  all: AnatomyStructure[],
  indexes: StructureIndexes,
  rng: Rng,
  options: OinaGenOptions = {},
): OinaQuestion[] {
  const promptKinds = options.promptKinds?.length ? options.promptKinds : OINA_PROMPT_KINDS;
  const masteryByKey = new Map(
    (options.factMastery ?? []).map((f) => [factMasteryKey(f.structureId, f.promptKind), f]),
  );
  const questions: OinaQuestion[] = [];

  for (const structure of structures) {
    if (!isMuscle(structure) || !structure.eligibility.mcq) continue;

    for (const promptKind of promptKinds) {
      const correctValues = correctValuesFor(structure, promptKind);
      // A muscle whose only authored nerve was a bare root designation has
      // nothing answerable here — skip rather than emit a question with no
      // correct answer. See canonicalNerveNames.
      if (correctValues.length === 0) continue;

      const display = promptKind === 'action' ? humanizeActionTag : (value: string) => value;
      const format =
        options.forceFormat ?? pickOinaFormat(masteryByKey.get(factMasteryKey(structure.id, promptKind)));

      if (format === 'typed') {
        questions.push(buildTyped(structure, promptKind, correctValues, display));
        continue;
      }

      const distractors = buildDistractors(structure, all, indexes, promptKind, correctValues, rng);
      const question = buildSelect(structure, promptKind, correctValues, distractors, display, rng);
      if (question) questions.push(question);
    }
  }

  return questions;
}
