import { useEffect, useState } from 'react';
import type { AnatomyRepository } from '../data/repository';
import type { StructureMastery } from '../types/attempt';

/** The single mastery row for one structure — the Muscle Card's "your history" (desktop and mobile). */
export function useMuscleHistory(
  repository: AnatomyRepository | null,
  userId: string | null,
  structureId: string,
): StructureMastery | undefined {
  const [mastery, setMastery] = useState<StructureMastery | undefined>(undefined);

  useEffect(() => {
    if (!repository || !userId) return;
    let cancelled = false;
    repository.listMastery(userId).then((all) => {
      if (!cancelled) setMastery(all.find((m) => m.structureId === structureId));
    });
    return () => {
      cancelled = true;
    };
  }, [repository, userId, structureId]);

  return mastery;
}
