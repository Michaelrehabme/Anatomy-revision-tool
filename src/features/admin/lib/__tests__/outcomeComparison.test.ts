import { describe, expect, it } from 'vitest';
import {
  computeOutcomeComparison,
  summariseStudents,
  ENGAGED_SESSION_THRESHOLD,
  MIN_GROUP_SIZE,
  MIN_ATTEMPTS_FOR_TREND,
  MASTERY_STREAK,
} from '../outcomeComparison';
import type { UserAttempt } from '../../../anatomy-revision/types/attempt';

/**
 * The point of these is not that the arithmetic works. It is that the module
 * refuses to produce a quotable number when the data cannot support one — the
 * failure mode that matters, because the output of this file is intended to be
 * said out loud to a course leader.
 */

let seq = 0;

function attempt(over: Partial<UserAttempt> & { userId: string }): UserAttempt {
  seq += 1;
  return {
    id: `a-${seq}`,
    sessionId: `s-${seq}`,
    questionId: `q-${seq}`,
    questionType: 'mcq',
    structureId: 'biceps-brachii',
    promptKind: 'action',
    region: 'upper-limb',
    category: 'muscle',
    correct: true,
    timestamp: '2026-10-01T09:00:00.000Z',
    ...over,
  } as UserAttempt;
}

/**
 * `sessions` sessions of `perSession` answers, `correctRate` of them right.
 *
 * Correct answers are spread evenly rather than taken from a counter modulo
 * 100 — that gave any student with fewer than 100 attempts a perfect score,
 * which made the less-engaged group look BETTER and the fixture useless.
 * Bresenham's rule puts exactly round(total * rate) correct answers in, evenly
 * distributed, so a student's early and late thirds match their overall rate.
 */
function student(userId: string, sessions: number, perSession: number, correctRate: number): UserAttempt[] {
  const rows: UserAttempt[] = [];
  // Structures are drawn from a seeded LCG rather than `q % 7`. With a modular
  // structure and an evenly-spread correctness pattern the two periods alias:
  // each structure receives a strided sample that comes out degenerately all
  // right or all wrong, and the mastery gap went NEGATIVE on a fixture where
  // the engaged students were strictly better. Thirty structures and a
  // non-periodic draw reproduce a real term closely enough to test against.
  let lcg = [...userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const nextStructure = () => {
    lcg = (lcg * 1103515245 + 12345) >>> 0;
    return `structure-${lcg % 30}`;
  };

  let n = 0;
  for (let s = 0; s < sessions; s++) {
    for (let q = 0; q < perSession; q++) {
      const day = String(1 + (s % 28)).padStart(2, '0');
      rows.push(
        attempt({
          userId,
          sessionId: `${userId}-session-${s}`,
          structureId: nextStructure(),
          correct: Math.floor((n + 1) * correctRate) > Math.floor(n * correctRate),
          timestamp: `2026-10-${day}T09:${String(q % 60).padStart(2, '0')}:00.000Z`,
        }),
      );
      n += 1;
    }
  }
  return rows;
}

describe('summariseStudents', () => {
  it('counts sessions as distinct sessionIds, which is what makes a term derivable after the fact', () => {
    const rows = [
      attempt({ userId: 'u1', sessionId: 'a' }),
      attempt({ userId: 'u1', sessionId: 'a' }),
      attempt({ userId: 'u1', sessionId: 'b' }),
    ];
    expect(summariseStudents(rows)[0].sessions).toBe(2);
  });

  it('excludes learn cards from accuracy but not from the session count', () => {
    const rows = [
      attempt({ userId: 'u1', sessionId: 'a', correct: true }),
      attempt({ userId: 'u1', sessionId: 'a', correct: false }),
      // Ungraded: a card that was read, not a question that was failed.
      attempt({ userId: 'u1', sessionId: 'b', correct: false, graded: false }),
    ];
    const [s] = summariseStudents(rows);
    expect(s.gradedAttempts).toBe(2);
    expect(s.accuracyPct).toBe(50);
    expect(s.sessions).toBe(2);
  });

  it('orders by time before splitting a term, not by the order the query returned', () => {
    const rows = [
      attempt({ userId: 'u1', timestamp: '2026-12-01T09:00:00.000Z' }),
      attempt({ userId: 'u1', timestamp: '2026-10-01T09:00:00.000Z' }),
    ];
    const [s] = summariseStudents(rows);
    expect(s.firstActiveAt).toBe('2026-10-01T09:00:00.000Z');
    expect(s.lastActiveAt).toBe('2026-12-01T09:00:00.000Z');
  });

  it('gives no early-vs-late trend below the attempt floor, rather than a noisy one', () => {
    const few = student('u1', 2, 5, 0.5);
    expect(few.length).toBeLessThan(MIN_ATTEMPTS_FOR_TREND);
    expect(summariseStudents(few)[0].earlyAccuracyPct).toBeNull();
  });

  it('measures improvement within one student, each being their own control', () => {
    // 60 answers: all wrong to begin with, all right by the end.
    const rows: UserAttempt[] = [];
    for (let i = 0; i < 60; i++) {
      rows.push(
        attempt({
          userId: 'u1',
          sessionId: `s-${Math.floor(i / 10)}`,
          correct: i >= 40,
          timestamp: `2026-10-${String(1 + Math.floor(i / 3)).padStart(2, '0')}T09:00:00.000Z`,
        }),
      );
    }
    const [s] = summariseStudents(rows);
    expect(s.earlyAccuracyPct).toBe(0);
    expect(s.lateAccuracyPct).toBe(100);
  });
});

describe('structures mastered', () => {
  /** n graded attempts on one structure, with the given results in order. */
  function onStructure(userId: string, structureId: string, results: boolean[]): UserAttempt[] {
    return results.map((correct, i) =>
      attempt({
        userId,
        structureId,
        sessionId: `${userId}-s`,
        correct,
        timestamp: `2026-10-${String(1 + i).padStart(2, '0')}T09:00:00.000Z`,
      }),
    );
  }

  it('counts a structure once the last three graded answers are all right', () => {
    const rows = onStructure('u1', 'deltoid', [false, false, true, true, true]);
    expect(summariseStudents(rows)[0].structuresMastered).toBe(1);
  });

  it('does not count one that was learned and then missed again', () => {
    // The forgetting is the point: mastery is about where you are, not where you were.
    const rows = onStructure('u1', 'deltoid', [true, true, true, false]);
    expect(summariseStudents(rows)[0].structuresMastered).toBe(0);
  });

  it('needs the full streak, so two right answers is not mastery', () => {
    const rows = onStructure('u1', 'deltoid', [true, true]);
    expect(rows.length).toBeLessThan(MASTERY_STREAK);
    expect(summariseStudents(rows)[0].structuresMastered).toBe(0);
  });

  it('ignores ungraded cards when reading the streak', () => {
    const rows = [
      ...onStructure('u1', 'deltoid', [true, true, true]),
      attempt({ userId: 'u1', structureId: 'deltoid', correct: false, graded: false, timestamp: '2026-10-09T09:00:00.000Z' }),
    ];
    expect(summariseStudents(rows)[0].structuresMastered).toBe(1);
  });
});

describe('computeOutcomeComparison', () => {
  /** Ten engaged and ten less-engaged students, the engaged ones more accurate. */
  function cohort(): UserAttempt[] {
    const rows: UserAttempt[] = [];
    for (let i = 0; i < 10; i++) rows.push(...student(`keen-${i}`, ENGAGED_SESSION_THRESHOLD + 2, 12, 0.72));
    for (let i = 0; i < 10; i++) rows.push(...student(`light-${i}`, 3, 12, 0.58));
    return rows;
  }

  it('splits on the pre-registered threshold and reports the gap in percentage POINTS', () => {
    const out = computeOutcomeComparison(cohort());
    expect(out.threshold).toBe(ENGAGED_SESSION_THRESHOLD);
    expect(out.engaged.students).toBe(10);
    expect(out.lessEngaged.students).toBe(10);
    expect(out.reportable).toBe(true);
    // 72 against 58 is a 14-point gap, not a 24% one.
    expect(out.accuracyGapPoints).toBeGreaterThan(10);
    expect(out.accuracyGapPoints).toBeLessThan(18);
  });

  it('refuses to write the sentence when either group is too small to mean anything', () => {
    const rows = [...student('keen', ENGAGED_SESSION_THRESHOLD + 1, 12, 0.9), ...student('light', 2, 12, 0.5)];
    const out = computeOutcomeComparison(rows);

    expect(out.reportable).toBe(false);
    expect(out.sentence).toBeNull();
    // The numbers are still there for a caller who wants them; the endorsement is not.
    expect(out.accuracyGapPoints).not.toBeNull();
    expect(out.caveats[0]).toContain(`minimum of ${MIN_GROUP_SIZE}`);
  });

  it('says plainly that an in-app-only comparison is the weaker claim', () => {
    const out = computeOutcomeComparison(cohort());
    expect(out.sentence).toContain('mastered');
    expect(out.caveats.join(' ')).toContain('No external marks');
  });

  it('quotes structures mastered rather than the accuracy trend, which the scheduler confounds', () => {
    const out = computeOutcomeComparison(cohort());
    // Engaged students answer four times as much, so they clear the streak on
    // far more structures. The bound is a floor on the direction and rough size,
    // deliberately not pinned to the fixture's exact 4.1 — a test that asserts
    // one arithmetic result breaks on every harmless change to the fixture.
    expect(out.masteryGap).toBeGreaterThan(3);
    expect(out.sentence).toContain('more structures on average');
    expect(out.caveats.join(' ')).toContain('confounded by the scheduler');
  });

  it('prefers module marks over in-app accuracy once a pilot lead supplies them', () => {
    const rows = cohort();
    const marks = new Map<string, number>();
    for (let i = 0; i < 10; i++) marks.set(`keen-${i}`, 68 + (i % 3));
    for (let i = 0; i < 10; i++) marks.set(`light-${i}`, 59 + (i % 3));

    const out = computeOutcomeComparison(rows, { externalMarks: marks });
    expect(out.externalMarkGap).toBeGreaterThan(7);
    expect(out.sentence).toContain('marks higher on average');
    expect(out.engaged.studentsWithMark).toBe(10);
  });

  it('ignores external marks supplied for too few students rather than quoting a gap over three', () => {
    const marks = new Map<string, number>([
      ['keen-0', 70],
      ['keen-1', 71],
      ['light-0', 55],
    ]);
    const out = computeOutcomeComparison(cohort(), { externalMarks: marks });
    expect(out.externalMarkGap).toBeNull();
    // Falls back to the in-app claim rather than quoting a mark gap over three students.
    expect(out.sentence).toContain('more structures on average');
  });

  it('always carries the causation caveat, whatever the numbers say', () => {
    const out = computeOutcomeComparison(cohort());
    expect(out.caveats.join(' ')).toContain('Association, not causation');
    expect(out.caveats.join(' ')).toContain('fixed in git on 18 September 2026');
  });

  it('survives an empty term without throwing, which is the state it ships in', () => {
    const out = computeOutcomeComparison([]);
    expect(out.reportable).toBe(false);
    expect(out.sentence).toBeNull();
    expect(out.engaged.students).toBe(0);
    expect(out.accuracyGapPoints).toBeNull();
  });
});
