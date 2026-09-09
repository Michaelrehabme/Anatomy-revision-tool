import { useEffect, useState } from 'react';
import { listStudentsInCohort } from '../data/cohortsRepository';
import { loadCohortAnalytics, type CohortAnalyticsSnapshot } from '../data/cohortAnalytics';
import type { CohortStudent } from '../types/cohort';

/** Loads a cohort's student roster, then the cohort's rollup counters and those students' session summaries — see data/cohortAnalytics.ts. Attempt rows are deliberately never read (CR-031). */
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
        return loadCohortAnalytics(cohortId, roster.map((s) => s.uid));
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
