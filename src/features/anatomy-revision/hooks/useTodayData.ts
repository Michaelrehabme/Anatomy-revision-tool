import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { StructureMastery, RevisionSessionSummary } from '../types/attempt';
import { isMuscle } from '../types/structure';
import { computeStreak } from '../lib/streak';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface TodayData {
  loading: boolean;
  streak: number;
  /** Muscles only — content also includes bones/landmarks, not part of this screen's "122 muscles" framing. */
  totalMuscleCount: number;
  seenMusclePct: number;
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
export function useTodayData(repository: AnatomyRepository | null, userId: string | null, content: AnatomyContent): TodayData {
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
  const muscleIds = new Set(content.structures.filter(isMuscle).map((s) => s.id));
  const totalMuscleCount = muscleIds.size;
  const seenCount = allMastery.filter((m) => muscleIds.has(m.structureId)).length;
  const seenMusclePct = totalMuscleCount > 0 ? Math.round((seenCount / totalMuscleCount) * 100) : 0;
  const dueMuscles = due.filter((m) => muscleIds.has(m.structureId));

  const weakest = [...allMastery]
    .filter((m) => m.attemptsTotal > 0 && muscleIds.has(m.structureId))
    .sort((a, b) => a.attemptsCorrect / a.attemptsTotal - b.attemptsCorrect / b.attemptsTotal)
    .slice(0, 5);

  const comingDue = [...allMastery]
    .filter((m) => m.dueAt && muscleIds.has(m.structureId) && !dueMuscles.some((d) => d.structureId === m.structureId))
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 3);

  const now = new Date();
  const weekBuckets = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    return summaries.filter((s) => s.startedAt.slice(0, 10) === key).length;
  });
  const weekMax = Math.max(1, ...weekBuckets);

  return {
    loading,
    streak,
    totalMuscleCount,
    seenMusclePct,
    dueMuscles,
    allMastery,
    weakest,
    comingDue,
    weekBuckets,
    weekMax,
    dayLabels: DAY_LABELS,
  };
}

export function relativeDue(dueAt: string, now: Date): string {
  const days = Math.round((Date.parse(dueAt) - now.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
