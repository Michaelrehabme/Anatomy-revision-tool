import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { buildStarterSet, STARTER_COUNT, STARTER_TYPES } from '../questionGenerators/starterSet';
import { areasOf, isMuscle } from '../../types/structure';
import { isLocateQuestion, isMcqQuestion } from '../../types/question';
import { buildLocateQuestions } from '../questionGenerators/locate';

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
      expect(areasOf(structure)).toContain('shoulder');
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
    // THE BAR IS WHAT CAN ACTUALLY BE ASKED, not the biggest polygon anywhere.
    // Since the muscle plates landed, a muscle is asked on the plate framed for
    // IT (locate.ts), and a knee muscle's hotspot is often larger on a
    // neighbour's plate than on its own — vastus lateralis fills more of the
    // vastus medialis frame than of its own. Measuring against a picture the
    // question can never open on would fail whatever the starter set chose.
    const largestAvailable = Math.max(
      ...buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES)
        .filter((q) => {
          const s = byId.get(q.structureId);
          return !!s && isMuscle(s) && areasOf(s).includes('knee');
        })
        .map(areaOfQ),
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
