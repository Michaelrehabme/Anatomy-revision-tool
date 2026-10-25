import { useEffect, useState } from 'react';
import { AUTH_ENABLED } from '../context/AuthProvider';
import type { ChallengeAssignment } from '../../educator/types/cohort';

/**
 * This week's class challenge for a student in a class, or null
 * (educator/types/cohort.ts ChallengeAssignment). It takes over the weekly
 * focus for that week.
 *
 * Read once per visit and shared: Today and Account both ask, and a class
 * challenge is set for a week, so a second read minutes later would only
 * spend a Firestore read to learn nothing. Like ClassAssignments, a failed
 * read is quietly no challenge — the student's own focus carries on.
 */
/**
 * The challenge, and when the student joined the class: progress counts only
 * what has been answered since, exactly as the teacher's figures do
 * (educator/lib/studentRollup.ts — work from before joining is never the
 * teacher's to see), so the student's card and the teacher's never disagree
 * about whether the target was met.
 */
export interface ClassChallenge {
  challenge: ChallengeAssignment;
  since: string;
}

const cache = new Map<string, Promise<ClassChallenge | null>>();
const listeners = new Set<() => void>();

/**
 * Forget the cached answer, for when the student joins or leaves a class
 * during the visit (CohortMembership): the challenge belongs to the class.
 */
export function refreshClassChallenge(): void {
  cache.clear();
  for (const listener of listeners) listener();
}

async function load(uid: string): Promise<ClassChallenge | null> {
  const { getMyCohort, getMyCohortJoinedAt } = await import('../../educator/data/cohortsRepository');
  const cohort = await getMyCohort(uid);
  if (!cohort) return null;
  const [{ listChallenges }, { activeChallenge }, { ROLLUP_FALLBACK_SINCE }] = await Promise.all([
    import('../../educator/data/assignmentsRepository'),
    import('../../educator/lib/classChallenge'),
    import('../../educator/data/cohortRollups'),
  ]);
  const [challenges, joinedAt] = await Promise.all([listChallenges(cohort.id), getMyCohortJoinedAt(uid)]);
  const challenge = activeChallenge(challenges, new Date());
  return challenge ? { challenge, since: joinedAt ?? ROLLUP_FALLBACK_SINCE } : null;
}

export function useClassChallenge(userId: string | null): ClassChallenge | null {
  const [challenge, setChallenge] = useState<ClassChallenge | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  useEffect(() => {
    if (!AUTH_ENABLED || !userId) {
      setChallenge(null);
      return;
    }
    let cancelled = false;
    let pending = cache.get(userId);
    if (!pending) {
      pending = load(userId).catch((err: unknown) => {
        console.warn('[LocusMSK] Could not load the class challenge.', err);
        return null;
      });
      cache.set(userId, pending);
    }
    void pending.then((c) => !cancelled && setChallenge(c));
    return () => {
      cancelled = true;
    };
  }, [userId, version]);
  return challenge;
}
