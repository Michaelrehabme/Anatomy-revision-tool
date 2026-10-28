import { useEffect, useState } from 'react';
import { useRepository } from '../../anatomy-revision/hooks/useRepository';
import { computeStreak } from '../../anatomy-revision/lib/streak';
import { countUserAttempts, listUserProfiles } from '../data/usersRepository';
import type { AdminUserRow } from '../types/adminUser';

/**
 * Lists every user profile, then layers on derived stats (attempts,
 * accuracy, streak) — attempt counts from server-side aggregation, the
 * streak from recent session summaries, fetched in parallel per user.
 */
export function useAdminUsers() {
  const { repository } = useRepository();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    setLoading(true);

    listUserProfiles()
      .then(async (profiles) => {
        const withStats = await Promise.all(
          profiles.map(async (profile) => {
            const [attempts, summaries] = await Promise.all([
              countUserAttempts(profile.uid),
              repository.listSessionSummaries(profile.uid, 60),
            ]);
            const row: AdminUserRow = {
              ...profile,
              totalAttempts: attempts.total,
              accuracyPct: attempts.total > 0 ? Math.round((attempts.correct / attempts.total) * 100) : 0,
              streak: computeStreak(summaries),
            };
            return row;
          }),
        );
        if (!cancelled) {
          setRows(withStats);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load users.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repository]);

  return { rows, loading, error };
}
