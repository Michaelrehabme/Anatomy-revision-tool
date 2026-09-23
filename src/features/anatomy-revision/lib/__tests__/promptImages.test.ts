import { describe, it, expect } from 'vitest';
import { promptImagesFor } from '../questionGenerators/promptImages';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { rotationFramesFor } from '../rotationFrames';
import type { AnatomyImageAsset } from '../../types/image';
import type { AnatomyStructure } from '../../types/structure';

const structure: AnatomyStructure = {
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
  attachmentStructureIds: [],
};

function plate(id: string, area: number, subject?: string): AnatomyImageAsset {
  return {
    id,
    filePath: `/x/${id}.webp`,
    mode: 'atlas-slide',
    region: 'lower-leg-foot',
    subregion: 'ankle-foot',
    view: 'anterior',
    layer: 'ligament',
    credit: 'c',
    licence: 'l',
    ...(subject ? { panelStructureNames: [subject, 'Test ligament'] } : {}),
    hotspots: [
      { structureId: 'test-ligament', polygons: [[[0, 0], [0.1, 0], [0.1, 0.1]]], area, centroid: [0.05, 0.03] },
    ],
  };
}

describe('promptImagesFor', () => {
  it('asks once per turntable, on the angle where the structure shows largest', () => {
    const own = [0, 45, 90].map((a) =>
      plate(`ligament-test-ligament-a${String(a).padStart(3, '0')}-context`, a === 45 ? 0.05 : 0.01, 'Test ligament'),
    );
    const picked = promptImagesFor(structure, own);
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe('ligament-test-ligament-a045-context');
  });

  it('prefers the pre-highlighted plate over the locate plate of the same scene', () => {
    const images = [
      plate('ligament-test-ligament-a000-context', 0.05, 'Test ligament'),
      { ...plate('ligament-test-ligament-a000-highlight', 0, 'Test ligament'), hotspots: [] },
    ];
    // The highlight frame carries no hotspots, so it must not be chosen by area.
    const picked = promptImagesFor(structure, [images[0], { ...images[1], hotspots: [{ structureId: 'test-ligament', polygons: [[[0, 0], [0.1, 0], [0.1, 0.1]]], area: 0.001, centroid: [0.05, 0.03] }] }]);
    expect(picked.map((p) => p.id)).toEqual(['ligament-test-ligament-a000-highlight']);
  });

  it('never asks on a neighbour’s plate when the structure has one of its own', () => {
    const own = [plate('ligament-test-ligament-a000-context', 0.02, 'Test ligament')];
    const foreign = [plate('ligament-neighbour-a000-context', 0.09, 'Neighbour ligament')];
    expect(promptImagesFor(structure, [...own, ...foreign]).map((p) => p.id)).toEqual([
      'ligament-test-ligament-a000-context',
    ]);
  });

  it('drops a wide plate the structure is a speck on, and keeps one it reads on', () => {
    // No plate of its own: a hip ligament drawn on the spine plate at 0.3% of
    // the frame is not a question anyone can answer.
    const speck = plate('sub-spine-a000-plate', 0.003);
    const legible = plate('sub-hip-a000-plate', 0.04);
    expect(promptImagesFor(structure, [speck, legible]).map((p) => p.id)).toEqual(['sub-hip-a000-plate']);
    // With nothing else at all, the best picture there is beats no question.
    expect(promptImagesFor(structure, [speck]).map((p) => p.id)).toEqual(['sub-spine-a000-plate']);
  });
});

describe('the shipped identify questions', () => {
  const questions = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES);
  const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));

  it('never asks the same structure twice from one turntable', () => {
    const seen = new Set<string>();
    const repeats: string[] = [];
    for (const q of questions) {
      const frames = rotationFramesFor(imagesById.get(q.promptImageId), ALL_IMAGES);
      const key = `${q.structureId}|${frames.length > 1 ? frames[0].id.replace(/-a\d{3}.*$/, '') : q.promptImageId}`;
      if (seen.has(key)) repeats.push(key);
      seen.add(key);
    }
    expect(repeats).toEqual([]);
  });
});
