import { describe, it, expect } from 'vitest';
import type { MuscleStructure, JointStructure } from '../../types/structure';
import { buildClinicalQuestions } from '../questionGenerators/clinical';
import { createRng } from '../rng';
import { isMcqQuestion } from '../../types/question';

function muscle(overrides: Partial<MuscleStructure> & { id: string; name: string }): MuscleStructure {
  return {
    category: 'muscle',
    region: 'shoulder-arm',
    subregion: 'shoulder',
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
    ...overrides,
  };
}

const DELTOID = muscle({
  id: 'deltoid',
  name: 'Deltoid',
  myotome: ['C5'],
  palpationNotes: 'Palpate the rounded contour over the lateral shoulder, distal to the acromion.',
  specialTests: [{ name: 'Empty Can Test', description: 'Resisted abduction at 90°, thumbs down.', positiveFinding: 'Pain or weakness.' }],
  commonInjuries: [{ name: 'Deltoid strain', mechanism: 'Overuse in overhead athletes.', presentation: 'Pain with resisted abduction.' }],
  functionalContext: 'Abducting the arm beyond the first 15 degrees, e.g. reaching overhead.',
});

const SUPRASPINATUS = muscle({
  id: 'supraspinatus',
  name: 'Supraspinatus',
  myotome: ['C5', 'C6'],
  palpationNotes: 'Palpate in the supraspinous fossa, superior to the scapular spine.',
  specialTests: [{ name: "Jobe's Test", description: 'Resisted abduction at 90°, scapular plane, thumbs down.', positiveFinding: 'Pain or weakness.' }],
  commonInjuries: [{ name: 'Rotator cuff tear', mechanism: 'Degenerative or traumatic tear.', presentation: 'A patient cannot initiate shoulder abduction.' }],
  functionalContext: 'Initiating the first 15 degrees of shoulder abduction.',
});

const BICEPS = muscle({
  id: 'biceps-brachii',
  name: 'Biceps brachii',
  subregion: 'elbow',
  myotome: ['C5', 'C6'],
  functionalContext: 'Supinating the forearm and flexing the elbow, e.g. turning a key.',
});

const NO_CLINICAL_CONTENT = muscle({ id: 'brachialis', name: 'Brachialis' });

function joint(overrides: Partial<JointStructure> & { id: string; name: string }): JointStructure {
  return {
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'shoulder',
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: [],
    jointType: 'ball-and-socket',
    articulatingStructureIds: [],
    movements: [],
    ...overrides,
  };
}

const GLENOHUMERAL = joint({
  id: 'glenohumeral-joint',
  name: 'Glenohumeral Joint',
  commonInjuries: [{ name: 'Anterior dislocation', mechanism: 'Fall on an abducted, externally rotated arm.', presentation: 'Loss of the normal deltoid contour and the arm held in abduction/external rotation.' }],
});

const FIXTURE = [DELTOID, SUPRASPINATUS, BICEPS, NO_CLINICAL_CONTENT, GLENOHUMERAL];

describe('buildClinicalQuestions', () => {
  it('generates nothing for a structure with no authored clinical fields', () => {
    const result = buildClinicalQuestions([NO_CLINICAL_CONTENT], createRng(1));
    expect(result).toEqual([]);
  });

  it('is deterministic given the same seed', () => {
    const a = buildClinicalQuestions(FIXTURE, createRng(7));
    const b = buildClinicalQuestions(FIXTURE, createRng(7));
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('generates a myotome question for every structure with a myotome field', () => {
    const result = buildClinicalQuestions(FIXTURE, createRng(2));
    expect(result.some((q) => q.id === 'clinical-deltoid-myotome')).toBe(true);
    expect(result.some((q) => q.id === 'clinical-biceps-brachii-myotome')).toBe(true);
  });

  it('generates a special-test question with the correct answer among the choices', () => {
    const result = buildClinicalQuestions(FIXTURE, createRng(4));
    const q = result.find((r) => r.id === 'clinical-supraspinatus-special-test-jobe\'s-test');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.choices[q.correctIndex]).toBe("Jobe's Test");
  });

  it('generates a clinical vignette (injury-mechanism) question using the presentation text', () => {
    const result = buildClinicalQuestions(FIXTURE, createRng(6));
    const q = result.find((r) => r.promptKind === 'injury-mechanism' && r.structureId === 'supraspinatus');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.prompt).toContain('cannot initiate shoulder abduction');
    expect(q.choices[q.correctIndex]).toBe('Supraspinatus');
  });

  it('generates an injury-mechanism question for a non-muscle structure too (CR-014: not muscle-only)', () => {
    const result = buildClinicalQuestions(FIXTURE, createRng(11));
    const q = result.find((r) => r.promptKind === 'injury-mechanism' && r.structureId === 'glenohumeral-joint');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.prompt).toContain('deltoid contour');
    expect(q.choices[q.correctIndex]).toBe('Glenohumeral Joint');
  });

  it('every MCQ choice list has the correct answer exactly once, with no duplicates', () => {
    const result = buildClinicalQuestions(FIXTURE, createRng(9));
    for (const q of result) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });
});
