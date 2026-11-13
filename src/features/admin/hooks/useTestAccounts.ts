import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { listTestAccountIds, setTestAccount } from '../data/testAccountsRepository';

/**
 * The marked test accounts, shared by every admin screen for the session:
 * the Users list, a user's own page and the Analytics figures all read the
 * same set, so marking an account on one is reflected on the others without
 * a reload. Read once, then kept up to date by the toggles here.
 */
let ids: ReadonlySet<string> = new Set();
let loaded = false;
let loading: Promise<ReadonlySet<string>> | null = null;
let failed: string | null = null;
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** The set, read once per session. Never rejects: a failed read means no account is excluded, which is what the screens showed before. */
export function loadTestAccountIds(): Promise<ReadonlySet<string>> {
  if (!loading) {
    loading = listTestAccountIds()
      .then((set) => {
        ids = set;
        failed = null;
        return ids;
      })
      .catch((err: unknown) => {
        failed = err instanceof Error ? err.message : 'Could not read the test accounts.';
        loading = null;
        return ids;
      })
      .finally(() => {
        loaded = true;
        emit();
      });
  }
  return loading;
}

/** Called after every successful change — Analytics uses it to drop its cache. */
export function onTestAccountsChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface Snapshot {
  ids: ReadonlySet<string>;
  loaded: boolean;
  error: string | null;
}
let snapshot: Snapshot = { ids, loaded, error: failed };
function getSnapshot(): Snapshot {
  if (snapshot.ids !== ids || snapshot.loaded !== loaded || snapshot.error !== failed) {
    snapshot = { ids, loaded, error: failed };
  }
  return snapshot;
}

export function useTestAccounts() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    void loadTestAccountIds();
  }, []);

  /** Optimistic: the row changes at once and goes back if the write is refused. */
  const setMarked = useCallback(
    async (uid: string, marked: boolean, who: { email: string | null; displayName: string | null }) => {
      const before = ids;
      const next = new Set(ids);
      if (marked) next.add(uid);
      else next.delete(uid);
      ids = next;
      failed = null;
      emit();
      try {
        await setTestAccount(uid, marked, who);
        for (const l of changeListeners) l();
      } catch (err) {
        ids = before;
        failed = err instanceof Error ? err.message : 'Could not save that change.';
        emit();
      }
    },
    [],
  );

  return { testIds: state.ids, loaded: state.loaded, error: state.error, setMarked };
}
