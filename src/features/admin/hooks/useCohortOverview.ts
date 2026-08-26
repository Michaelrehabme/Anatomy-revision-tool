import { useEffect, useState } from 'react';
import { analyticsSource } from '../data/analyticsSource';
import type { CohortOverview } from '../types/analytics';

export function useCohortOverview() {
  const [overview, setOverview] = useState<CohortOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    analyticsSource
      .getCohortOverview()
      .then((result) => {
        if (!cancelled) {
          setOverview(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load cohort overview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { overview, loading, error };
}
