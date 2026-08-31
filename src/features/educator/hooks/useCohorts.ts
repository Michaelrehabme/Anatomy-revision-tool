import { useEffect, useState } from 'react';
import { listCohortsByIds } from '../data/cohortsRepository';
import type { Cohort } from '../types/cohort';
import { useEducatorClaims } from '../components/RequireEducator';

/** Every cohort this educator is claimed for (scripts/setEducator.ts) — the set a cohort switcher picks from. */
export function useCohorts() {
  const { cohorts: cohortIds } = useEducatorClaims();
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCohortsByIds(cohortIds)
      .then((result) => {
        if (!cancelled) setCohorts(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load cohorts.');
      });
    return () => {
      cancelled = true;
    };
    // cohortIds comes from the educator's ID token claims, set once by RequireEducator and stable for the session — safe as the sole dependency.
  }, [cohortIds]);

  return { cohorts, loading: cohorts === null && !error, error };
}
