import { describe, expect, it } from 'vitest';
import { buildLocateQuestions } from '../questionGenerators/locate';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';

const ligament: AnatomyStructure = {
  id: 'test-ligament',
  name: 'Test ligament',
  category: 'ligament',
  region: 'lower-leg-foot',
  subregion: 'ankle-foot',
  description: 'x',
  aliases: [],
  imageIds: [],
  eligibility: { flashcard: true, mcq: true, locate: true },
  difficulty: 'medium',
  tags: [],
  attachmentStructureIds: ['tibia', 'fibula'],
};

function frame(angle: number, area: number, extra: { structureId: string; area: number }[] = []): AnatomyImageAsset {
  const a = String(angle).padStart(3, '0');
  return {
    id: `ligament-test-ligament-a${a}-context`,
    filePath: `/x/a${a}.webp`,
    mode: 'atlas-slide',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    view: 'anterior',
    layer: 'ligament',
    credit: 'c',
    licence: 'l',
    hotspots: [
      { structureId: 'test-ligament', polygons: [[[0, 0], [0.1, 0], [0.1, 0.1]]], area, centroid: [0.05, 0.03] },
      ...extra.map((e) => ({ structureId: e.structureId, polygons: [[[0.5, 0.5], [0.6, 0.5], [0.6, 0.6]]], area: e.area, centroid: [0.55, 0.53] as [number, number] })),
    ],
  };
}

describe('locate questions over a rotation set', () => {
  it('asks once per structure, opening on the angle where the target is largest', () => {
    const frames = [frame(0, 0.002), frame(45, 0.009), frame(270, 0.004)];
    const qs = buildLocateQuestions([ligament], frames);
    expect(qs).toHaveLength(1);
    expect(qs[0].imageId).toBe('ligament-test-ligament-a045-context');
    expect(qs[0].frameImageIds).toEqual([
      'ligament-test-ligament-a000-context',
      'ligament-test-ligament-a045-context',
      'ligament-test-ligament-a270-context',
    ]);
    // The id is per set, not per angle, so progress is keyed once.
    expect(qs[0].id).toBe('locate-ligament-test-ligament-*-context-test-ligament');
  });

  it('offers only the frames where that structure actually shows', () => {
    const other: AnatomyStructure = { ...ligament, id: 'other-ligament', name: 'Other' };
    const frames = [frame(0, 0.002, [{ structureId: 'other-ligament', area: 0.003 }]), frame(45, 0.009)];
    const qs = buildLocateQuestions([ligament, other], frames);
    const forOther = qs.find((q) => q.targetStructureId === 'other-ligament')!;
    expect(forOther.imageId).toBe('ligament-test-ligament-a000-context');
    // A single frame is not a rotation set for that structure.
    expect(forOther.frameImageIds).toBeUndefined();
  });

  it('leaves single images exactly as before', () => {
    const single: AnatomyImageAsset = { ...frame(0, 0.01), id: 'plain-picture' };
    const qs = buildLocateQuestions([ligament], [single]);
    expect(qs).toHaveLength(1);
    expect(qs[0].id).toBe('locate-plain-picture-test-ligament');
    expect(qs[0].frameImageIds).toBeUndefined();
  });

  it('never keys two shipped questions to the same id', () => {
    const ids = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
