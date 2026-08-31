import { useEffect, useState } from 'react';
import { listStudentsInCohort } from '../data/cohortsRepository';
import { loadCohortAnalytics, type CohortAnalyticsSnapshot } from '../data/cohortAnalytics';
import type { CohortStudent } from '../types/cohort';

/** Loads a cohort's student roster, then every attempt/session for those students, then runs the CR-005 aggregation functions over just that slice — see data/cohortAnalytics.ts. */
export function useCohortAnalytics(cohortId: string | undefined) {
  const [students, setStudents] = useState<CohortStudent[] | null>(null);
  const [snapshot, setSnapshot] = useState<CohortAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId) return;
    let cancelled = false;
    setStudents(null);
    setSnapshot(null);
    setError(null);

    listStudentsInCohort(cohortId)
      .then((roster) => {
        if (cancelled) return;
        setStudents(roster);
        return loadCohortAnalytics(roster.map((s) => s.uid));
      })
      .then((result) => {
        if (!cancelled && result) setSnapshot(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load cohort analytics.');
      });

    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  return { students, snapshot, loading: !error && (students === null || snapshot === null), error };
}
