import { getDb } from '../../anatomy-revision/data/firebase';
import { STRUCTURE_INDEX } from '../../anatomy-revision/data/structureIndex';
import { STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT } from '../../admin/lib/analyticsAggregation';
import type { CohortOverview, StructureWeaknessRow, ConfusionPair } from '../../admin/types/analytics';
import { readConfusionStats, readStudentStats, type StudentStatsDoc } from './cohortRollups';
import {
  accuracyByRegionFromStats,
  activeUsersByDayFromStats,
  confusionPairsFromStats,
  masteryMixByRegion,
  retentionFromStats,
  sessionMetricsFromRollups,
  structureWeaknessFromStats,
  type RegionMasteryMix,
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
 * WHAT IT DOES NOW. Two reads, both of documents written on each student's
 * own device:
 *
 *   cohorts/{id}/studentStats/{uid}        one document per student
 *   cohorts/{id}/confusionStats/{pairKey}  anonymous counters
 *
 * Until 28 Sep it also read users/{uid}/sessions for every student, for the
 * session figures, streaks and assignment completion. The rules had stopped
 * allowing that on 18 Sep (cf5a934) — a summary carries missed structures and
 * exact times — so for any educator who was not an admin the whole load
 * failed. Those figures now come from each student's `rollup` block
 * (lib/studentRollup.ts), which carries totals and day keys only.
 */

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
  /** Every (student, structure) pair at its mastery level, per region. */
  masteryByRegion: RegionMasteryMix[];
  /** Students whose app has written a rollup yet; the mastery mix covers only these. */
  masteryStudentsReporting: number;
}

export async function loadCohortAnalytics(
  cohortId: string,
  studentUids: string[],
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): Promise<CohortAnalyticsSnapshot> {
  const db = getDb();

  const [stats, confusion] = await Promise.all([readStudentStats(db, cohortId), readConfusionStats(db, cohortId)]);

  // A rollup document can outlive a student's membership by a moment — they
  // leave, the roster updates, and their row is only cleared on the next
  // write. Scoping to the roster means the dashboard never counts somebody
  // the educator can no longer see.
  const roster = new Set(studentUids);
  const inCohort = stats.filter((row) => roster.has(row.uid));

  const sessionMetrics = sessionMetricsFromRollups(inCohort);
  const mastery = masteryMixByRegion(inCohort, STRUCTURE_INDEX);

  return {
    overview: {
      activeStudentCount: inCohort.filter((row) => row.attemptsTotal > 0).length,
      activeUsersByDay: activeUsersByDayFromStats(inCohort),
      accuracyByRegion: accuracyByRegionFromStats(inCohort, STRUCTURE_INDEX),
      retention: retentionFromStats(inCohort),
      meanSessionLengthMinutes: sessionMetrics.meanSessionLengthMinutes,
      completionRatePct: sessionMetrics.completionRatePct,
      totalSessions: sessionMetrics.totalSessions,
    },
    structureWeakness: structureWeaknessFromStats(inCohort, STRUCTURE_INDEX, minAttempts),
    confusionPairs: confusionPairsFromStats(confusion, STRUCTURE_INDEX),
    statsByUid: new Map(inCohort.map((row) => [row.uid, row])),
    masteryByRegion: mastery.regions,
    masteryStudentsReporting: mastery.studentsReporting,
  };
}
