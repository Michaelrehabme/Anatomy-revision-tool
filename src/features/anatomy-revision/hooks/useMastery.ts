import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { StructureMastery } from '../types/attempt';

/**
 * Every mastery row for the current user, for correctness-weighted question
 * selection (see lib/scheduling.ts).
 *
 * Session-building callbacks are synchronous, so the rows have to be in hand
 * before the user hits start rather than fetched at the moment of it. Screens
 * that are already awaiting inside their start handler — the two revision setup
 * screens — fetch mastery there instead and do not need this.
 *
 * Returns an empty array while loading, for a signed-out user, or in a local
 * dev session with no repository. Every caller treats that as "no history yet",
 * which generateRevisionSet reads as uniform selection — the pre-CR-006
 * behaviour, and the right fallback.
 */
export function useMastery(repository: AnatomyRepository | null, userId: string | null): StructureMastery[] {
  const [mastery, setMastery] = useState<StructureMastery[]>([]);

  useEffect(() => {
    if (!repository || !userId) {
      setMastery([]);
      return;
    }
    let cancelled = false;
    repository.listMastery(userId).then((rows) => {
      if (!cancelled) setMastery(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId]);

  return mastery;
}
