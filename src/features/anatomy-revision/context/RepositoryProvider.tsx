import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getRepository, type AnatomyRepository } from '../data/repository';

interface RepositoryState {
  repository: AnatomyRepository | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const NOOP_RETRY = () => {};

const RepositoryContext = createContext<RepositoryState>({
  repository: null,
  loading: true,
  error: null,
  retry: NOOP_RETRY,
});

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<RepositoryState, 'retry'>>({
    repository: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    getRepository()
      .then((repository) => {
        if (!cancelled) setState({ repository, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ repository: null, loading: false, error: 'Could not load anatomy content. Check your connection and try again.' });
          console.error('Failed to load repository:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => setAttempt((n) => n + 1);

  return <RepositoryContext.Provider value={{ ...state, retry }}>{children}</RepositoryContext.Provider>;
}

/** Throws if used before the repository has finished loading — see useRepository() for the safe variant. */
export function useRepositoryContext(): RepositoryState {
  return useContext(RepositoryContext);
}
