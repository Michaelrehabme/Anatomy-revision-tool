import { describe, it, expect } from 'vitest';
import { computeStreak, shiftDayKey, toDayKey } from '../streak';
import type { RevisionSessionSummary } from '../../types/attempt';
import { emptyCategoryBreakdown } from '../../types/structure';

/** Day keys are the student's LOCAL day, so fixtures are built in local time and pass in any zone. */
function localIso(isoDate: string, hour = 9, minute = 0): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute).toISOString();
}

function summaryOn(isoDate: string, hour = 9, minute = 0): RevisionSessionSummary {
  return {
    id: `session-${isoDate}-${hour}-${minute}`,
    userId: 'user-1',
    startedAt: localIso(isoDate, hour, minute),
    questionTypes: ['mcq'],
    totalQuestions: 10,
    correctCount: 8,
    breakdownByCategory: { ...emptyCategoryBreakdown(), muscle: { total: 10, correct: 8 } },
    breakdownByRegion: {},
    missedStructureIds: [],
  };
}

describe('computeStreak', () => {
  const now = new Date(2026, 7, 25, 12, 0); // local noon, Tuesday 25 Aug 2026

  it('returns 0 for no sessions', () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it('counts a single session today as a 1-day streak', () => {
    expect(computeStreak([summaryOn('2026-08-25')], now)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const summaries = ['2026-08-23', '2026-08-24', '2026-08-25'].map((d) => summaryOn(d));
    expect(computeStreak(summaries, now)).toBe(3);
  });

  it('does not break the streak if today has not been studied yet (yesterday still counts)', () => {
    const summaries = ['2026-08-23', '2026-08-24'].map((d) => summaryOn(d));
    expect(computeStreak(summaries, now)).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    const summaries = ['2026-08-20', '2026-08-24', '2026-08-25'].map((d) => summaryOn(d));
    expect(computeStreak(summaries, now)).toBe(2);
  });

  it('resets to 0 once more than a day has been missed', () => {
    const summaries = ['2026-08-20', '2026-08-21'].map((d) => summaryOn(d));
    expect(computeStreak(summaries, now)).toBe(0);
  });

  it('counts duplicate sessions on the same day once', () => {
    const summaries = [summaryOn('2026-08-25'), summaryOn('2026-08-25')];
    expect(computeStreak(summaries, now)).toBe(1);
  });

  it('counts a session just after midnight on the local day it was started', () => {
    // At 00:30 in British summer time the UTC date is still yesterday; the
    // streak used to count it there, and the 24th's session with it.
    const summaries = [summaryOn('2026-08-24'), summaryOn('2026-08-25', 0, 30)];
    expect(toDayKey(summaries[1].startedAt)).toBe('2026-08-25');
    expect(computeStreak(summaries, now)).toBe(2);
  });

  it('walks back across a clock change without skipping or repeating a day', () => {
    // UK clocks go back on 25 Oct 2026.
    const summaries = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map((d) => summaryOn(d, 23, 30));
    expect(computeStreak(summaries, new Date(2026, 9, 27, 23, 45))).toBe(5);
  });
});

describe('shiftDayKey', () => {
  it('moves by calendar days across month ends and clock changes', () => {
    expect(shiftDayKey('2026-10-26', -1)).toBe('2026-10-25');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-03-29', 1)).toBe('2026-03-30');
  });
});
