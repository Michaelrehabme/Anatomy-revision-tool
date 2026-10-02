import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../../anatomy-revision/data/seed';
import { generateRevisionSet } from '../../../anatomy-revision/lib/questionGenerators/generateSet';
import { rotationFramesFor } from '../../../anatomy-revision/lib/rotationFrames';
import { AREAS, type Area } from '../../../anatomy-revision/types/region';
import type { RevisionQuestion } from '../../../anatomy-revision/types/question';
import { areasByImage, filePathsByArea } from '../areaImages';

/**
 * Over the SHIPPED seed, not fixtures: the point of these is that the real
 * catalogue has no picture a download would miss. src/test/setup.ts has
 * already attached the hotspots.
 */
const paths = filePathsByArea(ALL_STRUCTURES, ALL_IMAGES);
const imagesById = new Map(ALL_IMAGES.map((image) => [image.id, image]));

/** Every image id a question can put on screen, before any turning. */
function imageIdsOf(question: RevisionQuestion): string[] {
  switch (question.type) {
    case 'flashcard':
      return [question.front.imageId, question.back.imageId].filter((id): id is string => !!id);
    case 'mcq':
      return question.promptImageId ? [question.promptImageId] : [];
    case 'identify-typed':
      return [question.promptImageId];
    case 'locate':
      return [question.imageId, ...(question.frameImageIds ?? [])];
    default:
      return [];
  }
}

describe('which pictures an area downloads', () => {
  it('puts every image in at least one area', () => {
    const areas = areasByImage(ALL_STRUCTURES, ALL_IMAGES);
    const homeless = ALL_IMAGES.filter((image) => (areas.get(image.id) ?? []).length === 0).map((image) => image.id);
    expect(homeless).toEqual([]);
    expect(areas.size).toBe(ALL_IMAGES.length);
  });

  it('names only files that are on disk', () => {
    const missing = [...new Set(Object.values(paths).flat())].filter(
      (path) => !existsSync(join(process.cwd(), 'public', path)),
    );
    expect(missing).toEqual([]);
  });

  it('gives every area something, sorted and without repeats', () => {
    for (const area of AREAS) {
      expect(paths[area].length, area).toBeGreaterThan(50);
      expect(paths[area], area).toEqual([...new Set(paths[area])].sort());
    }
  });

  // The one that matters. Whatever a session in an area can put on screen —
  // every question type, every frame the viewer can turn to — is a file that
  // area's download holds. If a generator starts choosing pictures another way
  // and the download does not follow, this is what fails.
  it.each(AREAS)('holds every picture a %s session can show', (area: Area) => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard', 'mcq', 'locate', 'identify-typed'],
      areas: [area],
      entitledAreas: AREAS,
      mode: 'practice',
      seed: 7,
    });
    const held = new Set(paths[area]);
    const missing = new Set<string>();
    let shown = 0;
    for (const question of questions) {
      for (const id of imageIdsOf(question)) {
        const image = imagesById.get(id);
        if (!image) continue;
        for (const frame of [image, ...rotationFramesFor(image, ALL_IMAGES)]) {
          shown += 1;
          if (!held.has(frame.filePath)) missing.add(frame.filePath);
        }
      }
    }
    expect(shown).toBeGreaterThan(0);
    expect([...missing]).toEqual([]);
  });

  // The rule this replaced took every plate that TRACES a structure of the
  // area, which made the elbow 84 MB of other joints' ligament plates.
  it('does not pull in plates framed on another area', () => {
    const elbow = new Set(paths.elbow);
    expect(paths.knee.filter((path) => elbow.has(path))).toEqual([]);
    expect(paths.elbow.length).toBeLessThan(400);
  });
});
