/**
 * A question id made safe to use as a Firestore document id.
 *
 * Firestore reads a `/` in an id as a path separator, so
 * users/{uid}/questionExposure/{questionId} with a slash in the id is a path
 * with one segment too many, and the SDK throws before anything is sent. One
 * question had one — the injury "Proximal biceps tendinopathy/tear" — and
 * every answer to it failed to save, with nothing shown to the student.
 *
 * Done HERE, where an id becomes a document, and not by changing the
 * question's id: that id is also what attempts and mastery records already
 * stored are keyed by.
 */
export function questionDocId(questionId: string): string {
  return questionId.replace(/\//g, '_');
}
