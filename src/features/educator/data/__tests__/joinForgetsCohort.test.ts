import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A student's answers are summed into their class on the student's own device,
 * and the device remembers which class that is for as long as the app is open.
 * It asks once, usually as the app starts. A student who then joins a class
 * was still remembered as being in none, so their first sitting reached no
 * class and the teacher saw a member with 0 attempts (first live class check,
 * 10 Oct 2026). Joining, accepting an invitation and leaving must each make
 * the device ask again.
 */

const store = vi.hoisted(() => ({
  user: { cohort: null as string | null, cohortJoinedAt: null as string | null },
  writes: [] as { path: string; data: Record<string, unknown> }[],
}));

vi.mock('../../../anatomy-revision/data/firebase', () => ({ getDb: () => ({}) }));

vi.mock('firebase/firestore', () => {
  const doc = (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') });
  return {
    doc,
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    query: (ref: unknown) => ref,
    where: () => ({}),
    limit: () => ({}),
    deleteField: () => '__delete__',
    serverTimestamp: () => '__now__',
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...values: unknown[]) => ({ __union: values }),
    getDoc: async (ref: { path: string }) =>
      ref.path.startsWith('users/')
        ? { exists: () => true, data: () => ({ ...store.user }) }
        : { exists: () => true, id: 'class-1', data: () => ({ name: 'Class', ownerUid: 'teacher', joinCode: 'ABC123' }) },
    getDocs: async () => ({
      empty: false,
      docs: [{ id: 'class-1', data: () => ({ name: 'Class', ownerUid: 'teacher', joinCode: 'ABC123' }) }],
    }),
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      store.writes.push({ path: ref.path, data });
      if (ref.path.startsWith('users/') && 'cohort' in data) store.user.cohort = data.cohort as string | null;
    },
    deleteDoc: async () => {},
  };
});

const { syncStudentRollup, forgetCachedCohort } = await import('../cohortRollups');
const { joinCohortByCode, leaveCohort } = await import('../cohortsRepository');
const { acceptInvite } = await import('../invitesRepository');

const load = async () => ({ mastery: [], summaries: [], facts: [] });
const db = {} as never;
const statsWrites = () => store.writes.filter((w) => w.path.startsWith('cohorts/') && w.path.includes('/studentStats/'));

beforeEach(() => {
  store.user = { cohort: null, cohortJoinedAt: null };
  store.writes = [];
});

describe('a class joined while the app is open', () => {
  it('is counted into from the next answer, without a reload', async () => {
    forgetCachedCohort('s1');
    // The app starts: the student is in no class, and the device remembers that.
    await syncStudentRollup(db, 's1', 'Sam', load);
    expect(statsWrites()).toHaveLength(0);

    await joinCohortByCode('s1', 'ABC123');
    await syncStudentRollup(db, 's1', 'Sam', load);
    expect(statsWrites().map((w) => w.path)).toEqual(['cohorts/class-1/studentStats/s1']);
  });

  it('is counted into after an invitation is accepted', async () => {
    forgetCachedCohort('s2');
    await syncStudentRollup(db, 's2', 'Sam', load);
    expect(statsWrites()).toHaveLength(0);

    await acceptInvite({ id: 'invite-1', cohortId: 'class-1' } as never, 's2');
    await syncStudentRollup(db, 's2', 'Sam', load);
    expect(statsWrites().map((w) => w.path)).toEqual(['cohorts/class-1/studentStats/s2']);
  });

  it('stops being counted into the moment the student leaves', async () => {
    forgetCachedCohort('s3');
    store.user.cohort = 'class-1';
    await syncStudentRollup(db, 's3', 'Sam', load);
    expect(statsWrites()).toHaveLength(1);

    await leaveCohort('s3');
    await syncStudentRollup(db, 's3', 'Sam', load);
    expect(statsWrites()).toHaveLength(1);
  });
});
