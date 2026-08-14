import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getRepository, type AnatomyRepository } from '../data/repository';

interface RepositoryState {
  repository: AnatomyRepository | null;
  loading: boolean;
}

const RepositoryContext = createContext<RepositoryState>({ repository: null, loading: true });

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RepositoryState>({ repository: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    getRepository().then((repository) => {
      if (!cancelled) setState({ repository, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <RepositoryContext.Provider value={state}>{children}</RepositoryContext.Provider>;
}

/** Throws if used before the repository has finished loading — see useRepository() for the safe variant. */
export function useRepositoryContext(): RepositoryState {
  return useContext(RepositoryContext);
}
