import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import { STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT } from '../../admin/lib/analyticsAggregation';
import type { CohortAnalyticsSnapshot } from '../data/cohortAnalytics';
import {
  accuracyByRegionFromStats,
  activeUsersByDayFromStats,
  confusionPairsFromStats,
  masteryMixByRegion,
  retentionFromStats,
  sessionMetricsFromRollups,
  structureWeaknessFromStats,
} from '../lib/rollupAggregation';
import { buildStudentRollup, replayMastery } from '../lib/studentRollup';
import { buildConfusionStats, buildStudentStats } from '../lib/rollupFromAttempts';
import { demoAttempts, demoSessionSummaries } from './demoData';

/**
 * Demo-mode stand-in for data/cohortAnalytics.ts (README "Educator demo
 * mode"). Only the fetch is replaced: the generated attempts are rolled up
 * into the same counter documents a student's device would have written, and
 * the same aggregation functions then run over those — so the numbers on
 * screen are really computed, not typed in, and they are computed by the code
 * the real dashboard uses.
 *
 * What demo mode therefore still does NOT exercise is the Firestore read path
 * or the rules that guard it. If you are debugging a query or a security
 * rule, demo mode is the wrong tool and will happily show you a working
 * screen.
 */

export type { CohortAnalyticsSnapshot } from '../data/cohortAnalytics';

export async function loadCohortAnalytics(
  _cohortId: string,
  studentUids: string[],
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): Promise<CohortAnalyticsSnapshot> {
  const attemptsByUid = new Map(studentUids.map((uid) => [uid, demoAttempts(uid)]));

  // The rollup a demo student's device would have written: mastery replayed
  // from their attempts, sessions from their generated summaries.
  const stats = studentUids.map((uid) => {
    const attempts = attemptsByUid.get(uid) ?? [];
    return {
      ...buildStudentStats(uid, null, attempts),
      rollup: buildStudentRollup(replayMastery(uid, attempts), demoSessionSummaries(uid)),
    };
  });
  const confusion = buildConfusionStats([...attemptsByUid.values()].flat());
  const sessionMetrics = sessionMetricsFromRollups(stats);
  const mastery = masteryMixByRegion(stats, ALL_STRUCTURES);

  return {
    overview: {
      activeStudentCount: stats.filter((row) => row.attemptsTotal > 0).length,
      activeUsersByDay: activeUsersByDayFromStats(stats),
      accuracyByRegion: accuracyByRegionFromStats(stats, ALL_STRUCTURES),
      retention: retentionFromStats(stats),
      meanSessionLengthMinutes: sessionMetrics.meanSessionLengthMinutes,
      completionRatePct: sessionMetrics.completionRatePct,
      totalSessions: sessionMetrics.totalSessions,
    },
    structureWeakness: structureWeaknessFromStats(stats, ALL_STRUCTURES, minAttempts),
    confusionPairs: confusionPairsFromStats(confusion, ALL_STRUCTURES),
    statsByUid: new Map(stats.map((row) => [row.uid, row])),
    masteryByRegion: mastery.regions,
    masteryStudentsReporting: mastery.studentsReporting,
  };
}
