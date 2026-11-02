/**
 * What a student has typed and had marked, before the session records it.
 *
 * A typed question records its answer at the confidence rating, but the moment
 * to say "my answer should have counted" is when the mark appears, one step
 * before that. So a report from there went out with no answer on it, and the
 * one thing that report needs was missing (student reports, 1 Nov 2026). The
 * typed screens note the answer when they mark it, and the report reads it when
 * it sends: nothing re-renders for it and the session is not touched.
 */
let pending: { questionId: string; answer: string } | null = null;

export function notePendingAnswer(questionId: string, answer: string): void {
  pending = { questionId, answer };
}

export function pendingAnswerFor(questionId: string): string | undefined {
  return pending?.questionId === questionId ? pending.answer : undefined;
}
