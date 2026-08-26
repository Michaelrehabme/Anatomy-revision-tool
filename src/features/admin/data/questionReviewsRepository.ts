import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getDb, getFirebaseAuth } from '../../anatomy-revision/data/firebase';
import type { QuestionHealthFlagType, QuestionReview } from '../types/analytics';

/**
 * Admin-only collection — see firestore.rules for the request.auth.token.admin
 * == true rule that enforces this. questionId is the document id, so marking
 * the same question reviewed twice is an idempotent overwrite, not a new row.
 */
const COLLECTION = 'questionReviews';

export async function listReviewedQuestionIds(): Promise<Set<string>> {
  const snapshot = await getDocs(collection(getDb(), COLLECTION));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function markQuestionReviewed(
  questionId: string,
  flagType: QuestionHealthFlagType,
  notes?: string,
): Promise<void> {
  const uid = getFirebaseAuth().currentUser?.uid ?? 'unknown';
  const review: QuestionReview = {
    questionId,
    reviewedBy: uid,
    reviewedAt: new Date().toISOString(),
    flagType,
    ...(notes ? { notes } : {}),
  };
  await setDoc(doc(getDb(), COLLECTION, questionId), review);
}
