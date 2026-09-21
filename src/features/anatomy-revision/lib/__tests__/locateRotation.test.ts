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

/**
 * A plate draws its neighbours too, so a ligament is tappable on plates framed
 * for other ligaments. Those are not questions about where it is.
 */
describe('a set framed for another structure', () => {
  const named = (img: AnatomyImageAsset, subject: string, id: string): AnatomyImageAsset => ({
    ...img,
    id,
    panelStructureNames: [subject, 'Test ligament'],
  });

  it('asks on the structure\u2019s own plate even when a neighbour traces larger', () => {
    const own = [0, 45].map((a) =>
      named(frame(a, a === 45 ? 0.004 : 0.002), 'Test ligament',
        `ligament-test-ligament-a${String(a).padStart(3, '0')}-context`),
    );
    const foreign = [0, 45].map((a) =>
      named(frame(a, 0.009), 'Neighbour ligament',
        `ligament-neighbour-ligament-a${String(a).padStart(3, '0')}-context`),
    );
    const qs = buildLocateQuestions([ligament], [...own, ...foreign]);
    expect(qs).toHaveLength(1);
    expect(qs[0].imageId).toBe('ligament-test-ligament-a045-context');
    // And it can only turn through its own set.
    expect(qs[0].frameImageIds).toEqual([
      'ligament-test-ligament-a000-context',
      'ligament-test-ligament-a045-context',
    ]);
  });

  it('keeps a neighbour\u2019s plate when the own plate cannot carry the question', () => {
    // Too slight to aim at on its own plate: a neighbour's is better than none.
    const sliver = named(frame(0, 0.0000001), 'Test ligament', 'ligament-test-ligament-a000-context');
    const own = [
      {
        ...sliver,
        hotspots: [{ ...sliver.hotspots![0], polygons: [[[0, 0], [0.001, 0], [0.001, 0.001]]] }],
      },
    ];
    const foreign = [0, 45].map((a) =>
      named(frame(a, 0.009), 'Neighbour ligament',
        `ligament-neighbour-ligament-a${String(a).padStart(3, '0')}-context`),
    );
    const qs = buildLocateQuestions([ligament], [...own, ...foreign]);
    expect(qs).toHaveLength(1);
    expect(qs[0].imageId).toMatch(/^ligament-neighbour-ligament-/);
  });

  it('leaves sets that name no subject alone', () => {
    // The sub-region turntables are framed on a region, not a structure.
    const frames = [frame(0, 0.002), frame(45, 0.009)];
    const qs = buildLocateQuestions([ligament], frames);
    expect(qs).toHaveLength(1);
    expect(qs[0].imageId).toBe('ligament-test-ligament-a045-context');
  });
});

describe('the shipped ligament plates', () => {
  const qs = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES).filter((q) => q.category === 'ligament');
  const ownerOf = (imageId: string) =>
    imageId.replace(/^ligament-/, '').replace(/-a\d{3}(?:[ud]\d{3})?-(context|highlight)$/, '');

  it('opens every ligament on the plate framed for it', () => {
    const foreign = qs
      .filter((q) => ownerOf(q.imageId) !== q.targetStructureId)
      .map((q) => `${q.targetStructureId} -> ${ownerOf(q.imageId)}`);
    expect(foreign).toEqual([]);
  });

  it('asks each ligament once, not once per plate it appears on', () => {
    const perStructure = new Map<string, number>();
    for (const q of qs) perStructure.set(q.targetStructureId, (perStructure.get(q.targetStructureId) ?? 0) + 1);
    const repeated = [...perStructure.entries()].filter(([, n]) => n > 1);
    expect(repeated).toEqual([]);
    expect(qs.length).toBe(perStructure.size);
  });

  it('only turns through frames of that ligament\u2019s own set', () => {
    const strays = qs.flatMap((q) =>
      (q.frameImageIds ?? [])
        .filter((id) => ownerOf(id) !== q.targetStructureId)
        .map((id) => `${q.targetStructureId} can turn to ${id}`),
    );
    expect(strays).toEqual([]);
  });
});
