import { toDayKey, computeStreakFromDayKeys } from './streak';

/** Earn one freeze per this many streak days, held up to this cap. */
export const STREAK_FREEZE_CONFIG = {
  earnEveryNDays: 10,
  maxHeld: 2,
};

export interface StreakFreezeState {
  freezesHeld: number;
  /** Day-keys (YYYY-MM-DD) treated as studied for streak purposes, without an actual session that day. */
  frozenDayKeys: string[];
  /** Day-key this reconciliation last ran for — makes a same-day re-run a no-op instead of double-spending/double-earning. */
  lastReconciledDayKey: string | null;
}

export const INITIAL_STREAK_FREEZE_STATE: StreakFreezeState = {
  freezesHeld: 0,
  frozenDayKeys: [],
  lastReconciledDayKey: null,
};

export interface ReconcileResult {
  state: StreakFreezeState;
  effectiveStreak: number;
  freezeConsumedForDayKey: string | null;
  freezeEarned: boolean;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(Date.parse(`${iso}T00:00:00.000Z`));
  d.setUTCDate(d.getUTCDate() + delta);
  return toDayKey(d.toISOString());
}

/**
 * Run once per app session (idempotent per calendar day via
 * lastReconciledDayKey — repeat calls the same day just report current
 * state). If exactly yesterday was missed, the day before it was covered
 * (studied or already frozen) — i.e. a real streak was actually at risk —
 * and a freeze is held, yesterday is retroactively marked frozen so the
 * streak survives it. Also earns a new freeze every `earnEveryNDays` of
 * (studied + frozen) streak, capped at `maxHeld`.
 *
 * This is deliberately a client-side, call-time reconciliation rather than
 * a server cron: there is no backend job in this app, so "was a day
 * missed" can only be noticed the next time the student opens it.
 */
export function reconcileStreakFreezes(
  studiedDayKeys: Set<string>,
  state: StreakFreezeState,
  now: Date = new Date(),
  config = STREAK_FREEZE_CONFIG,
): ReconcileResult {
  const todayKey = toDayKey(now.toISOString());

  if (state.lastReconciledDayKey === todayKey) {
    const covered = new Set([...studiedDayKeys, ...state.frozenDayKeys]);
    return { state, effectiveStreak: computeStreakFromDayKeys(covered, now), freezeConsumedForDayKey: null, freezeEarned: false };
  }

  let freezesHeld = state.freezesHeld;
  const frozenDayKeys = new Set(state.frozenDayKeys);
  let freezeConsumedForDayKey: string | null = null;

  const yesterdayKey = addDays(todayKey, -1);
  const dayBeforeKey = addDays(todayKey, -2);
  const yesterdayMissed = !studiedDayKeys.has(yesterdayKey) && !frozenDayKeys.has(yesterdayKey);
  const streakWasActive = studiedDayKeys.has(dayBeforeKey) || frozenDayKeys.has(dayBeforeKey);

  if (yesterdayMissed && streakWasActive && freezesHeld > 0) {
    frozenDayKeys.add(yesterdayKey);
    freezesHeld -= 1;
    freezeConsumedForDayKey = yesterdayKey;
  }

  const covered = new Set([...studiedDayKeys, ...frozenDayKeys]);
  const effectiveStreak = computeStreakFromDayKeys(covered, now);

  let freezeEarned = false;
  if (effectiveStreak > 0 && effectiveStreak % config.earnEveryNDays === 0 && freezesHeld < config.maxHeld) {
    freezesHeld += 1;
    freezeEarned = true;
  }

  return {
    state: { freezesHeld, frozenDayKeys: [...frozenDayKeys], lastReconciledDayKey: todayKey },
    effectiveStreak,
    freezeConsumedForDayKey,
    freezeEarned,
  };
}
