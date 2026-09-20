import { useEffect, useMemo, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { StructureMastery } from '../types/attempt';
import { CATEGORIES, isMuscle, type Category, type MuscleStructure } from '../types/structure';
import type { Region } from '../types/region';
import { REGIONS } from '../types/region';
import { computeStreak } from '../lib/streak';
import { lastDays, localDayKey } from '../lib/weekActivity';

const FORECAST_DAYS = 14;

export interface RegionProgress {
  region: Region;
  total: number;
  seenCount: number;
  pct: number;
}

export interface CategoryCoverage {
  seen: number;
  total: number;
}

export interface ProgressData {
  streak: number;
  muscles: MuscleStructure[];
  /** Every kind, not only muscles — the content has five and a student studies all of them. */
  seenByCategory: Record<Category, CategoryCoverage>;
  totalStructures: number;
  /** Structures of every kind with at least one graded attempt. */
  totalSeen: number;
  masteryByStructureId: Map<string, StructureMastery>;
  seenCount: number;
  untouched: MuscleStructure[];
  leeches: MuscleStructure[];
  byRegion: RegionProgress[];
  forecast: number[];
  forecastMax: number;
}

/** Shared data-fetching + derivation for the Progress screen (desktop and mobile). */
export function useProgressData(repository: AnatomyRepository | null, userId: string | null, content: AnatomyContent): ProgressData {
  const [mastery, setMastery] = useState<StructureMastery[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    Promise.all([repository.listMastery(userId), repository.listSessionSummaries(userId, 60)]).then(
      ([m, summaries]) => {
        if (cancelled) return;
        setMastery(m);
        setStreak(computeStreak(summaries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  const muscles = useMemo(() => content.structures.filter(isMuscle), [content.structures]);
  const masteryByStructureId = useMemo(() => new Map(mastery.map((m) => [m.structureId, m])), [mastery]);
  // "Seen" means a mastery row exists: a structure the student has been
  // graded on at least once, right or wrong. The region rows below used to
  // require a correct answer as well, so a muscle attempted and missed showed
  // as seen in the headline and unseen in its region.
  const seenIds = new Set(mastery.map((m) => m.structureId));
  const seenCount = muscles.filter((m) => seenIds.has(m.id)).length;
  const seenByCategory = Object.fromEntries(
    CATEGORIES.map((category) => {
      const ofKind = content.structures.filter((s) => s.category === category);
      return [category, { seen: ofKind.filter((s) => seenIds.has(s.id)).length, total: ofKind.length }];
    }),
  ) as Record<Category, CategoryCoverage>;
  const totalStructures = content.structures.length;
  const totalSeen = content.structures.filter((s) => seenIds.has(s.id)).length;
  const untouched = muscles.filter((m) => !seenIds.has(m.id));
  const leeches = muscles.filter((m) => masteryByStructureId.get(m.id)?.isLeech);

  const byRegion: RegionProgress[] = REGIONS.map((region) => {
    const regionMuscles = muscles.filter((m) => m.region === region);
    const seen = regionMuscles.filter((m) => seenIds.has(m.id));
    const correct = regionMuscles.reduce((sum, m) => {
      const row = masteryByStructureId.get(m.id);
      return sum + (row ? row.attemptsCorrect / Math.max(1, row.attemptsTotal) : 0);
    }, 0);
    const pct = regionMuscles.length > 0 ? Math.round((correct / regionMuscles.length) * 100) : 0;
    return { region, total: regionMuscles.length, seenCount: seen.length, pct };
  }).filter((r) => r.total > 0);

  const now = new Date();
  const horizon = lastDays(new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_DAYS - 1), FORECAST_DAYS);
  const forecast = horizon.map((day) => {
    const key = localDayKey(day);
    return mastery.filter((m) => m.dueAt && localDayKey(m.dueAt) === key).length;
  });
  const forecastMax = Math.max(1, ...forecast);

  return {
    streak,
    muscles,
    seenByCategory,
    totalStructures,
    totalSeen,
    masteryByStructureId,
    seenCount,
    untouched,
    leeches,
    byRegion,
    forecast,
    forecastMax,
  };
}
