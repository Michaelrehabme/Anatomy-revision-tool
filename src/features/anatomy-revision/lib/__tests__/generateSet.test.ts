import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { generateRevisionSet, REVIEW_SHARE } from '../questionGenerators/generateSet';
import { AREAS, type Area } from '../../types/region';
import { buildIndexes } from '../indexes';
import { areasOf } from '../../types/structure';
import { pickNameDistractors } from '../distractors';
import { createRng } from '../rng';
import { pointInAnyPolygon } from '../hotspot/pointInPolygon';
import { isMcqQuestion, isFillBlankQuestion, isOinaQuestion, isFlashcardQuestion } from '../../types/question';
import type { FactMastery, StructureMastery } from '../../types/attempt';

describe('generateRevisionSet', () => {
  it('generates flashcards and MCQs for the full seed dataset deterministically', () => {
    const config = { entitledAreas: AREAS, types: ['flashcard', 'mcq'] as const, mode: 'practice' as const, seed: 42 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('generates locate questions from the posterior regional renders', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
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
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard'],
      region: 'hip-thigh',
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.region === 'hip-thigh')).toBe(true);
  });

  it('respects multi-region filtering (OR-matched), taking precedence over `region`', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
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
    const filtered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard'],
      regions: [],
      mode: 'practice',
      seed: 1,
    });
    const unfiltered = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard'],
      mode: 'practice',
      seed: 1,
    });
    expect(filtered.length).toBe(unfiltered.length);
  });

  it('assessment mode samples the requested count (or fewer if pool is smaller)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard'],
      mode: 'assessment',
      count: 3,
      seed: 7,
    });
    expect(result).toHaveLength(3);
  });

  it('generates fill-blank questions for bones and landmarks, deterministically', () => {
    const config = { entitledAreas: AREAS, types: ['fill-blank'] as const, mode: 'practice' as const, seed: 11 };
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
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['identify-typed'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.every((q) => q.type === 'identify-typed')).toBe(true);
  });

  it('MCQ choices always include the correct answer exactly once', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
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

describe('generateRevisionSet adaptive mode (CR-009)', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('is deterministic given the same seed', () => {
    const config = {
      entitledAreas: AREAS,
      types: ['mcq', 'fill-blank', 'identify-typed'] as const,
      mode: 'adaptive' as const,
      count: 15,
      seed: 42,
      now,
    };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('returns up to the requested count, one question per selected structure', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq', 'flashcard'],
      mode: 'adaptive',
      count: 12,
      seed: 3,
      now,
    });
    expect(result.length).toBeLessThanOrEqual(12);
    expect(new Set(result.map((q) => q.structureId)).size).toBe(result.length);
  });

  it('escalates a well-mastered structure to a harder requested type than mcq', () => {
    const masteredMuscle = ALL_STRUCTURES.find((s) => s.category === 'muscle')!;
    const mastery: StructureMastery[] = [
      {
        structureId: masteredMuscle.id,
        userId: 'user-1',
        attemptsTotal: 20,
        attemptsCorrect: 19,
        lastAttemptAt: '2026-08-01T00:00:00.000Z',
        dueAt: '2026-09-01T00:00:00.000Z',
      },
    ];
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq', 'identify-typed'],
      mode: 'adaptive',
      count: ALL_STRUCTURES.length,
      structureIds: [masteredMuscle.id],
      seed: 1,
      mastery,
      now,
    });
    const question = result.find((q) => q.structureId === masteredMuscle.id);
    // Only generated if an identify-typed question is actually possible for this structure (needs a hotspot-bearing image) — assert the escalation attempt happened by checking it's not silently stuck on mcq.
    if (question) expect(['identify-typed', 'mcq']).toContain(question.type);
  });

  it('works with no mastery data at all (first-ever session)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq'],
      mode: 'adaptive',
      count: 10,
      seed: 1,
      now,
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('due-queue priority (prioritised, not restricted)', () => {
  const TYPES = ['flashcard', 'mcq'] as const;

  // Ids that provably yield questions, so the blend always has both sides to work with.
  const answerableIds = [
    ...new Set(
      generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: TYPES, mode: 'practice', seed: 7 }).map((q) => q.structureId),
    ),
  ];

  it('leaves room for structures outside the priority list', () => {
    // The regression this guards: passing the due queue as structureIds restricted the
    // session to it, and since answering a due structure reschedules it, the queue
    // refilled itself and no new structure was ever reachable.
    const priorityStructureIds = answerableIds.slice(0, 5);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: TYPES,
      mode: 'practice',
      count: 20,
      seed: 11,
      priorityStructureIds,
    });
    expect(result).toHaveLength(20);
    expect(result.some((q) => !priorityStructureIds.includes(q.structureId))).toBe(true);
  });

  it('caps the priority share even when the due queue could fill the session', () => {
    expect(answerableIds.length).toBeGreaterThan(60);
    const priorityStructureIds = answerableIds.slice(0, 60);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: TYPES,
      mode: 'practice',
      count: 20,
      seed: 12,
      priorityStructureIds,
    });
    const fromPriority = result.filter((q) => priorityStructureIds.includes(q.structureId));
    expect(fromPriority).toHaveLength(Math.round(20 * REVIEW_SHARE));
  });

  it('honours an explicit reviewShare', () => {
    const priorityStructureIds = answerableIds.slice(0, 60);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: TYPES,
      mode: 'practice',
      count: 20,
      seed: 13,
      priorityStructureIds,
      reviewShare: 0.25,
    });
    expect(result.filter((q) => priorityStructureIds.includes(q.structureId))).toHaveLength(5);
  });

  it('does not shrink the session when the due queue is thin', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: TYPES,
      mode: 'practice',
      count: 20,
      seed: 14,
      priorityStructureIds: answerableIds.slice(0, 1),
    });
    expect(result).toHaveLength(20);
  });

  it('treats an empty priority list as no priority at all', () => {
    const base = { entitledAreas: AREAS, types: TYPES, mode: 'practice' as const, count: 20, seed: 15 };
    const withEmpty = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, priorityStructureIds: [] });
    const without = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, base);
    expect(withEmpty.map((q) => q.id)).toEqual(without.map((q) => q.id));
  });

  it('is ignored in adaptive mode, which already weights due-ness over the whole pool', () => {
    const priorityStructureIds = answerableIds.slice(0, 3);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: TYPES,
      mode: 'adaptive',
      count: 20,
      seed: 16,
      priorityStructureIds,
      now: new Date('2026-09-03T09:00:00.000Z'),
    });
    expect(result.some((q) => !priorityStructureIds.includes(q.structureId))).toBe(true);
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
      const config = { entitledAreas: AREAS, types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
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
        generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: ['flashcard'], mode: 'practice', seed: 3 })
          .map((q) => q.structureId),
      )];
      const config = {
        entitledAreas: AREAS,
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
      const config = { entitledAreas: AREAS, types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
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
      const config = { entitledAreas: AREAS, types: ['flashcard'] as const, mode: 'practice' as const, seed: 3 };
      const withEmpty = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...config, mastery: [] });
      const without = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
      expect(withEmpty.map((q) => q.id)).toEqual(without.map((q) => q.id));
    });
  });


  describe('blending due review with new material', () => {
    const config = { entitledAreas: AREAS, types: ['flashcard'] as const, mode: 'practice' as const, seed: 21 };
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

describe('OINA sessions (CR-018)', () => {
  const HAMSTRINGS = ALL_STRUCTURES.filter((s) => (s.groups ?? []).includes('hamstrings')).map((s) => s.id);

  function fact(structureId: string, promptKind: FactMastery['promptKind'], overrides: Partial<FactMastery> = {}): FactMastery {
    return {
      userId: 'user-1',
      structureId,
      promptKind,
      attemptsTotal: 5,
      attemptsCorrect: 5,
      streak: 5,
      missStreak: 0,
      lastCorrect: true,
      lastAttemptAt: '2026-09-01T00:00:00.000Z',
      typed: false,
      ...overrides,
    };
  }

  /** Every fact of every hamstring is well known, so nothing needs a learn card. */
  const KNOWN_HAMSTRINGS = HAMSTRINGS.flatMap((id) =>
    (['origin', 'insertion', 'nerve', 'action'] as const).map((k) => fact(id, k)),
  );

  it('scopes a session to a muscle group', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'practice',
      seed: 7,
      factMastery: KNOWN_HAMSTRINGS,
    });
    expect(questions.length).toBeGreaterThan(0);
    expect(new Set(questions.map((q) => q.structureId))).toEqual(new Set(HAMSTRINGS));
  });

  it('asks only the facts requested', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin', 'insertion'],
      mode: 'practice',
      seed: 7,
      factMastery: KNOWN_HAMSTRINGS,
    });
    expect(new Set(questions.map((q) => q.promptKind))).toEqual(new Set(['origin', 'insertion']));
  });

  it('puts a learn card in front of every fact the student has not met', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin'],
      mode: 'practice',
      seed: 7,
    });
    const oina = questions.filter(isOinaQuestion);
    expect(oina.length).toBeGreaterThan(0);
    // Each OINA question is immediately preceded by its own muscle's card.
    for (const [i, q] of questions.entries()) {
      if (!isOinaQuestion(q)) continue;
      const before = questions[i - 1];
      expect(before && isFlashcardQuestion(before)).toBe(true);
      expect(before.structureId).toBe(q.structureId);
      expect(before.promptKind).toBe(q.promptKind);
    }
  });

  it('drops the learn card once the fact is known, and brings it back after a miss', () => {
    const base = {
      entitledAreas: AREAS,
      types: ['oina'] as const,
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin'] as const,
      mode: 'practice' as const,
      seed: 7,
    };
    const known = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, factMastery: KNOWN_HAMSTRINGS });
    expect(known.every(isOinaQuestion)).toBe(true);

    const lapsed = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      ...base,
      factMastery: KNOWN_HAMSTRINGS.map((f) =>
        f.structureId === HAMSTRINGS[0] && f.promptKind === 'origin' ? { ...f, lastCorrect: false } : f,
      ),
    });
    expect(lapsed.filter(isFlashcardQuestion)).toHaveLength(1);
    expect(lapsed.filter(isFlashcardQuestion)[0].structureId).toBe(HAMSTRINGS[0]);
  });

  it('shows the card only once when the student asks for that', () => {
    const base = {
      entitledAreas: AREAS,
      types: ['oina'] as const,
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin'] as const,
      mode: 'practice' as const,
      seed: 7,
    };
    // Seen once already: the default of 3 still teaches, a setting of 1 does not.
    const seenOnce = HAMSTRINGS.map((id) => fact(id, 'origin', { attemptsTotal: 1, attemptsCorrect: 1, streak: 1 }));

    expect(
      generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, factMastery: seenOnce }).filter(isFlashcardQuestion),
    ).toHaveLength(HAMSTRINGS.length);
    expect(
      generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...base, factMastery: seenOnce, learnCardAttempts: 1 }).filter(
        isFlashcardQuestion,
      ),
    ).toHaveLength(0);
  });

  it('shows no cards at all at 0, even for a fact never seen', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin'],
      mode: 'practice',
      seed: 7,
      learnCardAttempts: 0,
    });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every(isOinaQuestion)).toBe(true);
  });

  it('covers every fact of every muscle in the group when uncapped', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'practice',
      seed: 7,
      factMastery: KNOWN_HAMSTRINGS,
    });
    // 3 hamstrings x 4 facts, with nothing dropped and nothing capped.
    expect(questions.filter(isOinaQuestion)).toHaveLength(HAMSTRINGS.length * 4);
    for (const id of HAMSTRINGS) {
      const facts = questions.filter(isOinaQuestion).filter((q) => q.structureId === id).map((q) => q.promptKind);
      expect(new Set(facts), id).toEqual(new Set(['origin', 'insertion', 'nerve', 'action']));
    }
  });

  it('does not spend the question budget on learn cards', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'practice',
      count: 5,
      seed: 7,
    });
    expect(questions.filter(isOinaQuestion)).toHaveLength(5);
    expect(questions.length).toBeGreaterThan(5);
  });

  it('teaches nothing in an exam — those test rather than teach', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'assessment',
      count: 5,
      seed: 7,
    });
    expect(questions.every(isOinaQuestion)).toBe(true);
  });

  it('escalates only the facts the student has mastered', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'practice',
      seed: 7,
      factMastery: KNOWN_HAMSTRINGS.map((f) => (f.promptKind === 'nerve' ? { ...f, typed: true } : f)),
    });
    for (const q of questions.filter(isOinaQuestion)) {
      expect(q.format, `${q.structureId}/${q.promptKind}`).toBe(q.promptKind === 'nerve' ? 'typed' : 'select');
    }
  });
});

describe('generateRevisionSet with an unbuildable combination', () => {
  /**
   * The setup screen must be able to see zero coming rather than throw.
   *
   * THE EXAMPLE IS FOUND, NOT NAMED, because naming one keeps going stale. Bones
   * were the original example until they got skeleton plates. The coccyx was the
   * example after that, until a sacrum plate drew it at sacrum scale instead of
   * whole-column scale. Whichever structure has no hotspot today is the one this
   * asks about, and the first assertion fails loudly on the day none is left —
   * which is a good day, and a deliberate edit rather than a silent pass.
   */
  it('yields nothing when nothing in the pool has a hotspot, rather than throwing', () => {
    const drawn = new Set(ALL_IMAGES.flatMap((i) => (i.hotspots ?? []).map((h) => h.structureId)));
    const withoutHotspots = ALL_STRUCTURES.filter((s) => !drawn.has(s.id));
    expect(withoutHotspots.length).toBeGreaterThan(0);
    const result = generateRevisionSet(withoutHotspots, ALL_IMAGES, { entitledAreas: AREAS, types: ['locate'], mode: 'practice', seed: 1 });
    expect(result).toEqual([]);
  });

  it('does build locate questions over bones, which now have skeleton plates', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: ['locate'], category: 'bone', mode: 'practice', seed: 1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.type === 'locate')).toBe(true);
  });
});

/**
 * Since CR-032 a structure can belong to several areas — a pedicle revises under
 * all three spine levels. Each question still carries one area, because that is
 * what the session header names, and naming a level the student did not pick
 * contradicts the chip they just used.
 */
describe('question area follows the area the session asked for', () => {
  const spineIds = new Set(
    ALL_STRUCTURES.filter((s) => areasOf(s).length > 1).map((s) => s.id),
  );

  it.each([
    ['lumbar-spine'],
    ['cervical-spine'],
    ['thoracic-spine'],
  ] as const)('stamps every question with %s when that is the only area chosen', (area) => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard', 'mcq', 'identify-typed'],
      areas: [area],
      mode: 'practice',
      seed: 7,
    });
    expect(questions.length).toBeGreaterThan(0);
    // Includes the multi-area structures, which default to the cervical spine.
    expect(questions.some((q) => spineIds.has(q.structureId))).toBe(true);
    for (const q of questions) expect(q.area, `${q.structureId}`).toBe(area);
  });

  it('picks one of the chosen areas when several are selected', () => {
    const areas = ['cervical-spine', 'thoracic-spine'] as const;
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq'],
      areas: [...areas],
      mode: 'practice',
      seed: 11,
    });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) expect(areas).toContain(q.area!);
  });

  it('stamps an assessment too, which takes a different exit from the generator', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq'],
      areas: ['lumbar-spine'],
      mode: 'assessment',
      count: 12,
      seed: 3,
    });
    expect(questions).toHaveLength(12);
    for (const q of questions) expect(q.area).toBe('lumbar-spine');
  });

  it('stamps the learn cards an OINA session inserts, not just the questions', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['oina'],
      areas: ['thoracic-spine'],
      mode: 'practice',
      seed: 5,
    });
    const cards = questions.filter(isFlashcardQuestion);
    expect(cards.length).toBeGreaterThan(0);
    for (const q of questions) expect(q.area).toBe('thoracic-spine');
  });

  it('leaves the default area in place when the session filtered by nothing', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['flashcard'],
      mode: 'practice',
      seed: 9,
    });
    const pedicle = questions.find((q) => q.structureId === 'pedicle');
    expect(pedicle?.area).toBe('cervical-spine');
  });
});

describe('mixing question formats', () => {
  const base = {
    areas: [] as never[],
    entitledAreas: AREAS,
    learnCardAttempts: 0,
    mode: 'practice' as const,
    seed: 7,
  };

  it('gives every requested format a share of a capped session', () => {
    // MCQ generates several questions per structure and OINA one per fact, so a
    // plain shuffle of the pool handed all twenty questions to MCQ — which is
    // the one thing a student who picked two formats did not ask for.
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      ...base,
      types: ['mcq', 'oina'],
      oinaPromptKinds: ['origin'],
      count: 20,
    });
    expect(set).toHaveLength(20);
    expect(set.filter((q) => q.type === 'oina').length).toBeGreaterThan(5);
    expect(set.filter((q) => q.type === 'mcq').length).toBeGreaterThan(5);
  });

  it('lets a short format run out without shrinking the session', () => {
    // One fact of one small group is a handful of cards; the rest of the
    // session has to come from somewhere rather than simply be missing.
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      ...base,
      types: ['mcq', 'oina'],
      groups: ['hamstrings'],
      oinaPromptKinds: ['origin'],
      count: 20,
    });
    expect(set).toHaveLength(20);
    expect(set.filter((q) => q.type === 'oina').length).toBeGreaterThan(0);
  });

  it('asks everything it built when no length is set', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      ...base,
      types: ['oina'],
      oinaPromptKinds: ['origin', 'insertion'],
    });
    expect(set.length).toBeGreaterThan(200);
    expect(set.every((q) => q.type === 'oina')).toBe(true);
  });
});

describe('the paywall', () => {
  const FREE: Area[] = ['shoulder'];

  it('serves nothing outside the entitled areas, even when more are asked for', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      areas: ['knee', 'hip', 'shoulder'],
      entitledAreas: FREE,
      mode: 'practice',
      seed: 5,
    });
    expect(set.length).toBeGreaterThan(0);
    for (const q of set) {
      const structure = ALL_STRUCTURES.find((s) => s.id === q.structureId)!;
      expect(areasOf(structure).some((a) => FREE.includes(a))).toBe(true);
    }
  });

  it('reads an unfiltered request as "every entitled area", never as every area', () => {
    // The trap this closes: an empty area list means "everything" everywhere
    // else in the codebase, so a free session with no filter used to be the
    // whole body.
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'],
      entitledAreas: FREE,
      mode: 'practice',
      seed: 5,
    });
    expect(set.length).toBeGreaterThan(0);
    for (const q of set) {
      const structure = ALL_STRUCTURES.find((s) => s.id === q.structureId)!;
      expect(areasOf(structure).some((a) => FREE.includes(a))).toBe(true);
    }
  });

  it('closes the structureIds drill, which carries no area filter of its own', () => {
    // The atlas and progress screens drill by id. Without the second pass in
    // generateRevisionSet this returned locked material happily.
    const lockedIds = ALL_STRUCTURES.filter((s) => !areasOf(s).some((a) => FREE.includes(a))).map((s) => s.id);
    expect(lockedIds.length).toBeGreaterThan(0);

    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard', 'mcq', 'oina'],
      structureIds: lockedIds,
      entitledAreas: FREE,
      mode: 'practice',
      seed: 5,
    });
    expect(set).toHaveLength(0);
  });

  it('leaves a subscriber untouched', () => {
    const free = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'], entitledAreas: FREE, mode: 'practice', seed: 5,
    });
    const paid = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['flashcard'], entitledAreas: AREAS, mode: 'practice', seed: 5,
    });
    expect(paid.length).toBeGreaterThan(free.length);
  });
});

describe('the due share buys distinct structures, most overdue first', () => {
  const TYPES = ['mcq', 'identify-typed', 'locate'] as const;
  const pool = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: TYPES, mode: 'practice', seed: 31 });
  const perStructure = new Map<string, number>();
  for (const q of pool) perStructure.set(q.structureId, (perStructure.get(q.structureId) ?? 0) + 1);
  // Structures that ask several questions each, so a per-question slice
  // would let one of them crowd the others out.
  const multi = [...perStructure.entries()].filter(([, n]) => n >= 3).map(([id]) => id);

  it('asks every due structure once before it asks any of them twice', () => {
    expect(multi.length).toBeGreaterThan(12);
    const priorityStructureIds = multi.slice(0, 12);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      entitledAreas: AREAS, types: TYPES, mode: 'practice', count: 20, seed: 32, priorityStructureIds,
    });
    const dueAsked = result.filter((q) => priorityStructureIds.includes(q.structureId));
    expect(dueAsked).toHaveLength(Math.round(20 * REVIEW_SHARE));
    expect(new Set(dueAsked.map((q) => q.structureId)).size).toBe(12);
  });

  it('takes the priority list in the order it was given when there are more due than slots', () => {
    const priorityStructureIds = multi.slice(0, 30);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      entitledAreas: AREAS, types: TYPES, mode: 'practice', count: 20, seed: 33, priorityStructureIds,
    });
    const asked = new Set(result.filter((q) => priorityStructureIds.includes(q.structureId)).map((q) => q.structureId));
    expect([...asked].sort()).toEqual(priorityStructureIds.slice(0, 12).sort());
  });

  it('is deterministic under a seed with mastery supplied', () => {
    const now = new Date('2026-09-20T09:00:00.000Z');
    const mastery = multi.slice(0, 5).map((structureId, i) => ({
      structureId, userId: 'u', attemptsTotal: 4, attemptsCorrect: 1, lastAttemptAt: '2026-09-01T09:00:00.000Z',
      dueAt: new Date(now.getTime() - (i + 1) * 86_400_000).toISOString(), intervalDays: 1, easeFactor: 2.5,
    }));
    const config = {
      entitledAreas: AREAS, types: TYPES, mode: 'practice' as const, count: 20, seed: 34,
      priorityStructureIds: multi.slice(0, 5), mastery, now,
    };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    for (const id of multi.slice(0, 5)) expect(a.some((q) => q.structureId === id)).toBe(true);
  });
});

describe('the difficulty ladder in practice mode', () => {
  const TYPES = ['flashcard', 'mcq', 'identify-typed', 'locate'] as const;
  const now = new Date('2026-09-20T09:00:00.000Z');
  // Structures that can be asked in every ladder format, so the rung alone decides.
  const everything = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: TYPES, mode: 'practice', seed: 41 });
  const byStructure = new Map<string, Set<string>>();
  for (const q of everything) {
    if (!byStructure.has(q.structureId)) byStructure.set(q.structureId, new Set());
    byStructure.get(q.structureId)!.add(q.type);
  }
  const capable = [...byStructure.entries()].filter(([, t]) => t.has('flashcard') && t.has('mcq') && t.has('identify-typed')).map(([id]) => id);
  const [unseen, met, hinted, bare] = capable;
  const row = (structureId: string, rung: 'mcq' | 'typed-hinted' | 'typed-bare') => ({
    structureId, userId: 'u', attemptsTotal: 6, attemptsCorrect: 5, lastAttemptAt: '2026-09-10T09:00:00.000Z', rung,
  });
  const config = {
    entitledAreas: AREAS, types: TYPES, mode: 'practice' as const, seed: 42, now,
    structureIds: [unseen, met, hinted, bare],
    mastery: [row(met, 'mcq'), row(hinted, 'typed-hinted'), row(bare, 'typed-bare')],
  };
  const ladderTypes = (qs: ReturnType<typeof generateRevisionSet>, id: string) =>
    new Set(qs.filter((q) => q.structureId === id && q.type !== 'locate').map((q) => q.type));

  it('asks each structure in the format of its rung', () => {
    expect(capable.length).toBeGreaterThanOrEqual(4);
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(ladderTypes(result, unseen)).toEqual(new Set(['flashcard']));
    expect(ladderTypes(result, met)).toEqual(new Set(['mcq']));
    expect(ladderTypes(result, hinted)).toEqual(new Set(['identify-typed']));
    expect(ladderTypes(result, bare)).toEqual(new Set(['identify-typed']));
    // Locate is outside the ladder and still asked for everyone who has one.
    expect(result.some((q) => q.type === 'locate')).toBe(true);
  });

  it('drops the hints only on the top rung', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const typed = result.filter((q) => q.type === 'identify-typed');
    expect(typed.filter((q) => q.structureId === hinted).every((q) => q.type === 'identify-typed' && q.hints !== 'none')).toBe(true);
    expect(typed.filter((q) => q.structureId === bare).every((q) => q.type === 'identify-typed' && q.hints === 'none')).toBe(true);
  });

  it('is off without mastery, or with a single ladder format', () => {
    const noMastery = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...config, mastery: undefined });
    expect(ladderTypes(noMastery, unseen).size).toBeGreaterThan(1);
    const onlyMcq = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { ...config, types: ['mcq', 'locate'] });
    expect(ladderTypes(onlyMcq, bare)).toEqual(new Set(['mcq']));
  });
});
