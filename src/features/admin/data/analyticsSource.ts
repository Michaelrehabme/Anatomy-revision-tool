import { getRepository } from '../../anatomy-revision/data/repository';
import { ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import type { UserAttempt, RevisionSessionSummary } from '../../anatomy-revision/types/attempt';
import {
  aggregateStructureWeakness,
  aggregateDistractors,
  aggregateConfusionPairs,
  flagQuestionHealth,
  aggregateAccuracyByRegion,
  aggregateActiveUsersByDay,
  computeRetention,
  computeSessionMetrics,
} from '../lib/analyticsAggregation';
import { listReviewedQuestionIds } from './questionReviewsRepository';
import type {
  AnalyticsFilters,
  StructureWeaknessRow,
  QuestionDistractorSummary,
  ConfusionPair,
  QuestionHealthFlag,
  CohortOverview,
} from '../types/analytics';

/**
 * MIGRATION PATH: this is the client-aggregated implementation of
 * AnalyticsSource. It pulls the most recent `maxAttempts` attemptEvents
 * (default DEFAULT_MAX_ATTEMPTS below) plus, for the cohort overview only,
 * one listSessionSummaries call per distinct user seen in that sample (a
 * bounded N+1 — same accepted pattern as useAdminUsers) — then computes
 * every number on this dashboard from those two in-memory arrays plus the
 * static seed content, joined by id.
 *
 * That's fine up to roughly the tens of thousands of attemptEvents and a few
 * hundred distinct active users, past which the capped read stops being
 * representative (structure weakness worst-first will silently drop older
 * evidence) and the per-user session fetch turns into hundreds of Firestore
 * round-trips per dashboard load. Beyond that volume, replace this class
 * with one backed by a Cloud Functions job that periodically (e.g. hourly)
 * pre-aggregates attemptEvents into rollup documents (per-structure,
 * per-question, per-day cohort stats) and has the new implementation read
 * those rollups instead. Nothing outside this file needs to change: every UI
 * component in features/admin/components/Analytics only ever depends on the
 * AnalyticsSource interface below, never on attemptEvents or Firestore
 * directly.
 */

export const DEFAULT_MAX_ATTEMPTS = 20000;
const SESSION_SUMMARIES_PER_USER = 500;

export interface AnalyticsSource {
  getStructureWeakness(filters?: AnalyticsFilters, minAttempts?: number): Promise<StructureWeaknessRow[]>;
  getDistractorAnalysis(): Promise<QuestionDistractorSummary[]>;
  getConfusionPairs(): Promise<ConfusionPair[]>;
  /** Excludes questionIds already marked reviewed — see data/questionReviewsRepository. */
  getQuestionHealth(): Promise<QuestionHealthFlag[]>;
  getCohortOverview(): Promise<CohortOverview>;
  /** Drops every in-memory cache, forcing the next call on any method to re-fetch from Firestore. */
  refresh(): void;
}

export class ClientAggregatedAnalytics implements AnalyticsSource {
  private attemptsPromise: Promise<UserAttempt[]> | null = null;
  private cohortPromise: Promise<CohortOverview> | null = null;

  constructor(private readonly maxAttempts: number = DEFAULT_MAX_ATTEMPTS) {}

  refresh(): void {
    this.attemptsPromise = null;
    this.cohortPromise = null;
  }

  /** Cached for the lifetime of this instance (see the module-level `analyticsSource` singleton below) so switching tabs never re-queries. */
  private loadAttempts(): Promise<UserAttempt[]> {
    if (!this.attemptsPromise) {
      this.attemptsPromise = getRepository().then((repo) => repo.listAttempts({ limit: this.maxAttempts }));
    }
    return this.attemptsPromise;
  }

  async getStructureWeakness(filters: AnalyticsFilters = {}, minAttempts?: number): Promise<StructureWeaknessRow[]> {
    const attempts = await this.loadAttempts();
    return aggregateStructureWeakness(attempts, ALL_STRUCTURES, filters, minAttempts);
  }

  async getDistractorAnalysis(): Promise<QuestionDistractorSummary[]> {
    const attempts = await this.loadAttempts();
    return aggregateDistractors(attempts, ALL_STRUCTURES);
  }

  async getConfusionPairs(): Promise<ConfusionPair[]> {
    const attempts = await this.loadAttempts();
    return aggregateConfusionPairs(attempts);
  }

  async getQuestionHealth(): Promise<QuestionHealthFlag[]> {
    const [attempts, reviewed] = await Promise.all([this.loadAttempts(), listReviewedQuestionIds()]);
    return flagQuestionHealth(attempts, ALL_STRUCTURES).filter((flag) => !reviewed.has(flag.questionId));
  }

  async getCohortOverview(): Promise<CohortOverview> {
    if (!this.cohortPromise) {
      this.cohortPromise = this.computeCohortOverview();
    }
    return this.cohortPromise;
  }

  private async computeCohortOverview(): Promise<CohortOverview> {
    const [attempts, repository] = await Promise.all([this.loadAttempts(), getRepository()]);
    const distinctUserIds = [...new Set(attempts.map((a) => a.userId))];

    const summariesByUser = await Promise.all(
      distinctUserIds.map((uid) => repository.listSessionSummaries(uid, SESSION_SUMMARIES_PER_USER)),
    );
    const summaries: RevisionSessionSummary[] = summariesByUser.flat();
    const sessionMetrics = computeSessionMetrics(attempts, summaries);

    return {
      activeUsersByDay: aggregateActiveUsersByDay(attempts),
      accuracyByRegion: aggregateAccuracyByRegion(attempts),
      retention: computeRetention(attempts),
      meanSessionLengthMinutes: sessionMetrics.meanSessionLengthMinutes,
      completionRatePct: sessionMetrics.completionRatePct,
      totalSessions: sessionMetrics.totalSessions,
    };
  }
}

/** Module-level singleton — see loadAttempts' cache comment for why this is what makes "don't re-query on tab switch" hold across the whole admin session. */
export const analyticsSource: AnalyticsSource = new ClientAggregatedAnalytics();
