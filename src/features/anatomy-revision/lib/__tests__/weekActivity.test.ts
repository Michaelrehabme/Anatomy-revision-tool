import { describe, it, expect } from 'vitest';
import { localDayKey, lastDays, sessionsPerDay } from '../weekActivity';
import type { RevisionSessionSummary } from '../../types/attempt';
import { emptyCategoryBreakdown } from '../../types/structure';

function summaryAt(startedAt: string): RevisionSessionSummary {
  return {
    id: `s-${startedAt}`,
    userId: 'user-1',
    startedAt,
    questionTypes: ['mcq'],
    totalQuestions: 5,
    correctCount: 4,
    breakdownByCategory: emptyCategoryBreakdown(),
    breakdownByRegion: {},
    missedStructureIds: [],
  };
}

describe('sessionsPerDay', () => {
  it('ends on today and labels each bar with its own weekday', () => {
    const now = new Date(2026, 8, 20, 15, 0); // Sunday 20 Sep 2026, local
    const week = sessionsPerDay([], now);
    expect(week).toHaveLength(7);
    expect(week[6].key).toBe('2026-09-20');
    expect(week[0].key).toBe('2026-09-14');
    expect(week.map((d) => d.label)).toEqual(
      lastDays(now, 7).map((d) => d.toLocaleDateString(undefined, { weekday: 'narrow' })),
    );
    expect(week[6].label).toBe(new Date(2026, 8, 20).toLocaleDateString(undefined, { weekday: 'narrow' }));
  });

  it('counts a session on the local day it was started', () => {
    const now = new Date(2026, 8, 20, 15, 0);
    const twoToday = [summaryAt(new Date(2026, 8, 20, 9, 0).toISOString()), summaryAt(new Date(2026, 8, 20, 21, 30).toISOString())];
    const oneEarlier = [summaryAt(new Date(2026, 8, 17, 8, 0).toISOString())];
    const week = sessionsPerDay([...twoToday, ...oneEarlier], now);
    expect(week[6].count).toBe(2);
    expect(week[3].count).toBe(1);
    expect(week.reduce((n, d) => n + d.count, 0)).toBe(3);
  });

  it('produces seven distinct consecutive keys across a clock change', () => {
    // The UK clocks go back on 25 Oct 2026; a week straddling it used to
    // repeat or skip a key when local setDate met UTC toISOString.
    const now = new Date(2026, 9, 28, 12, 0);
    const keys = lastDays(now, 7).map(localDayKey);
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
  });
});
