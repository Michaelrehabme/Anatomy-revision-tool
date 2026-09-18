import { describe, expect, it, beforeEach } from 'vitest';
import { createMemoryRepository } from '../memoryRepository';
import { DIAGNOSTIC_VERSION, pairDiagnostics, type DiagnosticResult } from '../../lib/diagnostic';

/**
 * Storage for a sitting, and the one property the sitting promises a student:
 * the score is theirs and their course leader does not see it.
 *
 * That promise is kept by firestore.rules (a cohort owner has no read on a
 * student's subcollections), not by this file. What this pins is the half the
 * repository owns — that results go under the STUDENT, and that a retake never
 * destroys the baseline a follow-up has to be measured from.
 */

function result(over: Partial<DiagnosticResult> & { userId: string; phase: 'baseline' | 'followUp' }): DiagnosticResult {
  return {
    cohortId: 'c1',
    version: DIAGNOSTIC_VERSION,
    correct: 6,
    total: 15,
    takenAt: '2026-10-01T09:00:00.000Z',
    ...over,
  };
}

let repo: ReturnType<typeof createMemoryRepository>;
beforeEach(() => { repo = createMemoryRepository(); });

describe('diagnostic storage', () => {
  it('stores and reads back a sitting for its own student', async () => {
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'baseline' }));
    const rows = await repo.listDiagnosticResults('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].correct).toBe(6);
  });

  it('never returns another student\'s sittings', async () => {
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'baseline' }));
    await repo.saveDiagnosticResult(result({ userId: 'u2', phase: 'baseline', correct: 14 }));
    expect(await repo.listDiagnosticResults('u1')).toHaveLength(1);
    expect((await repo.listDiagnosticResults('u2'))[0].correct).toBe(14);
  });

  it('keeps every sitting, so a retake cannot erase the first baseline', async () => {
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'baseline', correct: 4, takenAt: '2026-10-01T09:00:00.000Z' }));
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'baseline', correct: 11, takenAt: '2026-11-01T09:00:00.000Z' }));

    const rows = await repo.listDiagnosticResults('u1');
    expect(rows).toHaveLength(2);
    // pairDiagnostics measures from the EARLIEST baseline; it can only do that
    // if storing the second one did not overwrite the first.
    expect(rows[0].correct).toBe(4);
  });

  it('returns sittings oldest first, which is the order the pairing assumes', async () => {
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'followUp', takenAt: '2026-12-01T09:00:00.000Z' }));
    await repo.saveDiagnosticResult(result({ userId: 'u1', phase: 'baseline', takenAt: '2026-10-01T09:00:00.000Z' }));
    const rows = await repo.listDiagnosticResults('u1');
    expect(rows.map((r) => r.phase)).toEqual(['baseline', 'followUp']);
  });

  it('round-trips into a usable comparison', async () => {
    await repo.saveDiagnosticResult(result({
      userId: 'u1', phase: 'baseline', correct: 5, takenAt: '2026-10-01T09:00:00.000Z', questionIds: ['a', 'b'],
    }));
    await repo.saveDiagnosticResult(result({
      userId: 'u1', phase: 'followUp', correct: 12, takenAt: '2026-12-10T09:00:00.000Z', questionIds: ['b', 'a'],
    }));

    const [gain] = pairDiagnostics(await repo.listDiagnosticResults('u1'));
    expect(Math.round(gain.gainPoints)).toBe(47);
    expect(gain.daysBetween).toBe(70);
  });

  it('gives an empty list for a student who has never sat one', async () => {
    expect(await repo.listDiagnosticResults('nobody')).toEqual([]);
  });
});
