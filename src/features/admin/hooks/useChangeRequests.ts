import { useCallback, useEffect, useState } from 'react';
import {
  listChangeRequests,
  createChangeRequest,
  updateChangeRequestStatus,
  updateChangeRequestNotes,
} from '../data/changeRequestsRepository';
import { applyStatusTransition } from '../lib/statusTransition';
import type { ChangeRequest, ChangeStatus, NewChangeRequestInput } from '../types/changeRequest';

export function useChangeRequests() {
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listChangeRequests());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load change requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: NewChangeRequestInput) => {
      await createChangeRequest(input);
      await reload();
    },
    [reload],
  );

  /** Optimistically applies the transition locally, then persists — see lib/statusTransition for the stamping rule. */
  const setStatus = useCallback(
    async (ref: string, nextStatus: ChangeStatus) => {
      const target = items.find((i) => i.ref === ref);
      if (!target) return;
      const update = applyStatusTransition(target, nextStatus);
      setItems((prev) => prev.map((i) => (i.ref === ref ? { ...i, ...update } : i)));
      await updateChangeRequestStatus(ref, update);
    },
    [items],
  );

  const setNotes = useCallback(async (ref: string, notes: string) => {
    setItems((prev) => prev.map((i) => (i.ref === ref ? { ...i, notes } : i)));
    await updateChangeRequestNotes(ref, notes);
  }, []);

  return { items, loading, error, reload, create, setStatus, setNotes };
}
