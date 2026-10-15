import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactMastery, StructureMastery } from '../../types/attempt';

/**
 * A student's progress is read from Firestore once per visit (15 October
 * 2026; firestoreRepository.ts says why). Firestore is replaced by an
 * in-memory store that counts the documents each read returns, which is what
 * Firestore bills.
 */

const store = vi.hoisted(() => ({
  docs: new Map<string, Map<string, Record<string, unknown>>>(),
  billed: 0,
  failNext: false,
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDocs: async (ref: { path: string }) => {
    if (store.failNext) {
      store.failNext = false;
      throw new Error('offline');
    }
    const rows = [...(store.docs.get(ref.path) ?? new Map()).entries()];
    store.billed += rows.length;
    return { docs: rows.map(([id, data]) => ({ id, data: () => data })) };
  },
  getDoc: async (ref: { path: string }) => {
    const parts = ref.path.split('/');
    const id = parts.pop()!;
    const data = store.docs.get(parts.join('/'))?.get(id);
    store.billed += 1;
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    const parts = ref.path.split('/');
    const id = parts.pop()!;
    const col = parts.join('/');
    if (!store.docs.has(col)) store.docs.set(col, new Map());
    store.docs.get(col)!.set(id, data);
  },
  query: (ref: unknown) => ref,
  where: () => undefined,
  orderBy: () => undefined,
  limit: () => undefined,
  runTransaction: vi.fn(),
  serverTimestamp: () => 'now',
  increment: (n: number) => n,
  writeBatch: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('../firebase', () => ({ getDb: () => ({}), getFirebaseAuth: () => ({ currentUser: null }) }));
vi.mock('../../../educator/data/cohortRollups', () => ({ rollUpAttemptDetached: vi.fn(), syncStudentRollup: vi.fn() }));

const { createFirestoreRepository } = await import('../firestoreRepository');

const mastery = (structureId: string, dueAt?: string): StructureMastery =>
  ({ userId: 'sam', structureId, correctCount: 1, attemptCount: 1, ...(dueAt ? { dueAt } : {}) }) as unknown as StructureMastery;
const fact = (structureId: string): FactMastery =>
  ({ userId: 'sam', structureId, promptKind: 'origin', streak: 1 }) as unknown as FactMastery;

beforeEach(() => {
  store.docs.clear();
  store.billed = 0;
  store.docs.set('users/sam/mastery', new Map([
    ['deltoid', mastery('deltoid', '2026-10-10T00:00:00.000Z')],
    ['biceps-brachii', mastery('biceps-brachii', '2026-10-20T00:00:00.000Z')],
    ['acl', mastery('acl')],
  ] as unknown as [string, Record<string, unknown>][]));
  store.docs.set('users/sam/factMastery', new Map([['deltoid__origin', fact('deltoid')]] as unknown as [string, Record<string, unknown>][]));
});

describe('a student\'s progress, read once a visit', () => {
  it('is billed once however many screens ask for it', async () => {
    const repo = await createFirestoreRepository();
    await repo.listMastery('sam');
    await repo.listMastery('sam');
    await repo.getMastery('sam');
    await repo.listFactMastery('sam');
    await repo.listFactMastery('sam');
    expect(store.billed).toBe(3 + 1);
  });

  it('answers what is due, and one structure, from the copy once it is held', async () => {
    const repo = await createFirestoreRepository();
    await repo.listMastery('sam');
    const billed = store.billed;
    const due = await repo.listDueMastery('sam', '2026-10-15T00:00:00.000Z');
    expect(due.map((m) => m.structureId)).toEqual(['deltoid']);
    expect((await repo.getMasteryForStructure('sam', 'biceps-brachii'))?.structureId).toBe('biceps-brachii');
    expect(store.billed).toBe(billed);
  });

  it('keeps the copy up to date with what the student answers', async () => {
    const repo = await createFirestoreRepository();
    await repo.listMastery('sam');
    await repo.listFactMastery('sam');
    await repo.upsertMastery(mastery('gastrocnemius', '2026-10-01T00:00:00.000Z'));
    await repo.upsertFactMastery(fact('gastrocnemius'));
    expect((await repo.listMastery('sam')).map((m) => m.structureId)).toContain('gastrocnemius');
    expect((await repo.listFactMastery('sam')).map((f) => f.structureId)).toContain('gastrocnemius');
    expect((await repo.listDueMastery('sam', '2026-10-15T00:00:00.000Z')).map((m) => m.structureId)).toEqual(['gastrocnemius', 'deltoid']);
    // And the write reached the database, not only the copy.
    expect(store.docs.get('users/sam/mastery')!.has('gastrocnemius')).toBe(true);
  });

  it('tries again after a read that failed, instead of keeping the failure', async () => {
    const repo = await createFirestoreRepository();
    store.failNext = true;
    await expect(repo.listMastery('sam')).rejects.toThrow('offline');
    expect(await repo.listMastery('sam')).toHaveLength(3);
  });

  it('reads the past sessions once for every list length a screen asks for', async () => {
    const sessions = Array.from({ length: 5 }, (_, i) => [`s${i}`, { id: `s${i}`, userId: 'sam', startedAt: `2026-10-0${i + 1}T09:00:00.000Z` }]);
    store.docs.set('users/sam/sessions', new Map(sessions as unknown as [string, Record<string, unknown>][]));
    const repo = await createFirestoreRepository();
    await repo.listSessionSummaries('sam', 60);
    const billed = store.billed;
    await repo.listSessionSummaries('sam', 400);
    await repo.listSessionSummaries('sam', 2);
    expect(store.billed).toBe(billed);
    // A session just finished is at the front of the list, without a read.
    await repo.saveSessionSummary({ id: 's9', userId: 'sam', startedAt: '2026-10-09T09:00:00.000Z' } as never);
    expect((await repo.listSessionSummaries('sam', 2)).map((r) => r.id)).toEqual(['s9', 's4']);
    expect(store.billed).toBe(billed);
  });

  it('keeps each student separate', async () => {
    const repo = await createFirestoreRepository();
    store.docs.set('users/cam/mastery', new Map([['deltoid', { ...mastery('deltoid'), userId: 'cam' }]] as unknown as [string, Record<string, unknown>][]));
    expect(await repo.listMastery('sam')).toHaveLength(3);
    expect(await repo.listMastery('cam')).toHaveLength(1);
  });
});
