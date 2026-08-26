import { useEffect, useState } from 'react';
import { analyticsSource } from '../data/analyticsSource';
import { STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT } from '../lib/analyticsAggregation';
import type { AnalyticsFilters, StructureWeaknessRow } from '../types/analytics';

export function useStructureWeakness(filters: AnalyticsFilters, minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT) {
  const [rows, setRows] = useState<StructureWeaknessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    analyticsSource
      .getStructureWeakness(filters, minAttempts)
      .then((result) => {
        if (!cancelled) {
          setRows(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load structure weakness data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, minAttempts]);

  return { rows, loading, error };
}
