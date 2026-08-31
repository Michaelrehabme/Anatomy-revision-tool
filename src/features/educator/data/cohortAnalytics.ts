import { getRepository } from '../../anatomy-revision/data/repository';
import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import type { UserAttempt, RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import {
  aggregateStructureWeakness,
  aggregateConfusionPairs,
  aggregateAccuracyByRegion,
  aggregateActiveUsersByDay,
  computeRetention,
  computeSessionMetrics,
  STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
} from '../../admin/lib/analyticsAggregation';
import type { CohortOverview, StructureWeaknessRow, ConfusionPair } from '../../admin/types/analytics';

/**
 * Cohort-scoped counterpart to admin/data/analyticsSource.ts: same pure
 * aggregation functions from CR-005, fed a set of attempts bounded to one
 * cohort's students instead of the whole platform. Fetches one
 * listAttempts/listSessionSummaries call per student (a bounded N+1 — same
 * accepted pattern analyticsSource.ts already documents for the platform-
 * wide cohort overview) rather than adding a multi-userId query to
 * AnatomyRepository, since a class-sized cohort keeps this cheap.
 */

const PER_STUDENT_ATTEMPT_LIMIT = 5000;
const SESSION_SUMMARIES_PER_STUDENT = 300;

export interface CohortAnalyticsSnapshot {
  overview: CohortOverview & { activeStudentCount: number };
  structureWeakness: StructureWeaknessRow[];
  confusionPairs: ConfusionPair[];
  attemptsByUid: Map<string, UserAttempt[]>;
  summariesByUid: Map<string, RevisionSessionSummary[]>;
}

async function loadAttempts(studentUids: string[]): Promise<Map<string, UserAttempt[]>> {
  const repository = await getRepository();
  const perStudent = await Promise.all(
    studentUids.map((uid) => repository.listAttempts({ userId: uid, limit: PER_STUDENT_ATTEMPT_LIMIT })),
  );
  return new Map(studentUids.map((uid, i) => [uid, perStudent[i]]));
}

export async function loadCohortAnalytics(
  studentUids: string[],
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): Promise<CohortAnalyticsSnapshot> {
  const [attemptsByUid, repository] = await Promise.all([loadAttempts(studentUids), getRepository()]);
  const attempts = [...attemptsByUid.values()].flat();

  const summariesPerStudent = await Promise.all(
    studentUids.map((uid) => repository.listSessionSummaries(uid, SESSION_SUMMARIES_PER_STUDENT)),
  );
  const summariesByUid = new Map(studentUids.map((uid, i) => [uid, summariesPerStudent[i]]));
  const summaries: RevisionSessionSummary[] = summariesPerStudent.flat();
  const sessionMetrics = computeSessionMetrics(attempts, summaries);
  const activeStudentCount = new Set(attempts.map((a) => a.userId)).size;

  return {
    overview: {
      activeStudentCount,
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

/** Per-student weakest structures for the drill-down screen — same function as the cohort table, minAttempts=1 since one student will never clear the cohort-wide threshold. */
export function structureWeaknessForStudent(attempts: UserAttempt[]): StructureWeaknessRow[] {
  return aggregateStructureWeakness(attempts, ALL_STRUCTURES, {}, 1);
}
