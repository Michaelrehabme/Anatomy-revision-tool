import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listCohortsOwnedBy } from '../data/cohortsRepository';
import { useEducatorSession } from './RequireEducator';
import type { Cohort } from '../types/cohort';

interface CohortsState {
  cohorts: Cohort[] | null;
  loading: boolean;
  error: string | null;
  /** Re-reads the owner's classes — called after creating one, so the switcher updates without a reload. */
  refresh: () => void;
}

const CohortsContext = createContext<CohortsState | null>(null);

export function useCohorts(): CohortsState {
  const state = useContext(CohortsContext);
  if (!state) throw new Error('useCohorts must be used inside <CohortsProvider>.');
  return state;
}

/**
 * The classes this person owns, held at shell level so the sidebar switcher
 * and the screen below it read one list rather than each fetching their own —
 * and so creating a class can refresh both.
 */
export function CohortsProvider({ children }: { children: ReactNode }) {
  const { uid } = useEducatorSession();
  const [cohorts, setCohorts] = useState<Cohort[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    listCohortsOwnedBy(uid)
      .then((result) => {
        if (!cancelled) setCohorts(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load your classes.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, nonce]);

  return (
    <CohortsContext.Provider value={{ cohorts, loading: cohorts === null && !error, error, refresh }}>
      {children}
    </CohortsContext.Provider>
  );
}
