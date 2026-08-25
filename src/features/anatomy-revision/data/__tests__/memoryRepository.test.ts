import { describe, it, expect } from 'vitest';
import { createMemoryRepository } from '../memoryRepository';
import type { StructureMastery } from '../../types/attempt';

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
