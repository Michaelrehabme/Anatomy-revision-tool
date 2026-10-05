import { useEffect, useMemo, useState } from 'react';
import type { FactMastery } from '../types/attempt';
import { factsIndex, structureLevel, type MasteryLevel } from '../lib/masteryLevel';
import { factDueAt } from '../lib/factMastery';
import type { AnatomyRepository } from '../data/repository';
import type { AnatomyContent } from './useAnatomyContent';
import type { StructureMastery } from '../types/attempt';
import { CATEGORIES, type Category } from '../types/structure';
import type { StructureIndexEntry } from '../types/structureIndex';
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
  /**
   * Every kind of structure in the region — bones, joints, ligaments as well
   * as muscles — counted by mastery level (lib/masteryLevel.ts), plus those
   * never met. Sums to the region's structure count, not `total`, which is
   * muscles only.
   */
  levels: LevelCounts;
}

export type LevelCounts = Record<MasteryLevel | 'unmet', number>;

export interface CategoryCoverage {
  seen: number;
  total: number;
}

export interface ProgressData {
  streak: number;
  /**
   * Index entries, not full structures: progress is counted over the whole
   * body, including areas whose facts are not on the device — a free account
   * sees how much there is, and a lapsed subscriber keeps their history.
   */
  muscles: StructureIndexEntry[];
  /** Every kind, not only muscles — the content has five and a student studies all of them. */
  seenByCategory: Record<Category, CategoryCoverage>;
  totalStructures: number;
  /** Structures of every kind with at least one graded attempt. */
  totalSeen: number;
  masteryByStructureId: Map<string, StructureMastery>;
  seenCount: number;
  untouched: StructureIndexEntry[];
  leeches: StructureIndexEntry[];
  byRegion: RegionProgress[];
  forecast: number[];
  forecastMax: number;
}

/** Shared data-fetching + derivation for the Progress screen (desktop and mobile). */
export function useProgressData(repository: AnatomyRepository | null, userId: string | null, content: AnatomyContent): ProgressData {
  const [mastery, setMastery] = useState<StructureMastery[]>([]);
  const [facts, setFacts] = useState<FactMastery[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    Promise.all([repository.listMastery(userId), repository.listSessionSummaries(userId, 60), repository.listFactMastery(userId)]).then(
      ([m, summaries, facts]) => {
        if (cancelled) return;
        setMastery(m);
        setFacts(facts);
        setStreak(computeStreak(summaries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  // Everything below reads content.index. A level needs the KINDS of fact a
  // structure has, which the index carries (factKinds), not the facts.
  const muscles = useMemo(() => content.index.filter((s) => s.category === 'muscle'), [content.index]);
  const masteryByStructureId = useMemo(() => new Map(mastery.map((m) => [m.structureId, m])), [mastery]);
  const factsByKey = useMemo(() => factsIndex(facts), [facts]);
  // "Seen" means a mastery row exists: a structure the student has been
  // graded on at least once, right or wrong. The region rows below used to
  // require a correct answer as well, so a muscle attempted and missed showed
  // as seen in the headline and unseen in its region.
  const seenIds = new Set(mastery.map((m) => m.structureId));
  const seenCount = muscles.filter((m) => seenIds.has(m.id)).length;
  const seenByCategory = Object.fromEntries(
    CATEGORIES.map((category) => {
      const ofKind = content.index.filter((s) => s.category === category);
      return [category, { seen: ofKind.filter((s) => seenIds.has(s.id)).length, total: ofKind.length }];
    }),
  ) as Record<Category, CategoryCoverage>;
  const totalStructures = content.index.length;
  const totalSeen = content.index.filter((s) => seenIds.has(s.id)).length;
  const untouched = muscles.filter((m) => !seenIds.has(m.id));
  const leeches = muscles.filter((m) => masteryByStructureId.get(m.id)?.isLeech);

  const now = new Date();
  const byRegion: RegionProgress[] = REGIONS.map((region) => {
    const regionMuscles = muscles.filter((m) => m.region === region);
    const seen = regionMuscles.filter((m) => seenIds.has(m.id));
    const correct = regionMuscles.reduce((sum, m) => {
      const row = masteryByStructureId.get(m.id);
      return sum + (row ? row.attemptsCorrect / Math.max(1, row.attemptsTotal) : 0);
    }, 0);
    const pct = regionMuscles.length > 0 ? Math.round((correct / regionMuscles.length) * 100) : 0;
    const levels: LevelCounts = { unmet: 0, beginner: 0, novice: 0, intermediate: 0, advanced: 0, master: 0 };
    for (const s of content.index) {
      if (s.region !== region) continue;
      const state = structureLevel(s, masteryByStructureId.get(s.id), factsByKey, now);
      levels[state.seen ? state.level : 'unmet'] += 1;
    }
    return { region, total: regionMuscles.length, seenCount: seen.length, pct, levels };
  }).filter((r) => r.total > 0);

  const horizon = lastDays(new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_DAYS - 1), FORECAST_DAYS);
  const forecast = horizon.map((day) => {
    const key = localDayKey(day);
    // Naming and every fact are reviewed on their own dates now (2 Oct 2026).
    return (
      mastery.filter((m) => m.dueAt && localDayKey(m.dueAt) === key).length +
      facts.filter((f) => localDayKey(factDueAt(f)) === key).length
    );
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
