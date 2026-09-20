import type { PromptKind, QuestionType, RevisionQuestion } from '../types/question';
import { questionLocationLabel } from '../types/region';

/**
 * One name per question format, used by the pickers AND by the session
 * headers.
 *
 * WHY THIS IS SHARED. The two disagreed. The setup screen offered "Type
 * answer"; the session that format opens headed itself "IDENTIFY", because it
 * printed the question's promptKind rather than its format. So the app used
 * "Identify" for a question you type and "Locate" for the one you tap, while
 * the picker had no "Identify" in it at all — a student looking for the
 * question they had just answered could not find it in the list. A label that
 * only exists at one end of a journey is how that happens, so both ends now
 * read from here.
 *
 * FILL THE BLANK IS LABELLED BUT NOT OFFERED, and that is deliberate — see
 * PICKABLE_FORMATS below. Every type still gets a label here, because a label
 * is what a session header reads, and a type that can be generated can reach a
 * screen however it got there.
 *
 * The order is the picker's order, shortest-to-answer first.
 */
export const QUESTION_FORMAT_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  'identify-typed': 'Type answer',
  flashcard: 'Flashcard',
  // "Multi-select", not "Select all": that name sat one chip along from the
  // picker's own select-everything control and read as a second one.
  'multi-select': 'Multi-select',
  'fill-blank': 'Fill the blank',
  locate: 'Locate',
  oina: 'OINA Cards',
};

/**
 * The formats a student can choose. This is not every QuestionType, and the
 * gap is `fill-blank`.
 *
 * It generates 294 questions and 285 of them never name the structure they are
 * about, because the generator blanks a word out of an attachment record
 * rather than writing a question round it: "______ origin — supraglenoid
 * tubercle" (scapula), "______ origin" (medial malleolus), "Ankle joint with
 * the ______" (talus). Its session screen is unfinished to match — no header,
 * no centred column, no confidence buttons. That is why it was in no picker,
 * and it stays out of this one until the stems name their subject. See CR-035.
 *
 * It is a list rather than an omission from the labels so that the reason
 * lives next to the decision, and so a session that somehow contains one still
 * has a name to print above it.
 */
const PICKABLE: QuestionType[] = ['mcq', 'identify-typed', 'flashcard', 'multi-select', 'locate', 'oina'];

export const QUESTION_FORMATS: { value: QuestionType; label: string }[] = PICKABLE.map((value) => ({
  value,
  label: QUESTION_FORMAT_LABELS[value],
}));

/**
 * The facts a question can be about, as a student would say them. Only the
 * kinds a format actually varies over need a label — see promptKindLabel.
 */
const PROMPT_KIND_LABELS: Partial<Record<PromptKind, string>> = {
  origin: 'Origin',
  insertion: 'Insertion',
  nerve: 'Nerve',
  action: 'Action',
  attachment: 'Attachment',
  articulation: 'Articulation',
  'group-membership': 'Group',
  myotome: 'Myotome',
  palpation: 'Palpation',
  'special-test': 'Special test',
  'injury-mechanism': 'Injury mechanism',
  functional: 'Function',
  'joint-type': 'Joint type',
  'joint-movement': 'Movement',
};

/**
 * The fact a question asks about, or null when the format IS the whole story.
 *
 * `identify` is the null case on purpose: "Multiple choice · Identify · Knee"
 * says the same thing twice, since every format identifies something. It is
 * also the word that caused the collision this module exists to settle.
 */
export function promptKindLabel(kind: PromptKind): string | null {
  if (kind === 'identify') return null;
  return PROMPT_KIND_LABELS[kind] ?? kind[0].toUpperCase() + kind.slice(1);
}

/**
 * The line above the question: its format, the fact it asks about when that
 * adds anything, and where in the body it is.
 *
 * MCQ is the reason the fact survives here rather than being replaced. It
 * spans eleven prompt kinds — origin, nerve, myotome, special test — and
 * "Multiple choice · Knee" over a question about a nerve supply would be a
 * worse header than the one it replaced. Typed identify carries only
 * `identify`, so there it collapses to the format and the place.
 */
export function questionHeaderLabel(question: RevisionQuestion): string {
  const parts = [QUESTION_FORMAT_LABELS[question.type]];
  const fact = promptKindLabel(question.promptKind);
  if (fact) parts.push(fact);
  const where = questionLocationLabel(question);
  if (where) parts.push(where);
  return parts.join(' · ');
}
