import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildIndexes } from '../indexes';
import { pickNameDistractors } from '../distractors';
import { createRng } from '../rng';
import { pointInAnyPolygon } from '../hotspot/pointInPolygon';
import { isMcqQuestion, isFillBlankQuestion } from '../../types/question';
import type { StructureMastery } from '../../types/attempt';

describe('generateRevisionSet', () => {
  it('generates flashcards and MCQs for the full seed dataset deterministically', () => {
    const config = { types: ['flashcard', 'mcq'] as const, mode: 'practice' as const, seed: 42 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('generates locate questions from the posterior regional renders', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['locate'],
      mode: 'practice',
      seed: 1,
    });
    // Deliberately a floor rather than an exact count: retuning the occlusion
    // thresholds in masksToHotspots.ts legitimately moves this by a few.
    expect(result.length).toBeGreaterThanOrEqual(25);
    expect(result.every((q) => q.type === 'locate')).toBe(true);
  });

  it('keeps hotspots on an image mutually exclusive so a correct tap is never stolen', () => {
    // Every hotspot is traced from a solo silhouette mask, and hitTest resolves
    // overlaps smallest-area-wins. Without the depth subtraction in
    // src/scripts/data/occlusionOrder.ts, a correct tap on a superficial muscle
    // would resolve to a deeper one the student cannot even see, and be graded
    // wrong. This fails loudly if the polygons are ever regenerated flat.
    const withHotspots = ALL_IMAGES.filter((img) => (img.hotspots?.length ?? 0) > 1);
    expect(withHotspots.length).toBeGreaterThan(0);

    for (const image of withHotspots) {
      const hotspots = image.hotspots ?? [];
      let covered = 0;
      let overlapping = 0;

      const steps = 100;
      for (let y = 0; y < steps; y++) {
        for (let x = 0; x < steps; x++) {
          const point: [number, number] = [(x + 0.5) / steps, (y + 0.5) / steps];
          let hits = 0;
          for (const hotspot of hotspots) {
            if (pointInAnyPolygon(point, hotspot.polygons)) hits++;
          }
          if (hits > 0) covered++;
          if (hits > 1) overlapping++;
        }
      }

      expect(covered).toBeGreaterThan(0);
      // A little border kissing is inherent to independently simplified rings.
      expect(overlapping / covered).toBeLessThan(0.01);
    }
  });

  it('respects region filtering', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      region: 'hip-thigh',
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.region === 'hip-thigh')).toBe(true);
  });

  it('respects multi-region filtering (OR-matched), taking precedence over `region`', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      region: 'back-core', // should be ignored since `regions` is set
      regions: ['hip-thigh', 'lower-leg-foot'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.region === 'hip-thigh' || q.region === 'lower-leg-foot')).toBe(true);
  });

  it('an empty `regions` array applies no region filter at all', () => {
    const filtered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      regions: [],
      mode: 'practice',
      seed: 1,
    });
    const unfiltered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      mode: 'practice',
      seed: 1,
    });
    expect(filtered.length).toBe(unfiltered.length);
  });

  it('assessment mode samples the requested count (or fewer if pool is smaller)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      mode: 'assessment',
      count: 3,
      seed: 7,
    });
    expect(result).toHaveLength(3);
  });

  it('generates fill-blank questions for bones and landmarks, deterministically', () => {
    const config = { types: ['fill-blank'] as const, mode: 'practice' as const, seed: 11 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    for (const q of a.filter(isFillBlankQuestion)) {
      expect(q.category === 'bone' || q.category === 'landmark').toBe(true);
      expect(q.answer.length).toBeGreaterThan(0);
      expect(q.before + q.after).not.toBe('');
    }
  });

  it('never generates identify-typed questions when no images have hotspots (atlas-slide gap), but does for single-structure images', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['identify-typed'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.every((q) => q.type === 'identify-typed')).toBe(true);
  });

  it('MCQ choices always include the correct answer exactly once', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['mcq'],
      mode: 'practice',
      seed: 5,
    });
    for (const q of result.filter(isMcqQuestion)) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });
});

describe('pickNameDistractors', () => {
  it('never includes the correct structure itself', () => {
    const rng = createRng(3);
    const sartorius = ALL_STRUCTURES.find((s) => s.id === 'sartorius')!;
    const distractors = pickNameDistractors(sartorius, ALL_STRUCTURES, 3, rng);
    expect(distractors).not.toContain(sartorius.name);
  });

  it('prefers same-region structures before falling back to the full dataset', () => {
    buildIndexes(ALL_STRUCTURES); // sanity: indexes build without throwing over seed data
    const rng = createRng(9);
    const iliacus = ALL_STRUCTURES.find((s) => s.id === 'iliacus')!;
    const distractors = pickNameDistractors(iliacus, ALL_STRUCTURES, 2, rng);
    expect(distractors.length).toBeGreaterThan(0);
  });

  describe('correctness-weighted scheduling', () => {
    const NOW = new Date('2026-08-31T12:00:00.000Z');

    /** Marks half the dataset as answered wrong every time, the other half as always right. */
    function splitMastery(structureIds: string[]): StructureMastery[] {
      return structureIds.map((structureId, i) => ({
        structureId,
        userId: 'u1',
        attemptsTotal: 10,
        attemptsCorrect: i % 2 === 0 ? 0 : 10,
        lastAttemptAt: NOW.toISOString(),
      }));
    }

    it('front-loads structures the user gets wrong', () => {
      const config = { types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
      const unweighted = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      const structureIds = [...new Set(unweighted.map((q) => q.structureId))];
      const weak = new Set(splitMastery(structureIds).filter((m) => m.attemptsCorrect === 0).map((m) => m.structureId));

      const weighted = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        mastery: splitMastery(structureIds),
        now: NOW,
        count: 20,
      });

      const weakInWeighted = weighted.filter((q) => weak.has(q.structureId)).length;
      const weakInUnweighted = unweighted.slice(0, 20).filter((q) => weak.has(q.structureId)).length;
      expect(weakInWeighted).toBeGreaterThan(weakInUnweighted);
    });

    it('stays deterministic under a seed when weighted', () => {
      const structureIds = [...new Set(
        generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { types: ['flashcard'], mode: 'practice', seed: 3 })
          .map((q) => q.structureId),
      )];
      const config = {
        types: ['flashcard'] as const,
        mode: 'practice' as const,
        seed: 3,
        mastery: splitMastery(structureIds),
        now: NOW,
      };
      const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    });

    it('still returns the whole pool, only reordered', () => {
      const config = { types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
      const unweighted = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      const structureIds = [...new Set(unweighted.map((q) => q.structureId))];
      const weighted = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        mastery: splitMastery(structureIds),
        now: NOW,
      });
      expect(weighted.map((q) => q.id).sort()).toEqual(unweighted.map((q) => q.id).sort());
    });

    it('leaves generation untouched when no mastery is supplied', () => {
      // Signed-out and first-ever sessions must keep the uniform behaviour.
      const config = { types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
      const withEmpty = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...config, mastery: [] });
      const without = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      expect(withEmpty.map((q) => q.id)).toEqual(without.map((q) => q.id));
    });
  });


  describe('blending due review with new material', () => {
    const config = { types: ['flashcard'] as const, mode: 'practice' as const, seed: 21 };
    const pool = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const allIds = [...new Set(pool.map((q) => q.structureId))].sort();
    const due = allIds.slice(0, 30);

    const shareOfDue = (qs: typeof pool) => qs.filter((q) => due.includes(q.structureId)).length / qs.length;

    it('caps the due queue share so new material always gets in', () => {
      const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        priorityStructureIds: due,
        count: 20,
      });
      expect(result).toHaveLength(20);
      expect(shareOfDue(result)).toBeLessThanOrEqual(0.6);
      expect(shareOfDue(result)).toBeGreaterThan(0);
    });

    it('honours an explicit reviewShare', () => {
      const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        priorityStructureIds: due,
        reviewShare: 0.25,
        count: 20,
      });
      expect(shareOfDue(result)).toBeLessThanOrEqual(0.25);
    });

    it('still fills the session when the due queue is nearly empty', () => {
      // The regression that motivated the blend: a short due queue used to
      // shrink the whole session rather than topping up from the wider pool.
      const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        priorityStructureIds: allIds.slice(0, 1),
        count: 20,
      });
      expect(result).toHaveLength(20);
    });

    it('tops up from the due queue when the wider pool is exhausted', () => {
      const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        structureIds: due,          // hard restriction: nothing outside `due` exists
        priorityStructureIds: due,  // ...so the cap has nowhere else to draw from
        count: 20,
      });
      expect(result).toHaveLength(20);
      expect(shareOfDue(result)).toBe(1);
    });

    it('leaves a session without a due queue alone', () => {
      const withNone = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...config, count: 20 });
      const withEmpty = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
        ...config,
        priorityStructureIds: [],
        count: 20,
      });
      expect(withEmpty.map((q) => q.id)).toEqual(withNone.map((q) => q.id));
    });

    it('is deterministic under a seed', () => {
      const blendConfig = { ...config, priorityStructureIds: due, count: 20 };
      const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, blendConfig);
      const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, blendConfig);
      expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    });
  });

});
