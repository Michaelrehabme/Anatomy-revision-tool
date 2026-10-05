import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES, AUTHORED_STRUCTURES } from '../../data/seed';
import { buildStructureIndex } from '../../data/content/split';
import { linkImages } from '../linkImages';
import { buildPictureNameQuestions } from '../questionGenerators/pictureName';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildDiagnostic, buildDiagnosticQuestions, DIAGNOSTIC_SIZE } from '../diagnostic';
import { createRng } from '../rng';
import { AREAS } from '../../types/region';
import { STRUCTURE_FACT_FIELDS } from '../../types/structureIndex';
import type { MCQQuestion } from '../../types/question';

/**
 * Picture-to-name questions from the index alone, and the diagnostic built
 * from them (docs/CONTENT-SERVER-STATUS.md, decision 7).
 *
 * The index here is the one a server build holds: cut from the seed, through
 * JSON, linked to the pictures. No structure in it has a fact, so anything
 * these questions print was in the index.
 */
const index = linkImages(
  JSON.parse(JSON.stringify(buildStructureIndex(AUTHORED_STRUCTURES))) as ReturnType<typeof buildStructureIndex>,
  ALL_IMAGES,
);
const questions = buildPictureNameQuestions(index, ALL_IMAGES, createRng(1));

const fullPool = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
  types: ['mcq'], mode: 'practice', seed: 1, entitledAreas: AREAS,
}).filter((q): q is MCQQuestion => q.type === 'mcq');

describe('picture-to-name questions from the index', () => {
  it('are built from structures that carry no facts', () => {
    const facts = new Set<string>(STRUCTURE_FACT_FIELDS);
    expect(index.flatMap((e) => Object.keys(e).filter((k) => facts.has(k)))).toEqual([]);
    expect(questions.length).toBeGreaterThan(300);
  });

  it('show a picture, offer the right name among distinct names, and state nothing else', () => {
    const names = new Set(index.map((e) => e.name));
    const nameOf = new Map(index.map((e) => [e.id, e.name]));
    for (const q of questions) {
      expect(q.promptKind).toBe('identify');
      expect(q.promptImageId, q.id).toBeTruthy();
      expect(q.choices[q.correctIndex], q.id).toBe(nameOf.get(q.structureId));
      expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
      expect(q.choices.every((c) => names.has(c)), q.id).toBe(true);
      expect(q.choices.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.explanation).toBe('');
    }
  });

  it('use the ordinary question ids, so a sitting can be replayed either way', () => {
    const fullIds = new Set(fullPool.map((q) => q.id));
    expect(questions.filter((q) => !fullIds.has(q.id)).map((q) => q.id)).toEqual([]);
  });

  it('are the same every time under a seed', () => {
    expect(buildPictureNameQuestions(index, ALL_IMAGES, createRng(1))).toEqual(questions);
  });
});

describe('the diagnostic when the sitter does not hold every area', () => {
  const cohorts = ['y2-physio-2026', 'cohort-a', 'demo-cohort-physio-y2'];

  it('asks about the same fifteen structures as the full paper', () => {
    for (const cohortId of cohorts) {
      expect(buildDiagnostic(index, cohortId)).toEqual(buildDiagnostic(ALL_STRUCTURES, cohortId));
    }
  });

  it('is a paper of picture-to-name questions only', () => {
    for (const cohortId of cohorts) {
      const spec = buildDiagnostic(index, cohortId);
      const paper = buildDiagnosticQuestions(spec, questions);
      expect(paper.length, cohortId).toBeGreaterThan(0);
      expect(paper.length, cohortId).toBeLessThanOrEqual(DIAGNOSTIC_SIZE);
      expect(paper.every((q) => q.promptKind === 'identify' && !!q.promptImageId && q.choices.length === 4)).toBe(true);
    }
  });

  // What changes for a class, stated as a test: the full paper mixes kinds of
  // question; this one does not. Two students in one class who hold different
  // areas are therefore not sitting the same paper.
  it('is NOT the paper a student holding every area sits', () => {
    const spec = buildDiagnostic(ALL_STRUCTURES, cohorts[0]);
    const full = buildDiagnosticQuestions(spec, fullPool);
    const partial = buildDiagnosticQuestions(spec, questions);
    expect(new Set(full.map((q) => q.promptKind)).size).toBeGreaterThan(1);
    expect(new Set(partial.map((q) => q.promptKind))).toEqual(new Set(['identify']));
  });

  it('replays a picture-only baseline exactly, by id, once the facts have arrived', () => {
    const spec = buildDiagnostic(ALL_STRUCTURES, cohorts[0]);
    const baseline = buildDiagnosticQuestions(spec, questions).map((q) => q.id);
    expect(buildDiagnosticQuestions(spec, fullPool, baseline).map((q) => q.id)).toEqual(baseline);
  });

  // The other direction cannot hold: a baseline sat with every area in hand
  // asked about nerves and origins, and a follow-up without the facts has no
  // way to ask those again. They are dropped, and the follow-up is shorter.
  it('cannot replay the fact questions of a mixed baseline without the facts', () => {
    const spec = buildDiagnostic(ALL_STRUCTURES, cohorts[0]);
    const baseline = buildDiagnosticQuestions(spec, fullPool);
    const followUp = buildDiagnosticQuestions(spec, questions, baseline.map((q) => q.id));
    expect(followUp).toHaveLength(baseline.filter((q) => q.promptImageId).length);
    expect(followUp.length).toBeLessThan(baseline.length);
  });
});
