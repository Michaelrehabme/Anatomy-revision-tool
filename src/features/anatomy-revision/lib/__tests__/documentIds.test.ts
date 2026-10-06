import { describe, expect, it } from 'vitest';
import { questionDocId } from '../documentIds';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import type { QuestionType } from '../../types/question';
import { AREAS } from '../../types/region';

describe('a question id as a Firestore document id', () => {
  it('has no path separator left in it', () => {
    expect(questionDocId('clinical-biceps-brachii-injury-proximal-biceps-tendinopathy/tear')).toBe(
      'clinical-biceps-brachii-injury-proximal-biceps-tendinopathy_tear',
    );
    expect(questionDocId('mcq-deltoid-origin')).toBe('mcq-deltoid-origin');
  });

  // The guard on the content: whatever a question is called, the id it is
  // stored under must be one Firestore accepts.
  it('is a legal document id for every question the app can build', () => {
    const types: QuestionType[] = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed', 'multi-select', 'oina'];
    const questions = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { types, mode: 'practice', seed: 7, entitledAreas: AREAS });
    expect(questions.length).toBeGreaterThan(1000);
    const bad = questions.map((q) => questionDocId(q.id)).filter((id) => id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id) || id.length === 0);
    expect(bad).toEqual([]);
    // And the reason this file exists: at least one raw id does carry a slash.
    expect(questions.some((q) => q.id.includes('/'))).toBe(true);
  });
});
