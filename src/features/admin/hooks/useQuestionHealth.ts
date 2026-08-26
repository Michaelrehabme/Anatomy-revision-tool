import { useCallback, useEffect, useState } from 'react';
import { analyticsSource } from '../data/analyticsSource';
import { markQuestionReviewed } from '../data/questionReviewsRepository';
import type { QuestionHealthFlag, QuestionHealthFlagType } from '../types/analytics';

export function useQuestionHealth() {
  const [flags, setFlags] = useState<QuestionHealthFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFlags(await analyticsSource.getQuestionHealth());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question health data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Persists the review, then drops it from local state immediately — it must not resurface until the flagging statistics genuinely change. */
  const markReviewed = useCallback(async (questionId: string, flagType: QuestionHealthFlagType, notes?: string) => {
    await markQuestionReviewed(questionId, flagType, notes);
    setFlags((prev) => prev.filter((f) => f.questionId !== questionId));
  }, []);

  return { flags, loading, error, markReviewed };
}
