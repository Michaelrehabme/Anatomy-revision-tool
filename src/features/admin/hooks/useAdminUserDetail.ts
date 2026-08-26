import { useEffect, useState } from 'react';
import { useRepository } from '../../anatomy-revision/hooks/useRepository';
import { useAnatomyContent } from '../../anatomy-revision/hooks/useAnatomyContent';
import { computeStreak } from '../../anatomy-revision/lib/streak';
import { REGIONS } from '../../anatomy-revision/types/region';
import { getUserProfile } from '../data/usersRepository';
import type { AdminUserDetail, RegionAccuracy, WeakStructureRow } from '../types/adminUser';

const WEAKEST_COUNT = 10;

export function useAdminUserDetail(uid: string) {
  const { repository } = useRepository();
  const content = useAnatomyContent(repository);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repository) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getUserProfile(uid),
      repository.listAttempts({ userId: uid }),
      repository.listSessionSummaries(uid, 60),
      repository.listMastery(uid),
    ])
      .then(([profile, attempts, summaries, mastery]) => {
        if (cancelled) return;
        if (!profile) {
          setError('User not found.');
          setLoading(false);
          return;
        }

        const correct = attempts.filter((a) => a.correct).length;

        const byRegion: RegionAccuracy[] = REGIONS.map((region) => {
          const regionAttempts = attempts.filter((a) => a.region === region);
          const regionCorrect = regionAttempts.filter((a) => a.correct).length;
          return {
            region,
            total: regionAttempts.length,
            correct: regionCorrect,
            accuracyPct: regionAttempts.length > 0 ? Math.round((regionCorrect / regionAttempts.length) * 100) : 0,
          };
        }).filter((r) => r.total > 0);

        const weakestStructures: WeakStructureRow[] = [...mastery]
          .filter((m) => m.attemptsTotal > 0)
          .sort((a, b) => a.attemptsCorrect / a.attemptsTotal - b.attemptsCorrect / b.attemptsTotal)
          .slice(0, WEAKEST_COUNT)
          .map((m) => ({
            structureId: m.structureId,
            name: content.structuresById.get(m.structureId)?.name ?? m.structureId,
            attemptsTotal: m.attemptsTotal,
            accuracyPct: Math.round((m.attemptsCorrect / m.attemptsTotal) * 100),
          }));

        setDetail({
          profile,
          totalAttempts: attempts.length,
          accuracyPct: attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0,
          streak: computeStreak(summaries),
          byRegion,
          weakestStructures,
        });
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load user.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repository, uid, content.structuresById]);

  return { detail, loading, error };
}
