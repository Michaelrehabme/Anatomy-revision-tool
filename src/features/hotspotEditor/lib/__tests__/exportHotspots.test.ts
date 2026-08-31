import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildHotspotsFile } from '../exportHotspots';
import type { AnatomyStructure } from '../../../anatomy-revision/types/structure';

/**
 * Mirrors src/scripts/importHotspots.ts's hotspotsFileSchema exactly. Not
 * imported directly — that module calls main()/process.exit() at load time
 * (it's a CLI script), so importing it here would run the CLI in-test.
 * Keep this in sync if the script's schema ever changes.
 */
const hotspotEntrySchema = z.object({
  polygons: z.array(z.array(z.tuple([z.number(), z.number()]))),
  area: z.number(),
  centroid: z.tuple([z.number(), z.number()]),
  points: z.number().optional(),
  size: z.tuple([z.number(), z.number()]).optional(),
});
const hotspotsFileSchema = z.object({
  schemaVersion: z.number(),
  normalised: z.boolean(),
  hotspots: z.record(z.string(), z.record(z.string(), hotspotEntrySchema)),
});

function muscle(id: string, region: AnatomyStructure['region']): AnatomyStructure {
  return {
    id,
    name: id,
    category: 'muscle',
    region,
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: true },
    difficulty: 'medium',
    tags: [],
    origin: [],
    insertion: [],
    nerve: [],
    actions: [],
    actionText: '',
  };
}

describe('buildHotspotsFile', () => {
  it('produces output that validates against importHotspots.ts’s schema', () => {
    const structuresById = new Map([
      ['deltoid', muscle('deltoid', 'shoulder-arm')],
      ['gluteus-maximus', muscle('gluteus-maximus', 'hip-thigh')],
    ]);
    const drafts = {
      'panel-deltoid': [
        { structureId: 'deltoid', polygons: [[[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]]], area: 0.08, centroid: [0.3, 0.23] as [number, number] },
      ],
      'panel-gluteus-maximus': [
        { structureId: 'gluteus-maximus', polygons: [[[0.2, 0.2], [0.6, 0.2], [0.6, 0.6]]], area: 0.08, centroid: [0.4, 0.33] as [number, number] },
      ],
    };

    const result = buildHotspotsFile(drafts, structuresById);
    expect(() => hotspotsFileSchema.parse(result)).not.toThrow();
    expect(result.hotspots['shoulder-arm'].deltoid.area).toBe(0.08);
    expect(result.hotspots['hip-thigh']['gluteus-maximus'].centroid).toEqual([0.4, 0.33]);
  });

  it('skips hotspots whose structure id has no match', () => {
    const result = buildHotspotsFile(
      { 'panel-unknown': [{ structureId: 'not-real', polygons: [], area: 0, centroid: [0, 0] }] },
      new Map(),
    );
    expect(result.hotspots).toEqual({});
  });
});
