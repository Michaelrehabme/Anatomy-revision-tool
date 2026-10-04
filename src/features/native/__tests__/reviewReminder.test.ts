import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactMastery, StructureMastery } from '../../anatomy-revision/types/attempt';
import { buildReviewQueue } from '../../anatomy-revision/lib/reviewQueue';
import { REMINDER_HOUR, planReviewReminder, reminderBody } from '../reviewReminderPlan';

const plugin = vi.hoisted(() => ({
  cancel: vi.fn(async () => {}),
  checkPermissions: vi.fn(async () => ({ display: 'granted' as string })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' as string })),
  schedule: vi.fn(async () => ({ notifications: [] })),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));

/**
 * The reminder has two ways to be wrong that nobody would see on a desk: it
 * can count differently from the Today screen it opens, and it can do
 * something — anything — in a browser, where it must not exist.
 */

// Local time throughout: the slot is a local hour, so the fixtures are too.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute, 0, 0);
const NOW = at(5, 10);

function naming(structureId: string, o: Partial<StructureMastery>): StructureMastery {
  return { structureId, userId: 'u', attemptsTotal: 6, attemptsCorrect: 6, lastAttemptAt: NOW.toISOString(), ...o };
}
function fact(structureId: string, promptKind: FactMastery['promptKind'], o: Partial<FactMastery>): FactMastery {
  return {
    userId: 'u', structureId, promptKind, attemptsTotal: 4, attemptsCorrect: 3, streak: 1, missStreak: 0,
    lastCorrect: true, lastAttemptAt: NOW.toISOString(), typed: true, bare: false, ...o,
  };
}

const ELIGIBLE = new Set(['deltoid', 'supraspinatus']);

describe('planReviewReminder', () => {
  it('sets nothing when nothing has been met', () => {
    expect(planReviewReminder([], [], ELIGIBLE, NOW)).toBeNull();
  });

  it('reminds this evening when reviews are already due', () => {
    const plan = planReviewReminder(
      [naming('deltoid', { dueAt: at(4, 9).toISOString() })],
      [fact('deltoid', 'origin', { dueAt: at(5, 8).toISOString() })],
      ELIGIBLE,
      NOW,
    );
    expect(plan?.at).toEqual(at(5, REMINDER_HOUR));
    expect(plan?.count).toBe(2);
    expect(plan?.body).toBe('2 reviews are due.');
  });

  it('counts what will be due BY the reminder, exactly as the Today screen would then', () => {
    const mastery = [naming('deltoid', { dueAt: at(5, 16).toISOString() }), naming('supraspinatus', { dueAt: at(5, 20).toISOString() })];
    const plan = planReviewReminder(mastery, [], ELIGIBLE, NOW);
    // 16:00 is before the 18:00 slot and counts; 20:00 is after it and does not.
    expect(plan?.count).toBe(1);
    expect(plan?.count).toBe(buildReviewQueue(mastery, [], ELIGIBLE, plan!.at).due.length);
  });

  it('moves to tomorrow once today\'s slot has passed', () => {
    const plan = planReviewReminder([naming('deltoid', { dueAt: at(4, 9).toISOString() })], [], ELIGIBLE, at(5, 19));
    expect(plan?.at).toEqual(at(6, REMINDER_HOUR));
  });

  it('waits for the first day that has anything due, rather than firing empty', () => {
    const plan = planReviewReminder([naming('deltoid', { dueAt: at(9, 7).toISOString() })], [], ELIGIBLE, NOW);
    expect(plan?.at).toEqual(at(9, REMINDER_HOUR));
    expect(plan?.body).toBe('1 review is due.');
  });

  it('never reminds about a structure in a locked area', () => {
    const locked = naming('gluteus-maximus', { dueAt: at(4, 9).toISOString() });
    expect(planReviewReminder([locked], [], ELIGIBLE, NOW)).toBeNull();
  });

  it('sets nothing for a review further off than the horizon', () => {
    expect(planReviewReminder([naming('deltoid', { dueAt: at(30, 9).toISOString() })], [], ELIGIBLE, NOW)).toBeNull();
  });

  it('says one review, not "1 reviews"', () => {
    expect(reminderBody(1)).toBe('1 review is due.');
    expect(reminderBody(12)).toBe('12 reviews are due.');
  });
});

describe('syncReviewReminder', () => {
  const input = { mastery: [naming('deltoid', { dueAt: at(4, 9).toISOString() })], facts: [], eligible: ELIGIBLE };
  const shell = globalThis as { Capacitor?: { isNativePlatform: () => boolean } };

  beforeEach(() => {
    vi.clearAllMocks();
    plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
    plugin.requestPermissions.mockResolvedValue({ display: 'granted' });
  });
  afterEach(() => {
    delete shell.Capacitor;
  });

  it('does nothing at all in a browser', async () => {
    const { isNativeShell, syncReviewReminder } = await import('../nativeShell');
    expect(isNativeShell()).toBe(false);
    await syncReviewReminder(input);
    expect(plugin.cancel).not.toHaveBeenCalled();
    expect(plugin.checkPermissions).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('does nothing in a browser that merely has the Capacitor web runtime loaded', async () => {
    shell.Capacitor = { isNativePlatform: () => false };
    const { syncReviewReminder } = await import('../nativeShell');
    await syncReviewReminder(input);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('replaces the one pending notification inside the shell', async () => {
    shell.Capacitor = { isNativePlatform: () => true };
    const { syncReviewReminder } = await import('../nativeShell');
    const { REVIEW_REMINDER_ID } = await import('../reviewReminder');
    await syncReviewReminder(input);
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: REVIEW_REMINDER_ID }] });
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
    const [{ notifications }] = plugin.schedule.mock.calls[0] as unknown as [{ notifications: { id: number; body: string; schedule: { at: Date } }[] }];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe(REVIEW_REMINDER_ID);
    expect(notifications[0].body).toBe('1 review is due.');
    expect(notifications[0].schedule.at.getHours()).toBe(REMINDER_HOUR);
  });

  it('clears the pending notification, and asks for no permission, when nothing is due', async () => {
    const { scheduleReviewReminder } = await import('../reviewReminder');
    expect(await scheduleReviewReminder({ mastery: [], facts: [], eligible: ELIGIBLE }, NOW)).toBe('cleared');
    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.checkPermissions).not.toHaveBeenCalled();
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('asks once when the system has not been asked, and respects a refusal', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'prompt' });
    plugin.requestPermissions.mockResolvedValue({ display: 'denied' });
    const { scheduleReviewReminder } = await import('../reviewReminder');
    expect(await scheduleReviewReminder(input, NOW)).toBe('denied');
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('does not ask again once refused', async () => {
    plugin.checkPermissions.mockResolvedValue({ display: 'denied' });
    const { scheduleReviewReminder } = await import('../reviewReminder');
    expect(await scheduleReviewReminder(input, NOW)).toBe('denied');
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('never throws into the screen that called it', async () => {
    shell.Capacitor = { isNativePlatform: () => true };
    plugin.cancel.mockRejectedValueOnce(new Error('plugin not implemented'));
    const { syncReviewReminder } = await import('../nativeShell');
    await expect(syncReviewReminder(input)).resolves.toBeUndefined();
  });
});
