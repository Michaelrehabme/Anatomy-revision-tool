import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { StructureMastery, RevisionSessionSummary } from '../types/attempt';
import { areasOf, isMuscle } from '../types/structure';
import type { Area } from '../types/region';
import { computeStreak } from '../lib/streak';
import { sessionsPerDay } from '../lib/weekActivity';


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
    ]).then(([dueMastery, mastery, sessions]) => {
      if (cancelled) return;
      setDue(dueMastery);
      setAllMastery(mastery);
      setSummaries(sessions);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

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

  const comingDue = [...allMastery]
    .filter((m) => m.dueAt && muscleIds.has(m.structureId) && !dueMuscles.some((d) => d.structureId === m.structureId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 3);

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
