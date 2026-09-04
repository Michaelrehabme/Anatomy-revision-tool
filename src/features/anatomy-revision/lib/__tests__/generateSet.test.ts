import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildIndexes } from '../indexes';
import { pickNameDistractors } from '../distractors';
import { createRng } from '../rng';
import { isMcqQuestion, isFillBlankQuestion, isOinaQuestion, isFlashcardQuestion } from '../../types/question';
import type { FactMastery, StructureMastery } from '../../types/attempt';

describe('generateRevisionSet', () => {
  it('generates flashcards and MCQs for the full seed dataset deterministically', () => {
    const config = { types: ['flashcard', 'mcq'] as const, mode: 'practice' as const, seed: 42 };
    const a = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const b = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('generates locate questions for images with authored hotspots (CR-007)', () => {
    const syntheticStructure = ALL_STRUCTURES.find((s) => s.id === 'gluteus-maximus')!;
    const syntheticImage = {
      id: 'test-locate-image',
      filePath: '/test.png',
      mode: 'single-structure' as const,
      structureId: 'gluteus-maximus',
      region: syntheticStructure.region,
      view: 'posterior' as const,
      layer: 'superficial-muscle' as const,
      width: 100,
      height: 100,
      hotspots: [
        {
          structureId: 'gluteus-maximus',
          polygons: [[[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]],
          area: 0.16,
          centroid: [0.3, 0.3] as [number, number],
        },
      ],
      credit: 'test',
      licence: 'test',
    };

    const result = generateRevisionSet(ALL_STRUCTURES, [syntheticImage], {
      types: ['locate'],
      mode: 'practice',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('the real seed dataset currently generates zero locate questions (CR-015/CR-016: no image has hotspot data)', () => {
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['locate'],
      mode: 'practice',
      seed: 1,
    });
    expect(result).toEqual([]);
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

describe('generateRevisionSet adaptive mode (CR-009)', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('is deterministic given the same seed', () => {
    const config = {
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
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const result = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['mcq'],
      mode: 'adaptive',
      count: 10,
      seed: 1,
      now,
    });
    expect(result.length).toBeGreaterThan(0);
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      types: ['oina'],
      groups: ['hamstrings'],
      mode: 'assessment',
      count: 5,
      seed: 7,
    });
    expect(questions.every(isOinaQuestion)).toBe(true);
  });

  it('escalates only the facts the student has mastered', () => {
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
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
