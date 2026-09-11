import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { buildStarterSet, STARTER_COUNT, STARTER_TYPES } from '../questionGenerators/starterSet';
import { areaOf, isMuscle } from '../../types/structure';
import { isLocateQuestion, isMcqQuestion } from '../../types/question';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('buildStarterSet', () => {
  it('stays inside the chosen area, muscles only, in the two starter formats', () => {
    const set = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: ['shoulder'], seed: 7 });
    expect(set.length).toBeGreaterThan(0);
    expect(set.length).toBeLessThanOrEqual(STARTER_COUNT);
    for (const q of set) {
      expect(STARTER_TYPES).toContain(q.type);
      const structure = byId.get(q.structureId)!;
      expect(isMuscle(structure)).toBe(true);
      expect(areaOf(structure)).toBe('shoulder');
    }
  });

  it('opens with a multiple-choice warm-up and never asks the same muscle twice per format', () => {
    const set = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: ['hip'], seed: 3 });
    expect(isMcqQuestion(set[0])).toBe(true);
    for (const type of STARTER_TYPES) {
      const ids = set.filter((q) => q.type === type).map((q) => q.structureId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  /** The first click must land: the biggest visible polygon in the area, not a sliver of a deep muscle. */
  it('puts the largest hotspot first among the locate questions', () => {
    const set = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: ['knee'], seed: 1 });
    const locates = set.filter(isLocateQuestion);
    expect(locates.length).toBeGreaterThan(0);
    const areaOfQ = (q: (typeof locates)[number]) =>
      ALL_IMAGES.find((img) => img.id === q.imageId)!.hotspots!.find((h) => h.structureId === q.structureId)!.area;
    const largestAvailable = Math.max(
      ...ALL_IMAGES.flatMap((img) =>
        (img.hotspots ?? [])
          .filter((h) => {
            const s = byId.get(h.structureId);
            return !!s && isMuscle(s) && areaOf(s) === 'knee' && s.eligibility.locate;
          })
          .map((h) => h.area),
      ),
    );
    expect(areaOfQ(locates[0])).toBe(largestAvailable);
  });

  it('falls back to multiple choice alone when there are no images to click', () => {
    const set = buildStarterSet(ALL_STRUCTURES, [], { areas: ['shoulder'], seed: 2 });
    expect(set.length).toBeGreaterThan(0);
    expect(set.every(isMcqQuestion)).toBe(true);
  });

  it('is deterministic under a seed and empty for an area with nothing in it', () => {
    const a = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: ['ankle-foot'], seed: 9 });
    const b = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: ['ankle-foot'], seed: 9 });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(buildStarterSet([], ALL_IMAGES, { areas: ['shoulder'] })).toEqual([]);
  });
});
