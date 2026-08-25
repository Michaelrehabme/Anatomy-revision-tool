import { describe, it, expect } from 'vitest';
import { computeStreak } from '../streak';
import type { RevisionSessionSummary } from '../../types/attempt';

function summaryOn(isoDate: string): RevisionSessionSummary {
  return {
    id: `session-${isoDate}`,
    userId: 'user-1',
    startedAt: `${isoDate}T09:00:00.000Z`,
    questionTypes: ['mcq'],
    totalQuestions: 10,
    correctCount: 8,
    breakdownByCategory: {
      muscle: { total: 10, correct: 8 },
      bone: { total: 0, correct: 0 },
      landmark: { total: 0, correct: 0 },
    },
    breakdownByRegion: {},
    missedStructureIds: [],
  };
}

describe('computeStreak', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('returns 0 for no sessions', () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it('counts a single session today as a 1-day streak', () => {
    expect(computeStreak([summaryOn('2026-08-25')], now)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const summaries = ['2026-08-23', '2026-08-24', '2026-08-25'].map(summaryOn);
    expect(computeStreak(summaries, now)).toBe(3);
  });

  it('does not break the streak if today has not been studied yet (yesterday still counts)', () => {
    const summaries = ['2026-08-23', '2026-08-24'].map(summaryOn);
    expect(computeStreak(summaries, now)).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    const summaries = ['2026-08-20', '2026-08-24', '2026-08-25'].map(summaryOn);
    expect(computeStreak(summaries, now)).toBe(2);
  });

  it('resets to 0 once more than a day has been missed', () => {
    const summaries = ['2026-08-20', '2026-08-21'].map(summaryOn);
    expect(computeStreak(summaries, now)).toBe(0);
  });

  it('counts duplicate sessions on the same day once', () => {
    const summaries = [summaryOn('2026-08-25'), summaryOn('2026-08-25')];
    expect(computeStreak(summaries, now)).toBe(1);
  });
});
