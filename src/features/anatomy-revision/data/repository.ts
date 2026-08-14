import type { AnatomyStructure } from '../types/structure';
import type { AnatomyImageAsset } from '../types/image';
import type { UserAttempt, StructureMastery, RevisionSessionSummary } from '../types/attempt';
import type { StructureFilter } from '../lib/indexes';

export interface ImageAssetFilter {
  region?: AnatomyImageAsset['region'];
  mode?: AnatomyImageAsset['mode'];
  structureId?: string;
}

/**
 * Anatomy content (structures/images) is intentionally read-only here and
 * always resolves from the static seed modules — see data/seed/index.ts.
 * Only user-generated data (attempts, mastery, session summaries) is
 * actually persisted per-implementation; that's the boundary this interface
 * exists to enforce, so swapping local <-> Firestore never touches content.
 */
export interface AnatomyRepository {
  listStructures(filter?: StructureFilter): Promise<AnatomyStructure[]>;
  getStructure(id: string): Promise<AnatomyStructure | null>;
  listImageAssets(filter?: ImageAssetFilter): Promise<AnatomyImageAsset[]>;

  recordAttempt(attempt: UserAttempt): Promise<void>;
  getMastery(userId: string): Promise<StructureMastery[]>;
  upsertMastery(mastery: StructureMastery): Promise<void>;

  saveSessionSummary(summary: RevisionSessionSummary): Promise<void>;
  listSessionSummaries(userId: string, limit?: number): Promise<RevisionSessionSummary[]>;
}

export type PersistenceMode = 'local' | 'firestore';

let cached: AnatomyRepository | null = null;

/**
 * Factory: selects the repository implementation from VITE_PERSISTENCE
 * (default "local"). Firestore's SDK is only imported when actually
 * selected, so a "local" dev loop never pays for it.
 */
export async function getRepository(): Promise<AnatomyRepository> {
  if (cached) return cached;

  const mode: PersistenceMode = (import.meta.env.VITE_PERSISTENCE as PersistenceMode) ?? 'local';

  if (mode === 'firestore') {
    const { createFirestoreRepository } = await import('./firestoreRepository');
    cached = await createFirestoreRepository();
  } else {
    const { createLocalRepository } = await import('./localRepository');
    cached = createLocalRepository();
  }

  return cached;
}

/** Test/story helper — bypasses the env-based factory entirely. */
export function resetRepositoryCache(): void {
  cached = null;
}
