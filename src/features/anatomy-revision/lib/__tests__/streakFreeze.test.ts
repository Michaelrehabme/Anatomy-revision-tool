import { describe, it, expect } from 'vitest';
import { reconcileStreakFreezes, INITIAL_STREAK_FREEZE_STATE, STREAK_FREEZE_CONFIG } from '../streakFreeze';

const now = new Date('2026-08-25T12:00:00.000Z'); // a Tuesday

describe('reconcileStreakFreezes', () => {
  it('returns 0 streak and no freeze activity with no history', () => {
    const result = reconcileStreakFreezes(new Set(), INITIAL_STREAK_FREEZE_STATE, now);
    expect(result.effectiveStreak).toBe(0);
    expect(result.freezeConsumedForDayKey).toBeNull();
    expect(result.freezeEarned).toBe(false);
  });

  it('does not spend a freeze when there is no gap to bridge', () => {
    const studied = new Set(['2026-08-24', '2026-08-25']);
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 2 };
    const result = reconcileStreakFreezes(studied, state, now);
    expect(result.effectiveStreak).toBe(2);
    expect(result.freezeConsumedForDayKey).toBeNull();
    expect(result.state.freezesHeld).toBe(2);
  });

  it('spends a held freeze to bridge a single missed day and keeps the streak alive', () => {
    // studied Sun/Mon (23rd/24th... wait, use fixed dates), missed yesterday (24th), day before (23rd) was studied.
    const studied = new Set(['2026-08-22', '2026-08-23']); // missed 2026-08-24 (yesterday relative to 'now' = 25th)
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 1 };
    const result = reconcileStreakFreezes(studied, state, now);
    expect(result.freezeConsumedForDayKey).toBe('2026-08-24');
    expect(result.state.freezesHeld).toBe(0);
    expect(result.state.frozenDayKeys).toContain('2026-08-24');
    // covered days now: 22,23 studied + 24 frozen -> consecutive through to the 24th (today, the 25th, not yet studied doesn't break it)
    expect(result.effectiveStreak).toBe(3);
  });

  it('does not spend a freeze when there was no active streak to protect', () => {
    // Only a single stray day studied long before yesterday - the day before yesterday was NOT covered.
    const studied = new Set(['2026-08-10']);
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 2 };
    const result = reconcileStreakFreezes(studied, state, now);
    expect(result.freezeConsumedForDayKey).toBeNull();
    expect(result.state.freezesHeld).toBe(2);
  });

  it('does not spend a freeze it does not have', () => {
    const studied = new Set(['2026-08-22', '2026-08-23']);
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 0 };
    const result = reconcileStreakFreezes(studied, state, now);
    expect(result.freezeConsumedForDayKey).toBeNull();
    expect(result.effectiveStreak).toBe(0); // gap not bridged, streak lapsed per normal rules
  });

  it('earns a new freeze when the effective streak crosses the earn threshold', () => {
    const days = Array.from({ length: STREAK_FREEZE_CONFIG.earnEveryNDays }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 0 };
    const result = reconcileStreakFreezes(new Set(days), state, now);
    expect(result.effectiveStreak).toBe(STREAK_FREEZE_CONFIG.earnEveryNDays);
    expect(result.freezeEarned).toBe(true);
    expect(result.state.freezesHeld).toBe(1);
  });

  it('never earns above the configured cap', () => {
    const days = Array.from({ length: STREAK_FREEZE_CONFIG.earnEveryNDays }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: STREAK_FREEZE_CONFIG.maxHeld };
    const result = reconcileStreakFreezes(new Set(days), state, now);
    expect(result.freezeEarned).toBe(false);
    expect(result.state.freezesHeld).toBe(STREAK_FREEZE_CONFIG.maxHeld);
  });

  it('is idempotent within the same calendar day', () => {
    const studied = new Set(['2026-08-22', '2026-08-23']);
    const state = { ...INITIAL_STREAK_FREEZE_STATE, freezesHeld: 1, lastReconciledDayKey: '2026-08-25' };
    const result = reconcileStreakFreezes(studied, state, now);
    expect(result.freezeConsumedForDayKey).toBeNull();
    expect(result.state).toEqual(state); // unchanged — already reconciled today
  });
});
