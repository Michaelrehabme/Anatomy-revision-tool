import { describe, it, expect } from 'vitest';
import { buildReviewQueue, relativeDue, reviewItemsInArea, soonestDueByStructure, spreadReviewItems } from '../reviewQueue';
import type { FactMastery, StructureMastery } from '../../types/attempt';
import type { AnatomyStructure } from '../../types/structure';

const NOW = new Date('2026-10-02T09:00:00.000Z');
const DAY = 86_400_000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

function naming(structureId: string, o: Partial<StructureMastery>): StructureMastery {
  return { structureId, userId: 'u', attemptsTotal: 6, attemptsCorrect: 6, lastAttemptAt: NOW.toISOString(), ...o };
}
function fact(structureId: string, promptKind: FactMastery['promptKind'], o: Partial<FactMastery>): FactMastery {
  return {
    userId: 'u', structureId, promptKind, attemptsTotal: 4, attemptsCorrect: 3, streak: 1, missStreak: 0,
    lastCorrect: true, lastAttemptAt: NOW.toISOString(), typed: true, bare: false, ...o,
  };
}

const ELIGIBLE = new Set(['deltoid', 'supraspinatus', 'teres-minor']);

describe('buildReviewQueue', () => {
  it('keeps naming and each fact apart, so a known name waits while a shaky origin is due', () => {
    const { due, forward } = buildReviewQueue(
      [naming('deltoid', { dueAt: inDays(10), intervalDays: 10, recentAccuracy: 1 })],
      [fact('deltoid', 'origin', { dueAt: inDays(-1), intervalDays: 1 })],
      ELIGIBLE,
      NOW,
    );
    expect(due).toEqual([expect.objectContaining({ structureId: 'deltoid', kind: 'origin', due: true })]);
    expect(forward).toEqual([]);
  });

  it('moves forward only weak types once the due ones run out', () => {
    const { due, forward } = buildReviewQueue(
      [
        naming('deltoid', { dueAt: inDays(10), intervalDays: 10, recentAccuracy: 1 }),
        naming('supraspinatus', { dueAt: inDays(1), intervalDays: 1, recentAccuracy: 0.6 }),
        naming('teres-minor', { dueAt: inDays(3), intervalDays: 4, recentAccuracy: 0.9 }),
      ],
      [],
      ELIGIBLE,
      NOW,
    );
    expect(due).toEqual([]);
    expect(forward.map((i) => i.structureId)).toEqual(['supraspinatus', 'teres-minor']);
  });

  it('leaves out structures the account cannot reach', () => {
    const { due } = buildReviewQueue([naming('biceps-brachii', { dueAt: inDays(-2), intervalDays: 1 })], [], ELIGIBLE, NOW);
    expect(due).toEqual([]);
  });
});

describe('spreadReviewItems (New set)', () => {
  const ago = (n: number) => inDays(-n);

  it('puts the structure answered longest ago first, so one asked today goes to the back', () => {
    const mastery = [
      naming('deltoid', { dueAt: ago(9), intervalDays: 1, lastAttemptAt: ago(10) }),
      naming('supraspinatus', { dueAt: ago(2), intervalDays: 1, lastAttemptAt: ago(20) }),
    ];
    // The deltoid's origin was answered today: the deltoid as a whole is recent.
    const facts = [
      fact('deltoid', 'origin', { dueAt: inDays(4), intervalDays: 4, lastAttemptAt: NOW.toISOString() }),
      fact('deltoid', 'insertion', { dueAt: ago(8), intervalDays: 1, lastAttemptAt: ago(9) }),
    ];
    const { due, forward } = buildReviewQueue(mastery, facts, ELIGIBLE, NOW);
    expect(due[0].structureId).toBe('deltoid'); // oldest-first: Keep going stays on it
    const spread = spreadReviewItems([...due, ...forward], mastery, facts);
    expect(spread[0].structureId).toBe('supraspinatus');
    expect(spread.map((i) => i.due)).toEqual([true, true, true, false]); // due still before pulled-forward
    expect(spread).toHaveLength(due.length + forward.length);
  });
});

describe('soonestDueByStructure', () => {
  it('takes the earliest of the name and every fact', () => {
    const soonest = soonestDueByStructure(
      [naming('deltoid', { dueAt: inDays(10) }), naming('supraspinatus', { dueAt: inDays(2) })],
      [fact('deltoid', 'origin', { dueAt: inDays(-1) }), fact('supraspinatus', 'insertion', { dueAt: inDays(6) })],
    );
    expect(soonest.get('deltoid')).toBe(inDays(-1));
    expect(soonest.get('supraspinatus')).toBe(inDays(2));
  });

  it('has nothing for a structure never answered', () => {
    // A flashcard-only row carries no date worth showing, and a fact row with
    // no answers is not in the queue either.
    const soonest = soonestDueByStructure(
      [naming('deltoid', { attemptsTotal: 0, attemptsCorrect: 0, dueAt: inDays(1) }), naming('teres-minor', {})],
      [fact('supraspinatus', 'origin', { attemptsTotal: 0, attemptsCorrect: 0, dueAt: inDays(1) })],
    );
    expect([...soonest.keys()]).toEqual([]);
  });

  it('dates a fact row written before facts were scheduled', () => {
    // No dueAt of its own: factDueAt works one out from the last answer, the
    // same date the queue uses.
    const soonest = soonestDueByStructure([], [fact('deltoid', 'origin', { lastAttemptAt: inDays(-3) })]);
    const { due, forward } = buildReviewQueue([], [fact('deltoid', 'origin', { lastAttemptAt: inDays(-3) })], ELIGIBLE, NOW);
    expect(soonest.get('deltoid')).toBe([...due, ...forward][0].dueAt);
  });
});

describe('relativeDue', () => {
  it('reads overdue as today, then tomorrow, then a count of days', () => {
    expect(relativeDue(inDays(-5), NOW)).toBe('today');
    expect(relativeDue(inDays(0), NOW)).toBe('today');
    expect(relativeDue(inDays(1), NOW)).toBe('tomorrow');
    expect(relativeDue(inDays(6), NOW)).toBe('in 6 days');
  });
});

describe('reviewItemsInArea', () => {
  const structuresById = new Map(
    [
      { id: 'deltoid', areas: ['shoulder'] },
      { id: 'sartorius', areas: ['hip', 'knee'] },
    ].map((s) => [s.id, s as unknown as AnatomyStructure]),
  );
  const item = (structureId: string) => ({ structureId, kind: 'identify' as const, dueAt: inDays(-1), due: true });

  it('keeps the queue order and only the area asked for', () => {
    const items = [item('sartorius'), item('deltoid'), item('sartorius')];
    expect(reviewItemsInArea(items, 'knee', structuresById).map((i) => i.structureId)).toEqual(['sartorius', 'sartorius']);
    expect(reviewItemsInArea(items, 'shoulder', structuresById).map((i) => i.structureId)).toEqual(['deltoid']);
  });

  it('drops an item whose structure is not loaded rather than guess its area', () => {
    expect(reviewItemsInArea([item('unknown')], 'knee', structuresById)).toEqual([]);
  });
});
