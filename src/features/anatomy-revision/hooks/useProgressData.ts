import { useEffect, useMemo, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { StructureMastery } from '../types/attempt';
import { isMuscle, type MuscleStructure } from '../types/structure';
import type { Region } from '../types/region';
import { REGIONS } from '../types/region';
import { computeStreak } from '../lib/streak';

const FORECAST_DAYS = 14;

export interface RegionProgress {
  region: Region;
  total: number;
  seenCount: number;
  pct: number;
}

export interface ProgressData {
  streak: number;
  muscles: MuscleStructure[];
  masteryByStructureId: Map<string, StructureMastery>;
  seenCount: number;
  untouched: MuscleStructure[];
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
  const seenIds = new Set(mastery.map((m) => m.structureId));
  const seenCount = muscles.filter((m) => seenIds.has(m.id)).length;
  const untouched = muscles.filter((m) => !seenIds.has(m.id));

  const byRegion: RegionProgress[] = REGIONS.map((region) => {
    const regionMuscles = muscles.filter((m) => m.region === region);
    const seen = regionMuscles.filter((m) => {
      const row = masteryByStructureId.get(m.id);
      return row && row.attemptsCorrect / Math.max(1, row.attemptsTotal) >= 0.01; // seen at all
    });
    const correct = regionMuscles.reduce((sum, m) => {
      const row = masteryByStructureId.get(m.id);
      return sum + (row ? row.attemptsCorrect / Math.max(1, row.attemptsTotal) : 0);
    }, 0);
    const pct = regionMuscles.length > 0 ? Math.round((correct / regionMuscles.length) * 100) : 0;
    return { region, total: regionMuscles.length, seenCount: seen.length, pct };
  }).filter((r) => r.total > 0);

  const now = new Date();
  const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    return mastery.filter((m) => m.dueAt?.slice(0, 10) === key).length;
  });
  const forecastMax = Math.max(1, ...forecast);

  return { streak, muscles, masteryByStructureId, seenCount, untouched, byRegion, forecast, forecastMax };
}
