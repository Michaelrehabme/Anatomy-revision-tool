import { describe, expect, it } from 'vitest';
import {
  buildDiagnostic,
  sameQuestions,
  pairDiagnostics,
  summariseDiagnostics,
  scoreDiagnostic,
  DIAGNOSTIC_SIZE,
  DIAGNOSTIC_VERSION,
  MIN_PAIRED,
  type DiagnosticResult,
} from '../diagnostic';
import { ALL_STRUCTURES } from '../../data/seed';
import { buildDiagnosticQuestions, shuffleForSitting } from '../diagnostic';

/**
 * Two properties carry the whole design: the same cohort must get the same
 * twenty items months apart, and an unpaired sitting must never reach a mean.
 * Everything else is arithmetic.
 */

function result(over: Partial<DiagnosticResult> & { userId: string; phase: 'baseline' | 'followUp' }): DiagnosticResult {
  return {
    cohortId: 'c1',
    version: DIAGNOSTIC_VERSION,
    correct: 10,
    total: 20,
    takenAt: '2026-10-01T09:00:00.000Z',
    ...over,
  };
}

describe('buildDiagnostic', () => {
  it('draws the same items for a cohort every time it is asked', () => {
    const a = buildDiagnostic(ALL_STRUCTURES, 'cohort-abc');
    const b = buildDiagnostic(ALL_STRUCTURES, 'cohort-abc');
    // This is the property a follow-up months later depends on.
    expect(a.items.map((i) => i.structureId)).toEqual(b.items.map((i) => i.structureId));
  });

  it('draws a different set for a different cohort', () => {
    const a = buildDiagnostic(ALL_STRUCTURES, 'cohort-abc');
    const b = buildDiagnostic(ALL_STRUCTURES, 'cohort-xyz');
    expect(a.items.map((i) => i.structureId)).not.toEqual(b.items.map((i) => i.structureId));
  });

  it('asks for twenty distinct structures', () => {
    const spec = buildDiagnostic(ALL_STRUCTURES, 'cohort-abc');
    expect(spec.items).toHaveLength(DIAGNOSTIC_SIZE);
    expect(new Set(spec.items.map((i) => i.structureId)).size).toBe(DIAGNOSTIC_SIZE);
  });

  it('spreads across areas rather than measuring one region by luck', () => {
    const spec = buildDiagnostic(ALL_STRUCTURES, 'cohort-abc');
    // Nine areas exist; twenty items round-robin should touch most of them.
    expect(new Set(spec.items.map((i) => i.area)).size).toBeGreaterThanOrEqual(7);
  });

  it('stamps the version, because a follow-up under different rules is not a follow-up', () => {
    expect(buildDiagnostic(ALL_STRUCTURES, 'c1').version).toBe(DIAGNOSTIC_VERSION);
  });
});

describe('scoreDiagnostic', () => {
  it('counts correct answers', () => {
    expect(scoreDiagnostic([true, false, true])).toEqual({ correct: 2, total: 3 });
  });
});

describe('pairDiagnostics', () => {
  it('pairs a student\'s baseline with their follow-up and reports points, not a ratio', () => {
    const [gain] = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', correct: 8, total: 20, takenAt: '2026-10-01T09:00:00.000Z' }),
      result({ userId: 'u1', phase: 'followUp', correct: 14, total: 20, takenAt: '2026-12-10T09:00:00.000Z' }),
    ]);
    expect(gain.baselinePct).toBe(40);
    expect(gain.followUpPct).toBe(70);
    // 40 to 70 is thirty POINTS, not a 75% improvement.
    expect(gain.gainPoints).toBe(30);
    expect(gain.daysBetween).toBe(70);
  });

  it('drops a student who only ever took one of the two', () => {
    const gains = pairDiagnostics([
      result({ userId: 'only-before', phase: 'baseline' }),
      result({ userId: 'only-after', phase: 'followUp', correct: 19 }),
    ]);
    // Counting either would bias the mean by exactly who dropped out.
    expect(gains).toEqual([]);
  });

  it('refuses to pair a follow-up that asked different questions', () => {
    const gains = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', questionIds: ['q-a', 'q-b', 'q-c'] }),
      result({ userId: 'u1', phase: 'followUp', correct: 18, questionIds: ['q-a', 'q-b', 'q-z'] }),
    ]);
    // Same structures can still mean different questions; that is not a follow-up.
    expect(gains).toEqual([]);
  });

  it('ignores the order questions were asked in, since the sitting shuffles it', () => {
    const [gain] = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', correct: 6, questionIds: ['q-a', 'q-b', 'q-c'] }),
      result({ userId: 'u1', phase: 'followUp', correct: 12, questionIds: ['q-c', 'q-a', 'q-b'] }),
    ]);
    expect(gain).toBeDefined();
    expect(gain.gainPoints).toBe(30);
  });

  it('still pairs older sittings that never recorded their questions', () => {
    const [gain] = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', correct: 6 }),
      result({ userId: 'u1', phase: 'followUp', correct: 12 }),
    ]);
    // Unknown is not a mismatch — refusing would silently discard real data.
    expect(gain).toBeDefined();
  });

  it('refuses to pair sittings built under different rules', () => {
    const gains = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', version: 1 }),
      result({ userId: 'u1', phase: 'followUp', version: 2, correct: 18 }),
    ]);
    expect(gains).toEqual([]);
  });

  it('measures from the first baseline when a student sat it twice', () => {
    const [gain] = pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', correct: 4, takenAt: '2026-10-01T09:00:00.000Z' }),
      result({ userId: 'u1', phase: 'baseline', correct: 12, takenAt: '2026-11-01T09:00:00.000Z' }),
      result({ userId: 'u1', phase: 'followUp', correct: 16, takenAt: '2026-12-01T09:00:00.000Z' }),
    ]);
    expect(gain.baselinePct).toBe(20);
  });
});

describe('sameQuestions', () => {
  const base = result({ userId: 'u1', phase: 'baseline', questionIds: ['a', 'b'] });

  it('accepts the same set in a different order', () => {
    expect(sameQuestions(base, result({ userId: 'u1', phase: 'followUp', questionIds: ['b', 'a'] }))).toBe(true);
  });

  it('rejects a different set', () => {
    expect(sameQuestions(base, result({ userId: 'u1', phase: 'followUp', questionIds: ['a', 'c'] }))).toBe(false);
  });

  it('rejects a follow-up of a different length', () => {
    expect(sameQuestions(base, result({ userId: 'u1', phase: 'followUp', questionIds: ['a'] }))).toBe(false);
  });

  it('treats an unrecorded sitting as unknown, not as a mismatch', () => {
    expect(sameQuestions(base, result({ userId: 'u1', phase: 'followUp' }))).toBe(true);
  });
});

describe('summariseDiagnostics', () => {
  function cohort(n: number, before: number, after: number): DiagnosticResult[] {
    const rows: DiagnosticResult[] = [];
    for (let i = 0; i < n; i++) {
      rows.push(result({ userId: `u${i}`, phase: 'baseline', correct: before, takenAt: '2026-10-01T09:00:00.000Z' }));
      rows.push(result({ userId: `u${i}`, phase: 'followUp', correct: after, takenAt: '2026-12-01T09:00:00.000Z' }));
    }
    return rows;
  }

  it('reports the mean movement across a whole class', () => {
    const out = summariseDiagnostics(cohort(12, 8, 14));
    expect(out.paired).toBe(12);
    expect(out.meanBaselinePct).toBe(40);
    expect(out.meanFollowUpPct).toBe(70);
    expect(out.meanGainPoints).toBe(30);
    expect(out.improvedPct).toBe(100);
    expect(out.reportable).toBe(true);
  });

  it('will not call a handful of students reportable', () => {
    const out = summariseDiagnostics(cohort(MIN_PAIRED - 1, 8, 14));
    expect(out.reportable).toBe(false);
    // The figures are still there for anyone who wants them; the endorsement is not.
    expect(out.meanGainPoints).toBe(30);
  });

  it('survives a cohort where nobody sat the follow-up', () => {
    const out = summariseDiagnostics(cohort(10, 8, 14).filter((r) => r.phase === 'baseline'));
    expect(out.paired).toBe(0);
    expect(out.meanGainPoints).toBeNull();
    expect(out.reportable).toBe(false);
  });
});

describe('buildDiagnosticQuestions', () => {
  const spec = { cohortId: 'c1', version: DIAGNOSTIC_VERSION, items: [
    { structureId: 's1', area: 'shoulder' as const, category: 'muscle' as const },
    { structureId: 's2', area: 'hip' as const, category: 'muscle' as const },
  ] };

  const pool = [
    { id: 'q1a', structureId: 's1', promptKind: 'nerve', choices: ['a', 'b', 'c', 'd'] },
    { id: 'q1b', structureId: 's1', promptKind: 'identify', choices: ['a', 'b', 'c', 'd'] },
    { id: 'q2a', structureId: 's2', promptKind: 'nerve', choices: ['a', 'b', 'c', 'd'] },
    { id: 'q2b', structureId: 's2', promptKind: 'origin', choices: ['a', 'b', 'c', 'd'] },
    { id: 'qX', structureId: 'not-wanted', promptKind: 'nerve', choices: ['a', 'b', 'c', 'd'] },
  ];

  it('picks one question per item and ignores the rest of the dataset', () => {
    const out = buildDiagnosticQuestions(spec, pool);
    expect(out).toHaveLength(2);
    expect(out.map((q) => q.structureId)).toEqual(['s1', 's2']);
  });

  it('spreads prompt kinds rather than asking the same thing every time', () => {
    const kinds = buildDiagnosticQuestions(spec, pool).map((q) => q.promptKind);
    expect(new Set(kinds).size).toBe(2);
  });

  it('drops a question with too few choices to be fair', () => {
    const thin = [{ id: 'q1c', structureId: 's1', promptKind: 'nerve', choices: ['only'] }];
    expect(buildDiagnosticQuestions(spec, thin)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(buildDiagnosticQuestions(spec, pool).map((q) => q.id))
      .toEqual(buildDiagnosticQuestions(spec, pool).map((q) => q.id));
  });

  it('replays exactly what a baseline asked, in that order', () => {
    const out = buildDiagnosticQuestions(spec, pool, ['q2b', 'q1a']);
    expect(out.map((q) => q.id)).toEqual(['q2b', 'q1a']);
  });

  it('skips a replayed question the dataset no longer has, rather than throwing', () => {
    const out = buildDiagnosticQuestions(spec, pool, ['q1a', 'gone']);
    expect(out.map((q) => q.id)).toEqual(['q1a']);
  });
});

describe('shuffleForSitting', () => {
  it('keeps every item', () => {
    const out = shuffleForSitting([1, 2, 3, 4, 5], () => 0.5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate its input', () => {
    const input = [1, 2, 3];
    shuffleForSitting(input, () => 0.9);
    expect(input).toEqual([1, 2, 3]);
  });
});
