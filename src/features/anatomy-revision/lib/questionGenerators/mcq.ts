import { isMuscle, isBone, isJoint, isLigament, JOINT_TYPE_LABELS } from '../../types/structure';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { MCQQuestion, PromptKind } from '../../types/question';
import type { StructureIndexes } from '../indexes';
import { pickNameDistractors, pickTextFieldDistractors } from '../distractors';
import { canonicalNerveNames, conflictsWith, stripHeadPrefix } from '../oinaValues';
import { buildIdentifyClue, clueAlsoFits, ligamentCourse, summarizeStructure } from '../facts';
import { shuffle, sample, type Rng } from '../rng';
import { promptImagesFor } from './promptImages';
import { questionBase } from './questionBase';
import type { DistractorVocabulary } from '../../data/content/vocabulary';

export interface McqGenOptions {
  /** Total choices including the correct answer. Default 4. */
  choiceCount?: number;
  /** Which prompt kinds to generate per category. Omit for all supported kinds. */
  promptKinds?: PromptKind[];
  /**
   * Nerve names from structures whose facts are not loaded. The nerve
   * question is the one MCQ whose wrong answers come from the whole dataset
   * rather than from the pool it was given; see sources.ts.
   */
  vocabulary?: DistractorVocabulary;
  /**
   * The structures wrong answers are drawn from. Defaults to `structures`,
   * which is right when the caller asks about a whole session's pool at once.
   * A caller asking about ONE structure must say where its neighbours are:
   * the adaptive mode builds each question from a list of one, and with the
   * default every such question came out with the right answer as its only
   * choice (4 Oct 2026).
   */
  distractorPool?: AnatomyStructure[];
  /**
   * Somewhere wider to look when `distractorPool` cannot fill the choices: a
   * drill on one structure, or a ladder session with two structures on the
   * MCQ rung. Consulted ONLY when the first pool runs short, so a session
   * whose pool is big enough is built exactly as it was without it. The
   * caller passes structures the student is entitled to and nothing else.
   */
  fallbackPool?: AnatomyStructure[];
}

/** What an MCQ offers when the pools can fill it, the right answer included. */
export const MCQ_CHOICE_COUNT = 4;
/**
 * Fewer than this and the question is not asked. One choice is not a
 * question: it is the answer with a button on it.
 */
export const MCQ_MIN_CHOICES = 2;

const MUSCLE_KINDS: PromptKind[] = ['identify', 'origin', 'insertion', 'nerve', 'action'];
// Bones are image/spatial-recognition only for now: no text-only attachment/articulation
// detail questions, and buildOne() below also skips the text-clue identify variant for bones.
const BONE_KINDS: PromptKind[] = ['identify'];
// Attachment/articulation detail now lives in fill-blank questions (see fillBlank.ts) — one
// statement at a time is far more answerable than the old joined-string MCQ choice was.
const LANDMARK_KINDS: PromptKind[] = ['identify'];
// Joints (CR-014): identify by text clue (no image/hotspot content exists for joints yet,
// so no image-based identify variant fires — see eligibility.locate: false on joint entries),
// plus a classification question exercising the ball-and-socket/hinge/pivot/etc. taxonomy.
const JOINT_KINDS: PromptKind[] = ['identify', 'joint-type'];

function kindsFor(structure: AnatomyStructure, requested?: PromptKind[]): PromptKind[] {
  const supported = isMuscle(structure)
    ? MUSCLE_KINDS
    : isBone(structure)
      ? BONE_KINDS
      : isJoint(structure)
        ? JOINT_KINDS
        : LANDMARK_KINDS;
  return requested ? supported.filter((k) => requested.includes(k)) : supported;
}

function buildChoices(
  correctValue: string,
  distractors: string[],
  choiceCount: number,
  rng: Rng,
): { choices: string[]; correctIndex: number } {
  // De-duplicate the whole pool, not just against the correct value: distinct
  // structures can share identical text (extensor carpi radialis longus and
  // brevis have the same actionText), which would otherwise render the same
  // answer twice and make the question unanswerable.
  const pool = [...new Set([correctValue, ...distractors])].slice(0, choiceCount);
  const choices = shuffle(pool, rng);
  return { choices, correctIndex: choices.indexOf(correctValue) };
}

function baseFields(structure: AnatomyStructure, promptKind: PromptKind) {
  return { ...questionBase(structure, promptKind), type: 'mcq' as const };
}

/**
 * Builds MCQ questions for every eligible structure across the prompt kinds
 * supported by its category. Image-based "identify" variants are emitted
 * whenever a matching image exists — single-structure images need no
 * highlight (the whole image *is* the answer), atlas-slide images need a
 * populated hotspot for that structure so the UI can draw the highlight.
 */
export function buildMcqQuestions(
  structures: AnatomyStructure[],
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  rng: Rng,
  options: McqGenOptions = {},
): MCQQuestion[] {
  const { choiceCount = MCQ_CHOICE_COUNT } = options;
  const all = options.distractorPool ?? structures;
  const distractorCount = choiceCount - 1;
  const questions: MCQQuestion[] = [];

  for (const structure of structures) {
    if (!structure.eligibility.mcq) continue;

    for (const promptKind of kindsFor(structure, options.promptKinds)) {
      const built = buildOne(structure, all, options.fallbackPool, images, indexes, promptKind, distractorCount, choiceCount, rng, options.vocabulary);
      questions.push(...built.filter((q) => q.choices.length >= MCQ_MIN_CHOICES));
    }
  }

  return questions;
}

/**
 * Wrong answers from the first pick, then from `more` if it came up short.
 *
 * "Short" is counted in answers a student would SEE: distinct, and not the
 * right answer itself. Two muscles can share an action sentence, and a pick
 * that returned three values of which one was the right answer again is a
 * three-choice question that looked full.
 *
 * `more` is not called at all when the first pick is enough. That is what
 * keeps every session that never ran short byte-for-byte what it was: the
 * top-up draws from the random stream, and a draw nobody needed would move
 * every question after it.
 */
function toppedUp(
  correctValue: string,
  first: string[],
  count: number,
  more: (missing: number, taken: readonly string[]) => string[],
): string[] {
  const distinct = [...new Set(first)].filter((value) => value !== correctValue);
  if (distinct.length >= count) return first;
  return [...distinct, ...more(count - distinct.length, distinct)];
}

function buildOne(
  structure: AnatomyStructure,
  all: AnatomyStructure[],
  fallback: AnatomyStructure[] | undefined,
  images: AnatomyImageAsset[],
  indexes: StructureIndexes,
  promptKind: PromptKind,
  distractorCount: number,
  choiceCount: number,
  rng: Rng,
  vocabulary?: DistractorVocabulary,
): MCQQuestion[] {
  const out: MCQQuestion[] = [];

  if (promptKind === 'identify') {
    const promptImages = promptImagesFor(structure, images);
    const firstPick = pickNameDistractors(structure, all, distractorCount, rng);
    // A bone with no picture yields no identify question at all (below), and
    // topping up choices for a question that is never asked would only move
    // the random stream for everything after it.
    const asked = !isBone(structure) || promptImages.length > 0;
    const distractors = !asked
      ? firstPick
      : toppedUp(structure.name, firstPick, distractorCount, (missing, taken) =>
          pickNameDistractors(
            structure,
            (fallback ?? []).filter((s) => s.name !== structure.name && !taken.includes(s.name)),
            missing,
            rng,
          ),
        );

    // Text-based: clue built from the structure's own facts, answer = name.
    // Bones skip this variant — image/spatial recognition is the priority skill for them,
    // not recalling a structure from a text clue.
    // A ligament with nothing to go on but its bones, where a neighbour reaches
    // the same ones, is not asked by clue at all. Taking the neighbours out
    // left "attaches to: pelvis" beside two muscles and a trochanter, which is
    // fair and teaches nothing; its pictures still ask about it.
    const boneListOnly = isLigament(structure) && !ligamentCourse(structure);
    const sharedBoneList = boneListOnly && all.some((s) => s.id !== structure.id && clueAlsoFits(structure, s));
    // The same for anything else whose clue a neighbour shares word for word,
    // where a picture can ask instead: two plane joints that both glide.
    const sharedClue = promptImages.length > 0 && all.some((s) => s.id !== structure.id && clueAlsoFits(structure, s));
    if (!isBone(structure) && !sharedBoneList && !sharedClue) {
      // A wrong answer the clue describes just as well is a second right
      // answer: "attaches to: pelvis" beside four more ligaments of the pelvis
      // (8 Oct 2026). The picture questions below keep the first pick — there
      // the near neighbour is the wrong answer worth offering — and so does
      // every clue question that never drew one, so nothing else moves.
      const fair = (s: AnatomyStructure) => !clueAlsoFits(structure, s);
      const unfair = new Set(all.filter((s) => s.id !== structure.id && !fair(s)).map((s) => s.name));
      const clueDistractors = !distractors.some((name) => unfair.has(name))
        ? distractors
        : toppedUp(structure.name, pickNameDistractors(structure, all.filter(fair), distractorCount, rng), distractorCount, (missing, taken) =>
            pickNameDistractors(
              structure,
              (fallback ?? []).filter((s) => fair(s) && s.name !== structure.name && !taken.includes(s.name)),
              missing,
              rng,
            ),
          );
      const { choices, correctIndex } = buildChoices(structure.name, clueDistractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-identify-text`,
        prompt: `Name the structure: ${buildIdentifyClue(structure)}`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }

    // One per turntable, on the plate framed for this structure (promptImages.ts).
    for (const image of promptImages) {
      const { choices: imgChoices, correctIndex: imgCorrectIndex } = buildChoices(
        structure.name,
        distractors,
        choiceCount,
        rng,
      );
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-identify-image-${image.id}`,
        prompt: image.mode === 'atlas-slide' ? 'Which structure is highlighted?' : 'Which structure is shown?',
        promptImageId: image.id,
        choices: imgChoices,
        correctIndex: imgCorrectIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }
    return out;
  }

  if (isMuscle(structure)) {
    if (promptKind === 'origin' || promptKind === 'insertion') {
      const field = promptKind === 'origin' ? structure.origin : structure.insertion;
      const correctValue = field.join('; ');
      const sites = field.map(stripHeadPrefix);
      // A neighbour whose answer names one of this muscle's own sites is not a
      // wrong answer: "Linea aspera of the femur" was offered against adductor
      // magnus, which inserts there, and "Inferior ramus of pubis" against
      // "Inferior ramus of the pubis" (8 Oct 2026). The fact cards have
      // refused these since CR-018 (oinaValues.conflictsWith); this question
      // predates them and never did.
      const fieldOf = (s: AnatomyStructure) => {
        if (!isMuscle(s)) return undefined;
        const theirs = promptKind === 'origin' ? s.origin : s.insertion;
        return theirs.some((value) => sites.some((site) => conflictsWith(site, stripHeadPrefix(value)))) ? undefined : theirs;
      };
      const distractors = toppedUp(
        correctValue,
        pickTextFieldDistractors(correctValue, structure, all, fieldOf, distractorCount, rng),
        distractorCount,
        (missing, taken) => pickTextFieldDistractors(correctValue, structure, fallback ?? [], fieldOf, missing, rng, taken),
      );
      const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-${promptKind}`,
        prompt: `What is the ${promptKind} of ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }

    if (promptKind === 'nerve') {
      // The nerve, not which half of the muscle it reaches: "Tibial nerve
      // (long head)" was offered beside "Tibial nerve", and as a wrong answer
      // to a muscle the tibial nerve supplies. Named as the fact cards name
      // them, on both sides of the question.
      const nerves = canonicalNerveNames(structure.nerve);
      const correctValue = nerves.join('; ');
      const others = [...indexes.byNerve.keys(), ...(vocabulary?.nerves ?? [])]
        .flatMap((name) => canonicalNerveNames([{ name, roots: [] }]))
        // Nor one the muscle is authored with at all, hedged or not: pectineus
        // is "sometimes" the obturator nerve's, which is not a wrong answer.
        .filter((name) => ![...nerves, ...structure.nerve.map((n) => n.name)].some((nerve) => conflictsWith(name, nerve)));
      const distractors = sample([...new Set(others)], distractorCount, rng);
      const { choices, correctIndex } = buildChoices(correctValue, distractors, choiceCount, rng);
      if (nerves.length) out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-nerve`,
        prompt: `What nerve innervates ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }

    if (promptKind === 'action') {
      const correctValue = structure.actionText;
      // Deduped: several muscles share an identical actionText — infraspinatus
      // and teres minor are both "External rotation of the shoulder; stabilises
      // the humeral head." — and sampling a flat list could draw the same
      // string twice and render it as two separate choices (CR-018).
      // A muscle that does nothing this one does not also do describes this
      // one too: "Externally rotates the hip." is true of the gemelli, whose
      // own sentence only says more.
      const mine = new Set(structure.actions);
      const alsoTrue = (s: AnatomyStructure) => isMuscle(s) && s.actions.length > 0 && s.actions.every((a) => mine.has(a));
      const otherMuscleActionTexts = all.reduce<Set<string>>((acc, s) => {
        if (isMuscle(s) && s.id !== structure.id && !alsoTrue(s)) acc.add(s.actionText);
        return acc;
      }, new Set<string>());
      const otherActionTexts = toppedUp(correctValue, sample([...otherMuscleActionTexts], distractorCount, rng), distractorCount, (missing, taken) =>
        // Tiered like the other facts, so the muscle next door is offered
        // before one from the far end of what the student may reach.
        pickTextFieldDistractors(correctValue, structure, fallback ?? [], (s) => (isMuscle(s) && !alsoTrue(s) ? [s.actionText] : undefined), missing, rng, taken),
      );
      const { choices, correctIndex } = buildChoices(correctValue, otherActionTexts, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-action`,
        prompt: `What is the action of ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }
    return out;
  }

  if (isJoint(structure) && promptKind === 'joint-type') {
    const otherTypes = all.reduce<string[]>((acc, s) => {
      if (isJoint(s) && s.id !== structure.id) acc.push(JOINT_TYPE_LABELS[s.jointType]);
      return acc;
    }, []);
    const label = JOINT_TYPE_LABELS[structure.jointType];
    const typesOf = (pool: AnatomyStructure[]) => [
      ...new Set(pool.filter(isJoint).map((s) => JOINT_TYPE_LABELS[s.jointType])),
    ].filter((other) => other !== label);
    const picked = sample([...new Set(otherTypes)], distractorCount, rng);
    // The session's own joints are the first choice, however few kinds they
    // offer: two or three choices is this question's normal shape in a small
    // area. But a pool whose other joints are ALL this joint's type offers
    // only the right answer, twice over, and used to be asked as a one-choice
    // question. Then, and only then, the wider pool is asked.
    const distractors = picked.some((other) => other !== label) ? picked : sample(typesOf(fallback ?? []), distractorCount, rng);
    if (distractors.length > 0) {
      const { choices, correctIndex } = buildChoices(label, distractors, choiceCount, rng);
      out.push({
        ...baseFields(structure, promptKind),
        id: `mcq-${structure.id}-joint-type`,
        prompt: `What type of joint is the ${structure.name}?`,
        choices,
        correctIndex,
        explanation: summarizeStructure(structure, indexes.byId),
      });
    }
  }

  return out;
}

export function imageDepicts(image: AnatomyImageAsset, structureId: string): boolean {
  if (image.mode === 'single-structure') return image.structureId === structureId;
  return (image.hotspots ?? []).some((h) => h.structureId === structureId);
}
