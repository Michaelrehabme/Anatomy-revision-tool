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
import type { FactMastery, StructureMastery } from '../../anatomy-revision/types/attempt';
import { masteryLevel } from '../../anatomy-revision/lib/masteryLevel';
import { requiredFactKinds } from '../../anatomy-revision/lib/factMastery';

const DEMO_STRUCTURES = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

/** A stable 0-99 from a string, so the demo reads the same on every load. */
function demoHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100;
}

/**
 * Fact progress for a demo student. The generated history is naming answers
 * only, and since 29 Sep 2026 Master also needs a structure's facts
 * (lib/masteryLevel.ts) — without these the demo would show no Master at all.
 * About seven in ten of the structures a demo student can name unaided get
 * every fact complete; the rest stop at Advanced with facts outstanding,
 * which is the spread a real class would show.
 */
function demoFacts(uid: string, mastery: readonly StructureMastery[]): FactMastery[] {
  const facts: FactMastery[] = [];
  for (const row of mastery) {
    const structure = DEMO_STRUCTURES.get(row.structureId);
    if (!structure || masteryLevel(row).level !== 'master') continue;
    if (demoHash(`${uid}:${row.structureId}`) >= 70) continue;
    for (const promptKind of requiredFactKinds(structure)) {
      facts.push({
        userId: uid,
        structureId: row.structureId,
        promptKind,
        attemptsTotal: 9,
        attemptsCorrect: 9,
        streak: 3,
        missStreak: 0,
        lastCorrect: true,
        lastAttemptAt: row.lastAttemptAt,
        typed: promptKind !== 'blood-supply-rating',
        bare: promptKind !== 'blood-supply-rating',
      });
    }
  }
  return facts;
}

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
      rollup: (() => {
        const mastery = replayMastery(uid, attempts);
        return buildStudentRollup(mastery, demoSessionSummaries(uid), undefined, undefined, demoFacts(uid, mastery));
      })(),
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
