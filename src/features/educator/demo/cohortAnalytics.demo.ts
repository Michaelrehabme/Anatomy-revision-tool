import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import type { RevisionSessionSummary, UserAttempt } from '../../anatomy-revision/types/attempt';
import {
  aggregateStructureWeakness,
  aggregateConfusionPairs,
  aggregateAccuracyByRegion,
  aggregateActiveUsersByDay,
  computeRetention,
  computeSessionMetrics,
  STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
} from '../../admin/lib/analyticsAggregation';
import type { CohortAnalyticsSnapshot } from '../data/cohortAnalytics';
import { demoAttempts, demoSessionSummaries } from './demoData';

/**
 * Demo-mode stand-in for data/cohortAnalytics.ts (README "Educator demo
 * mode"). Only the fetch is replaced: the same CR-005 aggregation functions
 * run over the generated attempts, so the numbers on screen are really
 * computed, not typed in. What demo mode therefore does NOT exercise is the
 * repository/Firestore read path itself — if you are debugging a query or a
 * security rule, demo mode is the wrong tool and will happily show you a
 * working screen.
 */

export type { CohortAnalyticsSnapshot } from '../data/cohortAnalytics';

export async function loadCohortAnalytics(
  studentUids: string[],
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): Promise<CohortAnalyticsSnapshot> {
  const attemptsByUid = new Map<string, UserAttempt[]>(studentUids.map((uid) => [uid, demoAttempts(uid)]));
  const summariesByUid = new Map<string, RevisionSessionSummary[]>(
    studentUids.map((uid) => [uid, demoSessionSummaries(uid)]),
  );
  const attempts = [...attemptsByUid.values()].flat();
  const summaries = [...summariesByUid.values()].flat();
  const sessionMetrics = computeSessionMetrics(attempts, summaries);

  return {
    overview: {
      activeStudentCount: new Set(attempts.map((a) => a.userId)).size,
      activeUsersByDay: aggregateActiveUsersByDay(attempts),
      accuracyByRegion: aggregateAccuracyByRegion(attempts),
      retention: computeRetention(attempts),
      meanSessionLengthMinutes: sessionMetrics.meanSessionLengthMinutes,
      completionRatePct: sessionMetrics.completionRatePct,
      totalSessions: sessionMetrics.totalSessions,
    },
    structureWeakness: aggregateStructureWeakness(attempts, ALL_STRUCTURES, {}, minAttempts),
    confusionPairs: aggregateConfusionPairs(attempts),
    attemptsByUid,
    summariesByUid,
  };
}

export function structureWeaknessForStudent(attempts: UserAttempt[]) {
  return aggregateStructureWeakness(attempts, ALL_STRUCTURES, {}, 1);
}
