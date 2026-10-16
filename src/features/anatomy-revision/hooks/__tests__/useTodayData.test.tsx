import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTodayData } from '../useTodayData';
import type { AnatomyRepository } from '../../data/repository';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { emptyCategoryBreakdown } from '../../types/structure';
import type { RevisionSessionSummary } from '../../types/attempt';
import { anatomyContentFrom, type AnatomyContent } from '../useAnatomyContent';
import { STREAK_SESSION_LIMIT } from '../../lib/streak';

const content: AnatomyContent = anatomyContentFrom(ALL_STRUCTURES, ALL_IMAGES);

/** A session started at a LOCAL wall-clock time, as the student saw it. */
function sessionAt(y: number, m: number, d: number, hour: number, minute = 0): RevisionSessionSummary {
  const startedAt = new Date(y, m, d, hour, minute).toISOString();
  return {
    id: `s-${startedAt}`,
    userId: 'user-1',
    startedAt,
    questionTypes: ['mcq'],
    totalQuestions: 10,
    correctCount: 8,
    breakdownByCategory: emptyCategoryBreakdown(),
    breakdownByRegion: {},
    missedStructureIds: [],
  };
}

/** Only what the Today screen reads; any other call is a test failure. */
function stubRepository(summaries: RevisionSessionSummary[], frozenDayKeys: string[] = []) {
  const listSessionSummaries = vi.fn(async (_userId: string, limit: number) => summaries.slice(0, limit));
  const repository = {
    listDueMastery: async () => [],
    listMastery: async () => [],
    listFactMastery: async () => [],
    listSessionSummaries,
    getGamificationProfile: async () => ({ streakFreeze: { freezesHeld: 0, frozenDayKeys, lastReconciledDayKey: null } }),
  } as unknown as AnatomyRepository;
  return { repository, listSessionSummaries };
}

describe('useTodayData: this week', () => {
  // Wednesday 23 Sep 2026, mid-afternoon, local. Only Date is faked, so
  // waitFor's own timers still run.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 15, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts sessions on three days into the right bars, ending on today', async () => {
    const { repository, listSessionSummaries } = stubRepository([
      sessionAt(2026, 8, 23, 9), // today, twice
      sessionAt(2026, 8, 23, 0, 30), // just after midnight: today, not yesterday
      sessionAt(2026, 8, 22, 20), // yesterday
      sessionAt(2026, 8, 19, 11), // Saturday
      sessionAt(2026, 8, 10, 11), // a fortnight ago: off the chart
    ]);

    const { result } = renderHook(() => useTodayData(repository, 'user-1', content, AREAS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(listSessionSummaries).toHaveBeenCalledWith('user-1', STREAK_SESSION_LIMIT);
    // Thu 17 .. Wed 23
    expect(result.current.weekBuckets).toEqual([0, 0, 1, 0, 0, 1, 2]);
    expect(result.current.weekMax).toBe(2);
    expect(result.current.dayLabels).toHaveLength(7);
    expect(result.current.dayLabels.at(-1)).toBe(new Date(2026, 8, 23).toLocaleDateString(undefined, { weekday: 'narrow' }));
    expect(result.current.dayLabels[0]).toBe(new Date(2026, 8, 17).toLocaleDateString(undefined, { weekday: 'narrow' }));
    // Today and yesterday; the Saturday is two days short of joining them.
    expect(result.current.streak).toBe(2);
  });

  it('shows an empty week, not a broken one, with no sessions', async () => {
    const { repository } = stubRepository([]);
    const { result } = renderHook(() => useTodayData(repository, 'user-1', content, AREAS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weekBuckets).toEqual([0, 0, 0, 0, 0, 0, 0]);
    // Never zero, so bar heights never divide by it.
    expect(result.current.weekMax).toBe(1);
    expect(result.current.streak).toBe(0);
  });

  it('counts every day of a long streak, however many sessions a day there were', async () => {
    // Three sessions a day for 15 days, newest first: 45 sessions. Read 30 at
    // a time, as Today used to, this showed a 10-day streak (owner's report,
    // 16 October 2026).
    const sessions = [];
    for (let day = 0; day < 15; day += 1) for (const hour of [18, 13, 8]) sessions.push(sessionAt(2026, 8, 23 - day, hour));
    const { repository } = stubRepository(sessions);
    const { result } = renderHook(() => useTodayData(repository, 'user-1', content, AREAS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.streak).toBe(15);
  });

  it('counts a day a streak freeze covered, as the end of a session does', async () => {
    const { repository } = stubRepository(
      [sessionAt(2026, 8, 23, 9), sessionAt(2026, 8, 21, 9), sessionAt(2026, 8, 20, 9)],
      ['2026-09-22'],
    );
    const { result } = renderHook(() => useTodayData(repository, 'user-1', content, AREAS));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.streak).toBe(4);
  });
});
