import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { FactMastery, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import { spreadReviewItems, buildReviewQueue, type ReviewItem } from '../lib/reviewQueue';
import { areasOf, isMuscle } from '../types/structure';
import type { Area } from '../types/region';
import { computeStreak } from '../lib/streak';
import { sessionsPerDay } from '../lib/weekActivity';
import { syncReviewReminder } from '../../native/nativeShell';


export interface TodayData {
  loading: boolean;
  streak: number;
  /** Muscles only — content also includes bones/landmarks, not part of this screen's "122 muscles" framing. */
  totalMuscleCount: number;
  seenMusclePct: number;
  /** Every kind the account may reach, and how many of them have a mastery row. */
  totalStructureCount: number;
  seenStructureCount: number;
  dueMuscles: StructureMastery[];
  /** Every mastery row for the user, for correctness-weighted question selection. */
  allMastery: StructureMastery[];
  weakest: StructureMastery[];
  comingDue: StructureMastery[];
  /**
   * What "Start review" asks, per question type (lib/reviewQueue.ts): every
   * due type, most overdue first, then the weak ones pulled forward once the
   * due ones run out. A type answered easily is left until it is due.
   */
  reviewItems: ReviewItem[];
  /** The same items in "New set" order — structures answered longest ago first (lib/reviewQueue.ts). */
  spreadItems: ReviewItem[];
  /** Question types due now, across the muscles this account may reach. */
  dueCount: number;
  /** Every fact row for the user, passed on to the session generator. */
  facts: FactMastery[];
  weekBuckets: number[];
  weekMax: number;
  dayLabels: string[];
}

/**
 * Shared data-fetching + derivation for the Today screen, extracted so
 * both the desktop and mobile versions source identical numbers from one
 * place rather than duplicating the fetch/derivation logic.
 */
export function useTodayData(
  repository: AnatomyRepository | null,
  userId: string | null,
  content: AnatomyContent,
  entitledAreas: readonly Area[],
): TodayData {
  const [due, setDue] = useState<StructureMastery[]>([]);
  const [allMastery, setAllMastery] = useState<StructureMastery[]>([]);
  const [facts, setFacts] = useState<FactMastery[]>([]);
  const [summaries, setSummaries] = useState<RevisionSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    const now = new Date().toISOString();
    Promise.all([
      repository.listDueMastery(userId, now),
      repository.listMastery(userId),
      repository.listSessionSummaries(userId, 30),
      repository.listFactMastery(userId),
    ]).then(([dueMastery, mastery, sessions, factRows]) => {
      if (cancelled) return;
      setDue(dueMastery);
      setAllMastery(mastery);
      setFacts(factRows);
      setSummaries(sessions);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  // Inside the native wrapper, keep the one "reviews are due" notification in
  // step with what was just loaded. A no-op in a browser — see nativeShell.ts.
  // Keyed on the loaded rows, so it runs again when Today reloads after a session.
  const entitledKey = entitledAreas.join(',');
  useEffect(() => {
    if (loading) return;
    const reachable = entitledKey.split(',');
    const eligible = new Set(
      content.structures.filter((s) => areasOf(s).some((a) => reachable.includes(a))).map((s) => s.id),
    );
    void syncReviewReminder({ mastery: allMastery, facts, eligible });
  }, [loading, allMastery, facts, entitledKey, content.structures]);

  const streak = computeStreak(summaries);
  // Clamped to what this account may reach, which is what makes every number
  // and list below entitled-only: due, weakest, coming up, and the seen
  // percentage. A free student's Today is about their region — offering a
  // locked muscle as "due" would be offering something they cannot answer.
  // Their mastery history is untouched; it simply is not listed here.
  const muscleIds = new Set(
    content.structures
      .filter((s) => isMuscle(s) && areasOf(s).some((a) => entitledAreas.includes(a)))
      .map((s) => s.id),
  );
  const totalMuscleCount = muscleIds.size;
  const seenCount = allMastery.filter((m) => muscleIds.has(m.structureId)).length;
  const seenMusclePct = totalMuscleCount > 0 ? Math.round((seenCount / totalMuscleCount) * 100) : 0;
  const dueMuscles = due.filter((m) => muscleIds.has(m.structureId));
  const entitledIds = new Set(
    content.structures.filter((s) => areasOf(s).some((a) => entitledAreas.includes(a))).map((s) => s.id),
  );
  const totalStructureCount = entitledIds.size;
  const seenStructureCount = allMastery.filter((m) => entitledIds.has(m.structureId)).length;

  const weakest = [...allMastery]
    .filter((m) => m.attemptsTotal > 0 && muscleIds.has(m.structureId))
    .sort((a, b) => a.attemptsCorrect / a.attemptsTotal - b.attemptsCorrect / b.attemptsTotal)
    .slice(0, 5);

  const upcoming = [...allMastery]
    .filter((m) => m.dueAt && muscleIds.has(m.structureId) && !dueMuscles.some((d) => d.structureId === m.structureId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const comingDue = upcoming.slice(0, 3);
  // Every structure the account may reach, not muscles alone (owner, 3 Oct
  // 2026): a bone or ligament answered and scheduled is as due as a muscle,
  // and left out of the queue it only ever came back by chance.
  const queue = buildReviewQueue(allMastery, facts, entitledIds, new Date());
  const reviewItems = [...queue.due, ...queue.forward];
  const spreadItems = spreadReviewItems(reviewItems, allMastery, facts);

  // Seven local calendar days ending today, each labelled with its own
  // weekday, so the axis is right every day of the week and a session at
  // half past midnight lands on the day the student was actually up.
  const week = sessionsPerDay(summaries, new Date());
  const weekBuckets = week.map((d) => d.count);
  const weekMax = Math.max(1, ...weekBuckets);
  const dayLabels = week.map((d) => d.label);

  return {
    loading,
    streak,
    totalMuscleCount,
    seenMusclePct,
    totalStructureCount,
    seenStructureCount,
    dueMuscles,
    allMastery,
    weakest,
    comingDue,
    reviewItems,
    spreadItems,
    dueCount: queue.due.length,
    facts,
    weekBuckets,
    weekMax,
    dayLabels,
  };
}

export function relativeDue(dueAt: string, now: Date): string {
  const days = Math.round((Date.parse(dueAt) - now.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
