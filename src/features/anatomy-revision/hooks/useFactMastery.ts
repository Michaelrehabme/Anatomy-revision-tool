import { useEffect, useMemo, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { FactMastery } from '../types/attempt';
import { factsIndex } from '../lib/masteryLevel';

/**
 * Every fact-progress row for the current user, indexed by factMasteryKey —
 * what a level needs to see now that Master requires a structure's facts as
 * well as its name (lib/masteryLevel.ts). Empty while loading, signed out, or
 * with no repository; a level read against no facts can only stop short of
 * Master for a structure that carries facts, never overstate it.
 */
export function useFactMastery(repository: AnatomyRepository | null, userId: string | null): Map<string, FactMastery> {
  const [rows, setRows] = useState<FactMastery[]>([]);

  useEffect(() => {
    if (!repository || !userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    repository.listFactMastery(userId).then((result) => {
      if (!cancelled) setRows(result);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  return useMemo(() => factsIndex(rows), [rows]);
}
