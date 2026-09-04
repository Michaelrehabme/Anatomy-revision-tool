import type { AnatomyStructure } from '../../anatomy-revision/types/structure';
import type { UserAttempt, RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import type {
  AnalyticsFilters,
  StructureWeaknessRow,
  QuestionDistractorSummary,
  ConfusionPair,
  QuestionHealthFlag,
  RegionAccuracyBar,
  ActiveUsersPoint,
  RetentionStats,
} from '../types/analytics';

/**
 * Pure aggregation functions behind the analytics dashboard (see
 * data/analyticsSource.ts for the async layer that fetches attemptEvents and
 * calls into these). Every function here takes plain data in and returns
 * plain data out — no Firestore, no React — so they're covered by
 * lib/__tests__/analyticsAggregation.test.ts using synthetic attempt arrays.
 */

export const STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT = 5;
export const TOP_WRONG_ANSWERS_LIMIT = 5;

export const LOW_ACCURACY_THRESHOLD = 0.25;
export const LOW_ACCURACY_MIN_ATTEMPTS = 10;
export const NO_DISCRIMINATION_THRESHOLD = 0.98;
export const NO_DISCRIMINATION_MIN_ATTEMPTS = 20;
/** "High accuracy" floor for the slow-despite-accurate flag — deliberately below NO_DISCRIMINATION_THRESHOLD so a question that's accurately but slowly answered gets caught even if it isn't also flagged as non-discriminatory. */
export const SLOW_HIGH_ACCURACY_THRESHOLD = 0.8;
export const SLOW_MIN_ATTEMPTS = 10;
export const SLOW_PERCENTILE = 0.9;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Linear-interpolation percentile (like numpy's default) over a copy of `values`. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Drops exposures that carry no judgement — since CR-018 that means
 * flashcards, which are purely for learning and record `correct: true`
 * only so they can be seen in the study record. Counting them as correct
 * answers would inflate every accuracy figure below.
 *
 * Applied per aggregation rather than at the data source on purpose: the
 * activity and retention measures further down count *engagement*, and a
 * student who spent a session on learn cards was not idle.
 */
function gradedOnly(attempts: UserAttempt[]): UserAttempt[] {
  return attempts.filter((a) => a.graded !== false);
}

function matchesFilters(attempt: UserAttempt, filters: AnalyticsFilters): boolean {
  return (
    (!filters.region || attempt.region === filters.region) &&
    (!filters.category || attempt.category === filters.category) &&
    (!filters.questionType || attempt.questionType === filters.questionType)
  );
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Every structure with at least `minAttempts` attempts (after `filters`),
 * worst accuracy first. firstAttemptAccuracyPct is computed over the subset
 * where attemptNumber === 1 (per UserAttempt's definition: first time this
 * user saw this exact questionId) — a structure with a much lower
 * first-attempt accuracy than its overall accuracy is being learned through
 * repetition; the reverse (high first-attempt, low overall) suggests
 * forgetting, since later attempts are doing worse than the initial cold try.
 */
export function aggregateStructureWeakness(
  attempts: UserAttempt[],
  structures: AnatomyStructure[],
  filters: AnalyticsFilters = {},
  minAttempts: number = STRUCTURE_WEAKNESS_MIN_ATTEMPTS_DEFAULT,
): StructureWeaknessRow[] {
  const structuresById = new Map(structures.map((s) => [s.id, s] as const));
  const byStructure = new Map<string, UserAttempt[]>();

  for (const attempt of gradedOnly(attempts)) {
    if (!matchesFilters(attempt, filters)) continue;
    const group = byStructure.get(attempt.structureId);
    if (group) group.push(attempt);
    else byStructure.set(attempt.structureId, [attempt]);
  }

  const rows: StructureWeaknessRow[] = [];

  for (const [structureId, group] of byStructure) {
    if (group.length < minAttempts) continue;

    const correct = group.filter((a) => a.correct).length;
    const firstAttempts = group.filter((a) => a.attemptNumber === 1);
    const firstCorrect = firstAttempts.filter((a) => a.correct).length;
    const durations = group.map((a) => a.durationMs).filter((d): d is number => d !== undefined);
    const structure = structuresById.get(structureId);

    rows.push({
      structureId,
      name: structure?.name ?? structureId,
      region: structure?.region ?? group[0].region,
      category: structure?.category ?? group[0].category,
      totalAttempts: group.length,
      accuracyPct: Math.round((correct / group.length) * 100),
      firstAttemptAccuracyPct: firstAttempts.length > 0 ? Math.round((firstCorrect / firstAttempts.length) * 100) : null,
      firstAttemptCount: firstAttempts.length,
      distinctUsers: new Set(group.map((a) => a.userId)).size,
      meanAnswerTimeMs: mean(durations),
    });
  }

  return rows.sort((a, b) => a.accuracyPct - b.accuracyPct || b.totalAttempts - a.totalAttempts);
}

/**
 * Per-question wrong-answer breakdown, questions with the most wrong
 * attempts first — that ordering surfaces the highest-value content targets
 * before anything else on the screen.
 */
export function aggregateDistractors(
  attempts: UserAttempt[],
  structures: AnatomyStructure[],
): QuestionDistractorSummary[] {
  const structuresById = new Map(structures.map((s) => [s.id, s] as const));
  const byQuestion = new Map<string, UserAttempt[]>();

  for (const attempt of gradedOnly(attempts)) {
    const group = byQuestion.get(attempt.questionId);
    if (group) group.push(attempt);
    else byQuestion.set(attempt.questionId, [attempt]);
  }

  const summaries: QuestionDistractorSummary[] = [];

  for (const [questionId, group] of byQuestion) {
    const wrong = group.filter((a) => !a.correct && a.selectedAnswer !== undefined);
    if (wrong.length === 0) continue;

    const countByAnswer = new Map<string, number>();
    for (const attempt of wrong) {
      const answer = attempt.selectedAnswer!;
      countByAnswer.set(answer, (countByAnswer.get(answer) ?? 0) + 1);
    }
    const topWrongAnswers = [...countByAnswer.entries()]
      .map(([answer, count]) => ({ answer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_WRONG_ANSWERS_LIMIT);

    const first = group[0];
    const correct = group.filter((a) => a.correct).length;

    summaries.push({
      questionId,
      structureId: first.structureId,
      structureName: structuresById.get(first.structureId)?.name ?? first.structureId,
      questionType: first.questionType,
      correctAnswer: group.find((a) => a.correctAnswer !== undefined)?.correctAnswer ?? null,
      totalAttempts: group.length,
      totalWrong: wrong.length,
      accuracyPct: Math.round((correct / group.length) * 100),
      topWrongAnswers,
    });
  }

  return summaries.sort((a, b) => b.totalWrong - a.totalWrong);
}

/**
 * Ranked (correctAnswer, selectedAnswer) pairs across every wrong attempt in
 * the dataset. Each frequent pair is a distinction students consistently
 * fail to make — a direct roadmap for which discriminating question to
 * write next.
 */
export function aggregateConfusionPairs(attempts: UserAttempt[]): ConfusionPair[] {
  const bySeparator = '␟';
  const byPair = new Map<string, { correctAnswer: string; selectedAnswer: string; count: number; structureIds: Set<string> }>();

  for (const attempt of gradedOnly(attempts)) {
    if (attempt.correct) continue;
    if (!attempt.correctAnswer || !attempt.selectedAnswer) continue;
    if (attempt.correctAnswer === attempt.selectedAnswer) continue;

    const key = `${attempt.correctAnswer}${bySeparator}${attempt.selectedAnswer}`;
    const existing = byPair.get(key);
    if (existing) {
      existing.count += 1;
      existing.structureIds.add(attempt.structureId);
    } else {
      byPair.set(key, {
        correctAnswer: attempt.correctAnswer,
        selectedAnswer: attempt.selectedAnswer,
        count: 1,
        structureIds: new Set([attempt.structureId]),
      });
    }
  }

  return [...byPair.values()]
    .map((p) => ({ ...p, structureIds: [...p.structureIds] }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Flags questions where the statistics point at the question rather than the
 * student: too hard to be a fair question (likely ambiguous/wrong), too easy
 * to discriminate at all, or accurately-but-suspiciously-slowly answered
 * (unclear wording that people puzzle out but still eventually get right).
 * Does not know about questionReviews — the caller filters out already-
 * reviewed questionIds, keeping this function a pure statistics pass.
 */
export function flagQuestionHealth(attempts: UserAttempt[], structures: AnatomyStructure[]): QuestionHealthFlag[] {
  const structuresById = new Map(structures.map((s) => [s.id, s] as const));
  const byQuestion = new Map<string, UserAttempt[]>();

  for (const attempt of gradedOnly(attempts)) {
    const group = byQuestion.get(attempt.questionId);
    if (group) group.push(attempt);
    else byQuestion.set(attempt.questionId, [attempt]);
  }

  interface QuestionStats {
    questionId: string;
    structureId: string;
    questionType: UserAttempt['questionType'];
    total: number;
    accuracy: number;
    meanDurationMs: number | null;
  }

  const stats: QuestionStats[] = [...byQuestion.entries()].map(([questionId, group]) => {
    const correct = group.filter((a) => a.correct).length;
    const durations = group.map((a) => a.durationMs).filter((d): d is number => d !== undefined);
    return {
      questionId,
      structureId: group[0].structureId,
      questionType: group[0].questionType,
      total: group.length,
      accuracy: correct / group.length,
      meanDurationMs: mean(durations),
    };
  });

  const slowCandidates = stats.filter(
    (s) => s.total >= SLOW_MIN_ATTEMPTS && s.accuracy >= SLOW_HIGH_ACCURACY_THRESHOLD && s.meanDurationMs !== null,
  );
  const slowThresholdMs =
    slowCandidates.length > 0 ? percentile(slowCandidates.map((s) => s.meanDurationMs!), SLOW_PERCENTILE) : null;

  const flags: QuestionHealthFlag[] = [];

  for (const s of stats) {
    const structureName = structuresById.get(s.structureId)?.name ?? s.structureId;
    const accuracyPct = Math.round(s.accuracy * 100);

    if (s.total >= LOW_ACCURACY_MIN_ATTEMPTS && s.accuracy < LOW_ACCURACY_THRESHOLD) {
      flags.push({
        questionId: s.questionId,
        structureId: s.structureId,
        structureName,
        questionType: s.questionType,
        flagType: 'low-accuracy',
        reason: `${accuracyPct}% accuracy over ${s.total} attempts — likely ambiguous or mis-keyed.`,
        totalAttempts: s.total,
        accuracyPct,
        meanAnswerTimeMs: s.meanDurationMs,
      });
    }

    if (s.total >= NO_DISCRIMINATION_MIN_ATTEMPTS && s.accuracy > NO_DISCRIMINATION_THRESHOLD) {
      flags.push({
        questionId: s.questionId,
        structureId: s.structureId,
        structureName,
        questionType: s.questionType,
        flagType: 'no-discrimination',
        reason: `${accuracyPct}% accuracy over ${s.total} attempts — too easy to tell strong students from weak ones.`,
        totalAttempts: s.total,
        accuracyPct,
        meanAnswerTimeMs: s.meanDurationMs,
      });
    }

    if (
      slowThresholdMs !== null &&
      s.total >= SLOW_MIN_ATTEMPTS &&
      s.accuracy >= SLOW_HIGH_ACCURACY_THRESHOLD &&
      s.meanDurationMs !== null &&
      s.meanDurationMs >= slowThresholdMs
    ) {
      flags.push({
        questionId: s.questionId,
        structureId: s.structureId,
        structureName,
        questionType: s.questionType,
        flagType: 'slow-despite-accurate',
        reason: `${accuracyPct}% accuracy but among the slowest 10% of questions to answer — wording is probably unclear.`,
        totalAttempts: s.total,
        accuracyPct,
        meanAnswerTimeMs: s.meanDurationMs,
      });
    }
  }

  return flags.sort((a, b) => a.accuracyPct - b.accuracyPct);
}

export function aggregateAccuracyByRegion(attempts: UserAttempt[]): RegionAccuracyBar[] {
  const byRegion = new Map<string, { total: number; correct: number }>();
  for (const attempt of gradedOnly(attempts)) {
    const bucket = byRegion.get(attempt.region) ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (attempt.correct) bucket.correct += 1;
    byRegion.set(attempt.region, bucket);
  }
  return [...byRegion.entries()].map(([region, { total, correct }]) => ({
    region: region as RegionAccuracyBar['region'],
    total,
    correct,
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
  }));
}

/** Distinct active users per calendar day (UTC date of the attempt timestamp), sorted oldest first. */
export function aggregateActiveUsersByDay(attempts: UserAttempt[]): ActiveUsersPoint[] {
  const usersByDay = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    const day = toDateKey(attempt.timestamp);
    const users = usersByDay.get(day);
    if (users) users.add(attempt.userId);
    else usersByDay.set(day, new Set([attempt.userId]));
  }
  return [...usersByDay.entries()]
    .map(([date, users]) => ({ date, activeUsers: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * N-day retention, "at least once more after N days" style (not exact-day):
 * for each user, firstDay = their earliest active date in the sample. A user
 * is *eligible* for the N-day bucket only if the dataset's latest activity is
 * at least N days after their firstDay (otherwise there hasn't been time to
 * observe a return yet). Eligible users are *retained* if they have any
 * activity on a day >= firstDay + N. Returns null for a bucket with zero
 * eligible users rather than a misleading 0%.
 */
export function computeRetention(attempts: UserAttempt[]): RetentionStats {
  const daysByUser = new Map<string, Set<string>>();
  let latestDay = '';

  for (const attempt of attempts) {
    const day = toDateKey(attempt.timestamp);
    if (day > latestDay) latestDay = day;
    const days = daysByUser.get(attempt.userId);
    if (days) days.add(day);
    else daysByUser.set(attempt.userId, new Set([day]));
  }

  const latestMs = latestDay ? Date.parse(`${latestDay}T00:00:00Z`) : NaN;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function retentionForWindow(windowDays: number): number | null {
    let eligible = 0;
    let retained = 0;

    for (const days of daysByUser.values()) {
      const sorted = [...days].sort();
      const firstDay = sorted[0];
      const firstMs = Date.parse(`${firstDay}T00:00:00Z`);
      const elapsedDays = Math.round((latestMs - firstMs) / MS_PER_DAY);
      if (elapsedDays < windowDays) continue;

      eligible += 1;
      const returned = sorted.some((day) => Math.round((Date.parse(`${day}T00:00:00Z`) - firstMs) / MS_PER_DAY) >= windowDays);
      if (returned) retained += 1;
    }

    return eligible > 0 ? Math.round((retained / eligible) * 100) : null;
  }

  return {
    day1Pct: retentionForWindow(1),
    day7Pct: retentionForWindow(7),
    day30Pct: retentionForWindow(30),
  };
}

/**
 * Completion rate and mean session length from real RevisionSessionSummary
 * docs (finishedAt is only ever set once a session is actually completed —
 * see useRevisionSession's finish()), matched against the distinct
 * sessionIds seen in the attempt sample. `summaries` is expected to already
 * be scoped to users appearing in that sample (see ClientAggregatedAnalytics).
 */
export function computeSessionMetrics(
  attempts: UserAttempt[],
  summaries: RevisionSessionSummary[],
): { meanSessionLengthMinutes: number | null; completionRatePct: number | null; totalSessions: number } {
  const sessionIdsInAttempts = new Set(attempts.map((a) => a.sessionId));
  const totalSessions = sessionIdsInAttempts.size;

  const relevantSummaries = summaries.filter((s) => sessionIdsInAttempts.has(s.id) && s.finishedAt);
  const durationsMinutes = relevantSummaries.map(
    (s) => (Date.parse(s.finishedAt!) - Date.parse(s.startedAt)) / 60000,
  );

  return {
    meanSessionLengthMinutes: mean(durationsMinutes),
    completionRatePct: totalSessions > 0 ? Math.round((relevantSummaries.length / totalSessions) * 100) : null,
    totalSessions,
  };
}
