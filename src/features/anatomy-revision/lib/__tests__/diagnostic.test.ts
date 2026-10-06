import { describe, expect, it } from 'vitest';
import {
  buildDiagnostic,
  sameQuestions,
  pairDiagnostics,
  summariseDiagnostics,
  summariseDiagnosticsByPaper,
  paperKey,
  scoreDiagnostic,
  DIAGNOSTIC_SIZE,
  DIAGNOSTIC_VERSION,
  COHORT_DRAWN_VERSION,
  MIN_PAIRED,
  type DiagnosticResult,
} from '../diagnostic';
import { ALL_STRUCTURES } from '../../data/seed';
import { buildDiagnosticQuestions, shuffleForSitting } from '../diagnostic';
import { diagnosticReportLines, whoSatWhat } from '../diagnosticReport';

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

  it('stamps the version it draws for, which is no longer the current one', () => {
    expect(buildDiagnostic(ALL_STRUCTURES, 'c1').version).toBe(COHORT_DRAWN_VERSION);
    expect(COHORT_DRAWN_VERSION).toBe(1);
    expect(DIAGNOSTIC_VERSION).toBeGreaterThan(COHORT_DRAWN_VERSION);
  });

  // Baselines sat under version 1 are still open, and one that recorded no
  // question ids is followed up by drawing its class's paper again. The draw
  // was seeded with the version, so bumping the version must not move it:
  // this is the paper 'cohort-a' drew while version 1 was live.
  it('still draws a class the paper it drew under version 1', () => {
    expect(buildDiagnostic(ALL_STRUCTURES, 'cohort-a').items.map((i) => i.structureId)).toEqual([
      'vastus-intermedius', 'anconeus', 'internal-intercostals', 'multifidus', 'scalene-posterior',
      'flexor-digitorum-longus', 'trapezius', 'adductor-magnus', 'lumbricals-hand', 'popliteus',
      'biceps-brachii', 'external-intercostals', 'internal-oblique', 'rotatores', 'flexor-digitorum-brevis',
    ]);
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

/**
 * A class can sit more than one paper: members with every area sit the
 * whole-body paper, members on free accounts sit their free area's. Two
 * papers are two tests, and no figure may run across them.
 */
describe('papers are never mixed', () => {
  function group(paperId: string | undefined, n: number, before: number, after: number | null, version = DIAGNOSTIC_VERSION) {
    const rows: DiagnosticResult[] = [];
    for (let i = 0; i < n; i++) {
      const userId = `${paperId ?? 'v1'}-${i}`;
      rows.push(result({ userId, phase: 'baseline', version, paperId, correct: before, total: 15, takenAt: '2026-10-01T09:00:00.000Z' }));
      if (after !== null) {
        rows.push(result({ userId, phase: 'followUp', version, paperId, correct: after, total: 15, takenAt: '2026-12-15T09:00:00.000Z' }));
      }
    }
    return rows;
  }

  it('does not pair a knee baseline with a whole-body follow-up', () => {
    expect(pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', paperId: 'knee' }),
      result({ userId: 'u1', phase: 'followUp', paperId: 'whole-body', correct: 18 }),
    ])).toEqual([]);
  });

  it('pairs two sittings of the same paper', () => {
    expect(pairDiagnostics([
      result({ userId: 'u1', phase: 'baseline', paperId: 'knee', correct: 5 }),
      result({ userId: 'u1', phase: 'followUp', paperId: 'knee', correct: 15 }),
    ])).toHaveLength(1);
  });

  it('gives each paper its own figures, the most-sat first', () => {
    const papers = summariseDiagnosticsByPaper([...group('knee', 2, 3, 9), ...group('whole-body', 3, 6, 12)]);
    expect(papers.map((p) => [p.paperId, p.baselines, p.paired])).toEqual([['whole-body', 3, 3], ['knee', 2, 2]]);
    expect(papers[0].meanBaselinePct).toBe(40);
    expect(papers[0].meanFollowUpPct).toBe(80);
    expect(papers[1].meanBaselinePct).toBe(20);
    expect(papers[1].meanFollowUpPct).toBe(60);
    // Nothing in the answer is an average over both.
    expect(JSON.stringify(papers)).not.toContain('32');
  });

  it('asks the floor of each paper on its own: ten students on two papers are not ten', () => {
    const papers = summariseDiagnosticsByPaper([...group('knee', 5, 3, 9), ...group('whole-body', 5, 6, 12)]);
    expect(papers.map((p) => p.paired)).toEqual([5, 5]);
    expect(papers.map((p) => p.reportable)).toEqual([false, false]);
    // …though together they would have cleared it.
    expect(5 + 5).toBeGreaterThanOrEqual(MIN_PAIRED);
  });

  it('calls a paper reportable when enough students sat THAT paper twice', () => {
    const papers = summariseDiagnosticsByPaper([...group('whole-body', MIN_PAIRED, 6, 12), ...group('knee', 2, 3, 9)]);
    expect(papers.find((p) => p.paperId === 'whole-body')!.reportable).toBe(true);
    expect(papers.find((p) => p.paperId === 'knee')!.reportable).toBe(false);
  });

  it('counts a student whose follow-up was on another paper as sat-both-but-not-counted', () => {
    const rows = [
      ...group('knee', 2, 3, 9),
      result({ userId: 'x', phase: 'baseline', paperId: 'knee', correct: 3, total: 15 }),
      result({ userId: 'x', phase: 'followUp', paperId: 'whole-body', correct: 9, total: 15, takenAt: '2026-12-15T09:00:00.000Z' }),
    ];
    const [knee] = summariseDiagnosticsByPaper(rows);
    expect([knee.baselines, knee.paired, knee.unpairable]).toEqual([3, 2, 1]);
  });

  it("keeps a class's own version-1 paper apart from the written ones", () => {
    const papers = summariseDiagnosticsByPaper([
      ...group(undefined, 3, 6, 12, COHORT_DRAWN_VERSION),
      ...group('whole-body', 2, 6, 12),
    ]);
    expect(papers.map((p) => [p.version, p.paperId, p.baselines])).toEqual([
      [COHORT_DRAWN_VERSION, undefined, 3],
      [DIAGNOSTIC_VERSION, 'whole-body', 2],
    ]);
  });

  it('gives one key to a paper and different keys to different papers', () => {
    expect(paperKey({ version: 3, paperId: 'knee' })).toBe(paperKey({ version: 3, paperId: 'knee' }));
    expect(paperKey({ version: 3, paperId: 'knee' })).not.toBe(paperKey({ version: 3, paperId: 'hip' }));
    expect(paperKey({ version: 3, paperId: 'knee' })).not.toBe(paperKey({ version: 4, paperId: 'knee' }));
  });

  describe('the report', () => {
    it('says who sat what, in a sentence', () => {
      const papers = summariseDiagnosticsByPaper([...group('knee', 2, 3, null), ...group('whole-body', 3, 6, null)]);
      expect(whoSatWhat(papers)).toBe('3 students sat the whole-body paper, 2 sat the knee paper.');
    });

    it('reports each paper on its own and no figure for the class', () => {
      const lines = diagnosticReportLines([...group('knee', 2, 3, 9), ...group('whole-body', 3, 6, 12)]);
      expect(lines[0]).toBe('3 students sat the whole-body paper, 2 sat the knee paper.');
      expect(lines[1]).toContain('different tests');
      const text = lines.join('\n');
      expect(text).toContain('The whole-body paper');
      expect(text).toContain('Mean before / after       40% → 80%  (+40 points)');
      expect(text).toContain('The knee paper');
      expect(text).toContain('Mean before / after       20% → 60%  (+40 points)');
      // Five baselines in the class; the only counts printed are per paper.
      expect(text).not.toMatch(/Sat the baseline\s+5/);
      // Neither paper has enough pairs, and each says so for itself.
      expect(text.match(/NOT QUOTABLE: under 8 students sat this paper twice/g)).toHaveLength(2);
    });

    it('says one student in the singular, and nothing about different tests for one paper', () => {
      const lines = diagnosticReportLines(group('hip', 1, 3, null));
      expect(lines[0]).toBe('1 student sat the hip paper.');
      expect(lines.join('\n')).not.toContain('different tests');
      expect(lines.join('\n')).toContain('none yet');
    });

    it('names a version-1 paper for what it was', () => {
      expect(diagnosticReportLines(group(undefined, 2, 6, 12, COHORT_DRAWN_VERSION))[0])
        .toBe("2 students sat the class's own paper (version 1).");
    });

    it('says so when nobody has sat one', () => {
      expect(diagnosticReportLines([])).toEqual(['Nobody has sat one yet.']);
    });
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
