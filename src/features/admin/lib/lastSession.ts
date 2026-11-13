import type { RevisionSessionSummary } from '../../anatomy-revision/types/attempt';

/**
 * When a user last did a set of questions — the newest session summary's
 * finish time, or its start if it was never finished. Distinct from
 * users/{uid}.lastActiveAt, which is refreshed every time the app opens.
 */
export function lastSessionAt(summaries: readonly Pick<RevisionSessionSummary, 'startedAt' | 'finishedAt'>[]): string | null {
  let latest: string | null = null;
  for (const s of summaries) {
    const at = s.finishedAt ?? s.startedAt;
    if (at && (!latest || at > latest)) latest = at;
  }
  return latest;
}
