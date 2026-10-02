import { describe, it, expect } from 'vitest';
import { buildReviewQueue } from '../reviewQueue';
import type { FactMastery, StructureMastery } from '../../types/attempt';

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
