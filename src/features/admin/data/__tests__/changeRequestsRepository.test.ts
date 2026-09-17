import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The register must never render blank. A blank screen is the one answer that
 * cannot be acted on: it looks the same whether Firestore is empty, offline,
 * unconfigured, or refusing the read, and it names no cause. These pin the two
 * failure shapes that used to produce one.
 */

const getDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  setDoc: vi.fn(async () => undefined),
  getDocs: (...args: unknown[]) => getDocs(...args),
}));

vi.mock('../../../anatomy-revision/data/firebase', () => ({ getDb: vi.fn(() => ({})) }));

const { listChangeRequests } = await import('../changeRequestsRepository');
const { CHANGE_REQUESTS_SEED } = await import('../changeRequests.seed');

beforeEach(() => {
  getDocs.mockReset();
});

describe('listChangeRequests', () => {
  it('returns the whole git backlog when Firestore is empty — the never-seeded case', async () => {
    getDocs.mockResolvedValue({ docs: [] });

    const read = await listChangeRequests();
    expect(read.stateUnavailable).toBe(false);
    expect(read.items).toHaveLength(CHANGE_REQUESTS_SEED.length);
    expect(read.items.find((i) => i.ref === 'CR-033')?.checklist).toHaveLength(18);
  });

  it('still returns the backlog when the read throws, flagged so the screen can disable writing', async () => {
    getDocs.mockRejectedValue(new Error('Missing or insufficient permissions.'));

    const read = await listChangeRequests();
    expect(read.stateUnavailable).toBe(true);
    expect(read.stateError).toBe('Missing or insufficient permissions.');
    // The point of the fallback: a failed read costs the STATE, not the register.
    expect(read.items).toHaveLength(CHANGE_REQUESTS_SEED.length);
  });

  it('lays stored state over the git definitions when the read succeeds', async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            ref: 'CR-033',
            status: 'inProgress',
            notes: 'Started.',
            checklistDone: { 'ico-registration': '2026-09-14T00:00:00.000Z' },
          }),
        },
      ],
    });

    const read = await listChangeRequests();
    const cr33 = read.items.find((i) => i.ref === 'CR-033');
    expect(read.stateUnavailable).toBe(false);
    expect(cr33?.status).toBe('inProgress');
    expect(cr33?.checklistDone).toEqual({ 'ico-registration': '2026-09-14T00:00:00.000Z' });
    // Definition still from git, not from the partial stored document.
    expect(cr33?.checklist).toHaveLength(18);
    expect(cr33?.title).toBe('Launch readiness: the ranked pre-revenue checklist');
  });
});
