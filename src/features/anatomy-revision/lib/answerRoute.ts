import type { PromptKind, QuestionType } from '../types/question';

/**
 * HOW a question was answered, when that is not how it was asked.
 *
 * A locate question can be answered in words instead of on the picture
 * (lib/questionGenerators/describedRegion.ts). The question in the session is
 * still the locate question — the set a session is built from does not change
 * with how anyone chooses to answer — so the answer carries this to say what
 * was actually done.
 *
 * (Choosing from the list of names carries nothing: it has always been
 * recorded as the locate question it stands in for, and still is.)
 */
export type AnswerRoute = 'described-region';

/**
 * Whether a described-region answer is credited as the locate question it
 * replaced. THE OWNER HAS NOT DECIDED (docs/accessibility-locate.md), so the
 * two are kept apart and this is the one switch:
 *
 *   false  it is a question of its own. Its progress and review schedule live
 *          on a 'described-region' fact row for the structure, like any other
 *          fact asked as multiple choice; the structure's own row — which a
 *          tap on the picture moves — is untouched. It earns multiple-choice
 *          XP. A student who answers every locate question in words is never
 *          shown as having located anything.
 *   true   it moves the structure's row and earns locate XP exactly as a tap
 *          would, so a student who cannot see is not held back by it.
 *
 * Either way the stored ATTEMPT says what happened — questionType 'mcq',
 * promptKind 'described-region' — so a report comparing locate accuracy
 * across students can always tell the two apart, and flipping this later
 * loses nothing already recorded.
 */
export const DESCRIBED_REGION_COUNTS_AS_LOCATE = false;

export interface AskedAs {
  /** What the attempt row says was asked. */
  recorded: { type: QuestionType; promptKind: PromptKind };
  /** What progress, scheduling and XP treat it as. */
  credited: { type: QuestionType; promptKind: PromptKind };
}

/** What an answer is recorded and credited as, given the question it answered and the route it took. */
export function askedAs(
  question: { type: QuestionType; promptKind: PromptKind },
  route: AnswerRoute | undefined,
  countsAsLocate: boolean = DESCRIBED_REGION_COUNTS_AS_LOCATE,
): AskedAs {
  const own = { type: question.type, promptKind: question.promptKind };
  if (route !== 'described-region') return { recorded: own, credited: own };
  const words = { type: 'mcq' as const, promptKind: 'described-region' as const };
  return { recorded: words, credited: countsAsLocate ? own : words };
}
