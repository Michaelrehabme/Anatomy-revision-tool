import { useEffect, useState } from 'react';
import { analyticsSource } from '../data/analyticsSource';
import type { ConfusionPair, QuestionDistractorSummary } from '../types/analytics';

/** Powers the Distractor Analysis screen — per-question wrong-answer breakdowns plus the dataset-wide confusion-pairs ranking. */
export function useDistractorAnalysis() {
  const [summaries, setSummaries] = useState<QuestionDistractorSummary[]>([]);
  const [pairs, setPairs] = useState<ConfusionPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([analyticsSource.getDistractorAnalysis(), analyticsSource.getConfusionPairs()])
      .then(([summaryResult, pairResult]) => {
        if (!cancelled) {
          setSummaries(summaryResult);
          setPairs(pairResult);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load distractor analysis.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { summaries, pairs, loading, error };
}
