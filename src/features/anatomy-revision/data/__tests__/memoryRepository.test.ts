import { describe, it, expect } from 'vitest';
import { createMemoryRepository } from '../memoryRepository';
import { INITIAL_GAMIFICATION_PROFILE } from '../repository';
import type { StructureMastery, UserAttempt } from '../../types/attempt';

function attempt(overrides: Partial<UserAttempt> = {}): UserAttempt {
  return {
    id: `attempt-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    sessionId: 'session-1',
    questionId: 'q-deltoid-mcq',
    questionType: 'mcq',
    structureId: 'deltoid',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    correct: true,
    attemptNumber: 1,
    timestamp: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

function mastery(structureId: string, dueAt: string): StructureMastery {
  return {
    structureId,
    userId: 'user-1',
    attemptsTotal: 1,
    attemptsCorrect: 1,
    lastAttemptAt: '2026-08-20T00:00:00.000Z',
    dueAt,
  };
}

describe('memoryRepository listDueMastery/listMastery', () => {
  it('listMastery returns every mastery row for the user', async () => {
    const repo = createMemoryRepository();
    await repo.upsertMastery(mastery('infraspinatus', '2026-08-30T00:00:00.000Z'));
    await repo.upsertMastery(mastery('deltoid', '2026-08-10T00:00:00.000Z'));

    const all = await repo.listMastery('user-1');
    expect(all).toHaveLength(2);
  });

  it('listDueMastery only returns rows due on or before the given time, soonest first', async () => {
    const repo = createMemoryRepository();
    await repo.upsertMastery(mastery('infraspinatus', '2026-08-30T00:00:00.000Z')); // not yet due
    await repo.upsertMastery(mastery('deltoid', '2026-08-10T00:00:00.000Z')); // overdue
    await repo.upsertMastery(mastery('trapezius', '2026-08-24T00:00:00.000Z')); // due today

    const due = await repo.listDueMastery('user-1', '2026-08-25T00:00:00.000Z');
    expect(due.map((m) => m.structureId)).toEqual(['deltoid', 'trapezius']);
  });

  it('excludes mastery rows with no dueAt (never confidence-rated)', async () => {
    const repo = createMemoryRepository();
    await repo.upsertMastery({
      structureId: 'soleus',
      userId: 'user-1',
      attemptsTotal: 1,
      attemptsCorrect: 0,
      lastAttemptAt: '2026-08-20T00:00:00.000Z',
    });

    const due = await repo.listDueMastery('user-1', '2026-08-25T00:00:00.000Z');
    expect(due).toHaveLength(0);
  });

  it('scopes to the requesting user only', async () => {
    const repo = createMemoryRepository();
    await repo.upsertMastery(mastery('deltoid', '2026-08-10T00:00:00.000Z'));
    await repo.upsertMastery({ ...mastery('deltoid', '2026-08-10T00:00:00.000Z'), userId: 'user-2' });

    const due = await repo.listDueMastery('user-1', '2026-08-25T00:00:00.000Z');
    expect(due).toHaveLength(1);
    expect(due[0].userId).toBe('user-1');
  });
});

describe('memoryRepository getMasteryForStructure', () => {
  it('returns null before any upsertMastery for that structure', async () => {
    const repo = createMemoryRepository();
    expect(await repo.getMasteryForStructure('user-1', 'deltoid')).toBeNull();
  });

  it('returns the exact row after upsertMastery', async () => {
    const repo = createMemoryRepository();
    const row = mastery('deltoid', '2026-08-30T00:00:00.000Z');
    await repo.upsertMastery(row);

    expect(await repo.getMasteryForStructure('user-1', 'deltoid')).toEqual(row);
  });

  it('scopes per-user and per-structure, not leaking across either', async () => {
    const repo = createMemoryRepository();
    await repo.upsertMastery(mastery('deltoid', '2026-08-30T00:00:00.000Z'));
    await repo.upsertMastery({ ...mastery('deltoid', '2026-08-30T00:00:00.000Z'), userId: 'user-2' });
    await repo.upsertMastery(mastery('trapezius', '2026-08-30T00:00:00.000Z'));

    expect(await repo.getMasteryForStructure('user-1', 'soleus')).toBeNull();
    expect((await repo.getMasteryForStructure('user-2', 'deltoid'))?.userId).toBe('user-2');
    expect((await repo.getMasteryForStructure('user-1', 'trapezius'))?.structureId).toBe('trapezius');
  });
});

describe('memoryRepository recordAttempt/listAttempts', () => {
  it('listAttempts filters by userId across every attempt, newest first', async () => {
    const repo = createMemoryRepository();
    await repo.recordAttempt(attempt({ id: 'a1', userId: 'user-1', timestamp: '2026-08-20T00:00:00.000Z' }));
    await repo.recordAttempt(attempt({ id: 'a2', userId: 'user-2', timestamp: '2026-08-21T00:00:00.000Z' }));
    await repo.recordAttempt(attempt({ id: 'a3', userId: 'user-1', timestamp: '2026-08-22T00:00:00.000Z' }));

    const results = await repo.listAttempts({ userId: 'user-1' });
    expect(results.map((a) => a.id)).toEqual(['a3', 'a1']);
  });

  it('listAttempts filters by structureId, supporting cross-user analytics', async () => {
    const repo = createMemoryRepository();
    await repo.recordAttempt(attempt({ id: 'a1', userId: 'user-1', structureId: 'deltoid' }));
    await repo.recordAttempt(attempt({ id: 'a2', userId: 'user-2', structureId: 'deltoid' }));
    await repo.recordAttempt(attempt({ id: 'a3', userId: 'user-1', structureId: 'trapezius' }));

    const results = await repo.listAttempts({ structureId: 'deltoid' });
    expect(results.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('listAttempts respects questionId, since, and limit filters', async () => {
    const repo = createMemoryRepository();
    await repo.recordAttempt(attempt({ id: 'a1', questionId: 'q-1', timestamp: '2026-08-19T00:00:00.000Z' }));
    await repo.recordAttempt(attempt({ id: 'a2', questionId: 'q-1', timestamp: '2026-08-20T00:00:00.000Z' }));
    await repo.recordAttempt(attempt({ id: 'a3', questionId: 'q-2', timestamp: '2026-08-21T00:00:00.000Z' }));

    const byQuestion = await repo.listAttempts({ questionId: 'q-1' });
    expect(byQuestion.map((a) => a.id)).toEqual(['a2', 'a1']);

    const since = await repo.listAttempts({ since: '2026-08-20T00:00:00.000Z' });
    expect(since.map((a) => a.id).sort()).toEqual(['a2', 'a3']);

    const limited = await repo.listAttempts({ limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0].id).toBe('a3');
  });
});

describe('memoryRepository recordQuestionExposure', () => {
  it('returns 1 on first exposure and increments per (userId, questionId) pair', async () => {
    const repo = createMemoryRepository();

    expect(await repo.recordQuestionExposure('user-1', 'q-1')).toBe(1);
    expect(await repo.recordQuestionExposure('user-1', 'q-1')).toBe(2);
    expect(await repo.recordQuestionExposure('user-1', 'q-1')).toBe(3);
  });

  it('tracks exposure independently per user and per question', async () => {
    const repo = createMemoryRepository();

    expect(await repo.recordQuestionExposure('user-1', 'q-1')).toBe(1);
    expect(await repo.recordQuestionExposure('user-2', 'q-1')).toBe(1);
    expect(await repo.recordQuestionExposure('user-1', 'q-2')).toBe(1);
    expect(await repo.recordQuestionExposure('user-1', 'q-1')).toBe(2);
  });
});

describe('memoryRepository gamification profile', () => {
  it('returns the initial profile before any upsert', async () => {
    const repo = createMemoryRepository();
    expect(await repo.getGamificationProfile('user-1')).toEqual(INITIAL_GAMIFICATION_PROFILE);
  });

  it('returns the exact profile after upsert, scoped per user', async () => {
    const repo = createMemoryRepository();
    const profile = { ...INITIAL_GAMIFICATION_PROFILE, xpTotal: 150 };
    await repo.upsertGamificationProfile('user-1', profile);

    expect(await repo.getGamificationProfile('user-1')).toEqual(profile);
    expect(await repo.getGamificationProfile('user-2')).toEqual(INITIAL_GAMIFICATION_PROFILE);
  });
});

describe('memoryRepository achievements', () => {
  it('returns an empty list before any achievement is earned', async () => {
    const repo = createMemoryRepository();
    expect(await repo.listAchievements('user-1')).toEqual([]);
  });

  it('upserts by achievement id, scoped per user', async () => {
    const repo = createMemoryRepository();
    await repo.upsertAchievement('user-1', { id: 'record-longest-streak', earnedAt: '2026-08-20T00:00:00.000Z', value: 3 });
    await repo.upsertAchievement('user-1', { id: 'milestone-30-day-streak', earnedAt: '2026-08-21T00:00:00.000Z' });
    await repo.upsertAchievement('user-2', { id: 'record-longest-streak', earnedAt: '2026-08-22T00:00:00.000Z', value: 1 });

    const user1 = await repo.listAchievements('user-1');
    expect(user1).toHaveLength(2);

    await repo.upsertAchievement('user-1', { id: 'record-longest-streak', earnedAt: '2026-08-25T00:00:00.000Z', value: 6 });
    const updated = await repo.listAchievements('user-1');
    expect(updated).toHaveLength(2); // still 2 — the record was updated in place, not duplicated
    expect(updated.find((a) => a.id === 'record-longest-streak')?.value).toBe(6);

    expect(await repo.listAchievements('user-2')).toHaveLength(1);
  });
});
