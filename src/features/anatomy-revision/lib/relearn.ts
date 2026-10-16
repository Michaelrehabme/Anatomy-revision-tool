import type { FlashcardQuestion, MCQQuestion, RevisionQuestion } from '../types/question';
import type { RevisionSetupParams } from '../hooks/useRevisionSession';

/**
 * WRONG THREE TIMES RUNNING, LEARN IT AGAIN NOW (owner, 16 October 2026).
 *
 * When a student misses the same skill for the third graded answer in a row,
 * the session shows the card that teaches it next, and then, two questions
 * after the card, asks the same question again with the same choices. The
 * point is short-term memory: seeing the answer and then retrieving it a
 * minute later, while the review schedule still brings it back tomorrow.
 *
 * The repeat is PRACTICE, NOT SCORED. It was answered with the answer fresh on
 * screen, so counting it would lift the score and push the next review out on
 * the strength of a minute's memory. Neither it nor the card moves the
 * schedule; the miss that triggered them already did.
 *
 * "In a row" is counted on the progress record the answer updates (the
 * structure's naming row, or the fact's row), so it runs across sessions:
 * two misses yesterday and one today is three.
 */
export const RELEARN_AFTER_WRONG = 3;
/** Questions between the card and the repeat. */
export const REASK_GAP = 2;

/** The count after one graded answer. */
export function nextWrongInARow(previous: number | undefined, correct: boolean): number {
  return correct ? 0 : (previous ?? 0) + 1;
}

/**
 * Practice sessions only. An exam and a class assignment test, and must ask
 * exactly what was set; a student who turned learn cards off has said no to
 * cards; the trial and the diagnostic papers never reach this hook's answers.
 */
export function relearnAllowed(params: RevisionSetupParams | null): boolean {
  if (!params) return false;
  if (params.mode === 'assessment') return false;
  if (params.assignment) return false;
  if (params.learnCardAttempts !== undefined && params.learnCardAttempts <= 0) return false;
  return true;
}

/** True for anything that counts towards the score and the question counter. */
export function isScoredQuestion(question: RevisionQuestion): boolean {
  return question.type !== 'flashcard' && !(question.type === 'mcq' && question.reask);
}

/**
 * The session's questions with the card placed straight after the current
 * one and the repeat REASK_GAP questions after the card, or at the end when
 * the session is shorter than that. Once per question per session.
 */
export function withRelearn(questions: RevisionQuestion[], currentIndex: number, question: MCQQuestion, card: FlashcardQuestion): RevisionQuestion[] {
  if (questions.some((q) => q.type === 'mcq' && q.reask && q.id === question.id)) return questions;
  const reask: MCQQuestion = { ...question, reask: true, relearnCard: undefined };
  const out = [...questions];
  out.splice(currentIndex + 1, 0, card);
  const at = Math.min(currentIndex + 2 + REASK_GAP, out.length);
  out.splice(at, 0, reask);
  return out;
}
