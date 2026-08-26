import { useEffect, useState } from 'react';
import { useRepository } from '../../anatomy-revision/hooks/useRepository';
import { computeStreak } from '../../anatomy-revision/lib/streak';
import { listUserProfiles } from '../data/usersRepository';
import type { AdminUserRow } from '../types/adminUser';

/**
 * Lists every user profile, then layers on derived stats (attempts,
 * accuracy, streak) via the same AnatomyRepository queries the student-facing
 * Progress screen uses — one listAttempts/listSessionSummaries pair per user,
 * fetched in parallel. Fine at this app's scale; would need a maintained
 * aggregate doc per user if the user base grew large enough to make N+1
 * reads expensive.
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
              repository.listAttempts({ userId: profile.uid }),
              repository.listSessionSummaries(profile.uid, 60),
            ]);
            const correct = attempts.filter((a) => a.correct).length;
            const row: AdminUserRow = {
              ...profile,
              totalAttempts: attempts.length,
              accuracyPct: attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0,
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
