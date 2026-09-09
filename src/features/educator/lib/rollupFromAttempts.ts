import type { UserAttempt } from '../../anatomy-revision/types/attempt';
import type { ConfusionStatsDoc, StructureCounters, StudentStatsDoc } from '../data/cohortRollups';

/**
 * Builds cohort rollup documents from attempt rows, in memory.
 *
 * The read model of data/cohortRollups.ts's write path: given the same
 * attempts, this produces the documents those incremental writes would have
 * accumulated. It exists for two callers that both need to go from attempts
 * to counters in one pass rather than one answer at a time —
 *
 *   - the educator demo, so its screens run the real aggregation over
 *     generated data instead of a parallel implementation that can drift
 *     from the one students' devices actually feed;
 *   - anything reconstructing a cohort's counters from an attempt log.
 *
 * Type-only imports, deliberately: the demo build must not pull the Firebase
 * SDK in through this module.
 *
 * KEEP IN STEP WITH rollUpAttempt. If a counter is added there and not here,
 * the demo silently stops showing a column the real dashboard has.
 */

const dayKey = (timestamp: string): string => timestamp.slice(0, 10);

/** Mirrors confusionKey in data/cohortRollups.ts — same cleaning, same separator. */
export function confusionKeyFor(correctAnswer: string, selectedAnswer: string): string {
  const clean = (v: string) => v.replace(/[^A-Za-z0-9 ()-]/g, '').slice(0, 60).trim();
  return `${clean(correctAnswer)}~${clean(selectedAnswer)}`;
}

export function buildStudentStats(
  uid: string,
  displayName: string | null,
  attempts: UserAttempt[],
): StudentStatsDoc {
  const structures: Record<string, StructureCounters & { first: number; firstCorrect: number; durMs: number; durCount: number }> = {};
  const days = new Map<string, { attempts: number; total: number; correct: number }>();

  let attemptsTotal = 0;
  let gradedTotal = 0;
  let gradedCorrect = 0;
  let lastActiveAt: string | null = null;

  for (const attempt of attempts) {
    // Learn cards are ungraded since CR-018: they count as engagement, never
    // into an accuracy denominator.
    const graded = attempt.graded !== false;

    attemptsTotal += 1;
    if (graded) {
      gradedTotal += 1;
      if (attempt.correct) gradedCorrect += 1;
    }
    if (lastActiveAt === null || attempt.timestamp > lastActiveAt) lastActiveAt = attempt.timestamp;

    const counters = (structures[attempt.structureId] ??= {
      attempts: 0,
      correct: 0,
      first: 0,
      firstCorrect: 0,
      durMs: 0,
      durCount: 0,
    });
    if (graded) {
      counters.attempts += 1;
      if (attempt.correct) counters.correct += 1;
      if (attempt.attemptNumber === 1) {
        counters.first += 1;
        if (attempt.correct) counters.firstCorrect += 1;
      }
      if (typeof attempt.durationMs === 'number') {
        counters.durMs += attempt.durationMs;
        counters.durCount += 1;
      }
    }

    const day = days.get(dayKey(attempt.timestamp)) ?? { attempts: 0, total: 0, correct: 0 };
    day.attempts += 1;
    if (graded) {
      day.total += 1;
      if (attempt.correct) day.correct += 1;
    }
    days.set(dayKey(attempt.timestamp), day);
  }

  return {
    uid,
    displayName,
    attemptsTotal,
    gradedTotal,
    gradedCorrect,
    lastActiveAt,
    structures,
    activeDays: [...days.entries()].filter(([, d]) => d.attempts > 0).map(([day]) => day).sort(),
    dayTallies: new Map(
      [...days.entries()].filter(([, d]) => d.total > 0).map(([day, d]) => [day, { total: d.total, correct: d.correct }]),
    ),
  };
}

/** Confusion counters across a whole cohort's attempts, commonest first. */
export function buildConfusionStats(attempts: UserAttempt[]): ConfusionStatsDoc[] {
  const byKey = new Map<string, ConfusionStatsDoc>();

  for (const attempt of attempts) {
    // Same guard as the write path: locate and flashcard questions carry no
    // answer text, and inventing one would put fabricated rows in the table
    // an educator trusts most.
    if (attempt.graded === false) continue;
    if (attempt.correct) continue;
    if (!attempt.correctAnswer || !attempt.selectedAnswer) continue;
    if (attempt.correctAnswer === attempt.selectedAnswer) continue;

    const key = confusionKeyFor(attempt.correctAnswer, attempt.selectedAnswer);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { correctAnswer: attempt.correctAnswer, selectedAnswer: attempt.selectedAnswer, count: 1 });
  }

  return [...byKey.values()].sort((a, b) => b.count - a.count);
}
