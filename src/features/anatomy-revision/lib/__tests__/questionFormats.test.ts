import { describe, expect, it } from 'vitest';
import {
  QUESTION_FORMATS,
  QUESTION_FORMAT_LABELS,
  promptKindLabel,
  questionHeaderLabel,
} from '../questionFormats';
import { filterStructures } from '../indexes';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { AREAS } from '../../types/region';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import type { PromptKind, QuestionType, RevisionQuestion } from '../../types/question';
import type { Category } from '../../types/structure';

const QUESTION_TYPES: QuestionType[] = [
  'flashcard',
  'mcq',
  'locate',
  'fill-blank',
  'identify-typed',
  'multi-select',
  'oina',
];

const question = (type: QuestionType, promptKind: PromptKind): RevisionQuestion =>
  ({ type, promptKind, region: 'hip-thigh', area: 'knee' }) as RevisionQuestion;

describe('question format labels', () => {
  it('names every question type, so no format can reach a screen unnamed', () => {
    for (const type of QUESTION_TYPES) {
      expect(QUESTION_FORMAT_LABELS[type], type).toBeTruthy();
    }
  });

  it('offers every type except the one that is not ready', () => {
    // fill-blank is generated but 285 of its 294 questions never name the
    // structure they ask about, so it stays out of the picker (CR-035). Every
    // OTHER type must be offered: a type that exists and cannot be chosen is
    // how fill-blank went unnoticed in the first place.
    const offered = QUESTION_FORMATS.map((o) => o.value);
    expect(offered).not.toContain('fill-blank');
    expect([...offered, 'fill-blank'].sort()).toEqual([...QUESTION_TYPES].sort());
  });

  it('still names fill-blank, so a session holding one can print a header', () => {
    expect(QUESTION_FORMAT_LABELS['fill-blank']).toBe('Fill the blank');
  });

  it('uses one word for one format, picker and session alike', () => {
    const labels = QUESTION_FORMATS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the line above a question', () => {
  it('names the format and the place, not the internal prompt kind', () => {
    // It used to read "Identify · Knee" for a format the picker called
    // "Type answer" — the collision this replaced.
    expect(questionHeaderLabel(question('identify-typed', 'identify'))).toBe('Type answer · Knee');
    expect(questionHeaderLabel(question('locate', 'identify'))).toBe('Locate · Knee');
  });

  it('keeps the fact when the format spans several', () => {
    // MCQ asks about eleven different things; dropping the fact would make the
    // header worse than the one it replaced.
    expect(questionHeaderLabel(question('mcq', 'origin'))).toBe('Multiple choice · Origin · Knee');
    expect(questionHeaderLabel(question('mcq', 'nerve'))).toBe('Multiple choice · Nerve · Knee');
    expect(questionHeaderLabel(question('mcq', 'special-test'))).toBe('Multiple choice · Special test · Knee');
    expect(questionHeaderLabel(question('multi-select', 'action'))).toBe('Multi-select · Action · Knee');
  });

  it('drops "identify", which every format does', () => {
    expect(promptKindLabel('identify')).toBeNull();
    expect(promptKindLabel('origin')).toBe('Origin');
  });
});

describe('studying several categories at once', () => {
  const count = (categories?: Category[]) =>
    filterStructures(ALL_STRUCTURES, { categories }).length;

  it('takes the union, not the intersection', () => {
    const bones = count(['bone']);
    const landmarks = count(['landmark']);
    expect(count(['bone', 'landmark'])).toBe(bones + landmarks);
  });

  it('treats an empty list as every category', () => {
    expect(count([])).toBe(ALL_STRUCTURES.length);
    expect(count(undefined)).toBe(ALL_STRUCTURES.length);
  });

  it('still honours a single category the old way', () => {
    expect(filterStructures(ALL_STRUCTURES, { category: 'ligament' }).length).toBe(count(['ligament']));
  });

  it('builds a session from bones and landmarks together', () => {
    // The pair the single-select could not express: the same picture, revised
    // in one sitting.
    const qs = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS,
      types: ['mcq'],
      categories: ['bone', 'landmark'],
      mode: 'practice',
      seed: 1,
    });
    const asked = new Set(qs.map((q) => q.category));
    expect([...asked].sort()).toEqual(['bone', 'landmark']);
  });
});
