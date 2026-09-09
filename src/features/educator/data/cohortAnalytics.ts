import { getDb } from '../../anatomy-revision/data/firebase';
import { getRepository } from '../../anatomy-revision/data/repository';
import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import type { RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import { STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT } from '../../admin/lib/analyticsAggregation';
import type { CohortOverview, StructureWeaknessRow, ConfusionPair } from '../../admin/types/analytics';
import { readConfusionStats, readStudentStats, type StudentStatsDoc } from './cohortRollups';
import {
  accuracyByRegionFromStats,
  activeUsersByDayFromStats,
  confusionPairsFromStats,
  retentionFromStats,
  sessionMetricsFromSummaries,
  structureWeaknessFromStats,
} from '../lib/rollupAggregation';

/**
 * Everything the educator dashboard shows, assembled from cohort rollups
 * (CR-031).
 *
 * WHAT THIS USED TO DO. It fetched every attemptEvent for every student in
 * the class — up to 5,000 rows each — into the educator's browser and
 * aggregated them there. Nothing on screen displayed an individual answer,
 * but the access was real: firestore.rules had to grant a cohort owner read
 * on every attempt row of every student, selectedAnswer included, and the
 * join notice could not honestly promise otherwise.
 *
 * WHAT IT DOES NOW. Two reads of pre-aggregated counters written on each
 * student's own device, plus the session summaries that were always readable:
 *
 *   cohorts/{id}/studentStats/{uid}        one document per student
 *   cohorts/{id}/confusionStats/{pairKey}  anonymous counters
 *   users/{uid}/sessions                   unchanged
 *
 * That is roughly forty documents plus sessions for a class of forty, against
 * up to two hundred thousand attempt rows before. The privacy win is the
 * point; the cost and latency win is a side effect worth having.
 *
 * SESSIONS ARE STILL PER-STUDENT READS. The rules still permit them — a
 * session summary is a total and a duration, never an answer — and they carry
 * the completion and session-length figures nothing else has. That read is
 * the remaining N+1 here, and the remaining reason this is not one query.
 */

const SESSION_SUMMARIES_PER_STUDENT = 300;

export interface CohortAnalyticsSnapshot {
  overview: CohortOverview & { activeStudentCount: number };
  structureWeakness: StructureWeaknessRow[];
  confusionPairs: ConfusionPair[];
  /**
   * Per-student rollups, keyed by uid. A student who has joined but never
   * answered anything has no document and is simply absent — screens read a
   * miss as "no activity yet" rather than as an error.
   */
  statsByUid: Map<string, StudentStatsDoc>;
  summariesByUid: Map<string, RevisionSessionSummary[]>;
}

export async function loadCohortAnalytics(
  cohortId: string,
  studentUids: string[],
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): Promise<CohortAnalyticsSnapshot> {
  const db = getDb();
  const repository = await getRepository();

  const [stats, confusion, summariesPerStudent] = await Promise.all([
    readStudentStats(db, cohortId),
    readConfusionStats(db, cohortId),
    Promise.all(studentUids.map((uid) => repository.listSessionSummaries(uid, SESSION_SUMMARIES_PER_STUDENT))),
  ]);

  // A rollup document can outlive a student's membership by a moment — they
  // leave, the roster updates, and their row is only cleared on the next
  // write. Scoping to the roster means the dashboard never counts somebody
  // the educator can no longer see.
  const roster = new Set(studentUids);
  const inCohort = stats.filter((row) => roster.has(row.uid));

  const summariesByUid = new Map(studentUids.map((uid, i) => [uid, summariesPerStudent[i]]));
  const sessionMetrics = sessionMetricsFromSummaries(summariesPerStudent.flat());

  return {
    overview: {
      activeStudentCount: inCohort.filter((row) => row.attemptsTotal > 0).length,
      activeUsersByDay: activeUsersByDayFromStats(inCohort),
      accuracyByRegion: accuracyByRegionFromStats(inCohort, ALL_STRUCTURES),
      retention: retentionFromStats(inCohort),
      meanSessionLengthMinutes: sessionMetrics.meanSessionLengthMinutes,
      completionRatePct: sessionMetrics.completionRatePct,
      totalSessions: sessionMetrics.totalSessions,
    },
    structureWeakness: structureWeaknessFromStats(inCohort, ALL_STRUCTURES, minAttempts),
    confusionPairs: confusionPairsFromStats(confusion, ALL_STRUCTURES),
    statsByUid: new Map(inCohort.map((row) => [row.uid, row])),
    summariesByUid,
  };
}
