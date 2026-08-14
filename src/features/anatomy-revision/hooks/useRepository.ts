import { useRepositoryContext } from '../context/RepositoryProvider';
import type { AnatomyRepository } from '../data/repository';

/**
 * Convenience accessor for components that only render once the repository
 * is ready (RepositoryProvider mounts children immediately, so guard with
 * `loading` at the call site — e.g. RevisionSetup shows a loading state).
 */
export function useRepository(): { repository: AnatomyRepository | null; loading: boolean } {
  const { repository, loading } = useRepositoryContext();
  return { repository, loading };
}
