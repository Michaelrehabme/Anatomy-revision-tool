import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProgressData } from '../useProgressData';
import { createMemoryRepository } from '../../data/memoryRepository';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { CATEGORIES, isBone, isLigament, isMuscle } from '../../types/structure';
import type { StructureMastery } from '../../types/attempt';
import type { AnatomyContent } from '../useAnatomyContent';

const content: AnatomyContent = {
  structures: ALL_STRUCTURES,
  images: ALL_IMAGES,
  structuresById: new Map(ALL_STRUCTURES.map((s) => [s.id, s])),
  imagesById: new Map(ALL_IMAGES.map((i) => [i.id, i])),
  loading: false,
  error: null,
  retry: () => {},
};

function row(structureId: string, correct: number, total: number): StructureMastery {
  return {
    structureId,
    userId: 'user-1',
    attemptsTotal: total,
    attemptsCorrect: correct,
    lastAttemptAt: '2026-09-20T09:00:00.000Z',
  };
}

describe('useProgressData coverage', () => {
  it('counts seen structures of every kind, not only muscles', async () => {
    const repository = createMemoryRepository();
    const muscle = ALL_STRUCTURES.find(isMuscle)!;
    const bone = ALL_STRUCTURES.find(isBone)!;
    const ligament = ALL_STRUCTURES.find(isLigament)!;
    await repository.upsertMastery(row(muscle.id, 3, 4));
    await repository.upsertMastery(row(bone.id, 1, 1));
    await repository.upsertMastery(row(ligament.id, 0, 2)); // seen, never right

    const { result } = renderHook(() => useProgressData(repository, 'user-1', content));
    await waitFor(() => expect(result.current.totalSeen).toBe(3));

    const { seenByCategory, totalStructures } = result.current;
    expect(totalStructures).toBe(ALL_STRUCTURES.length);
    expect(seenByCategory.muscle.seen).toBe(1);
    expect(seenByCategory.bone.seen).toBe(1);
    expect(seenByCategory.ligament.seen).toBe(1);
    expect(seenByCategory.landmark.seen).toBe(0);
    expect(seenByCategory.joint.seen).toBe(0);
    const totals = CATEGORIES.reduce((n, c) => n + seenByCategory[c].total, 0);
    expect(totals).toBe(ALL_STRUCTURES.length);
    expect(seenByCategory.muscle.total).toBe(ALL_STRUCTURES.filter(isMuscle).length);
  });

  it('uses one definition of seen for the headline and the region rows', async () => {
    const repository = createMemoryRepository();
    const muscle = ALL_STRUCTURES.find(isMuscle)!;
    await repository.upsertMastery(row(muscle.id, 0, 3)); // attempted three times, never correct

    const { result } = renderHook(() => useProgressData(repository, 'user-1', content));
    await waitFor(() => expect(result.current.seenCount).toBe(1));

    const region = result.current.byRegion.find((r) => r.region === muscle.region);
    expect(region?.seenCount).toBe(1);
  });
});
