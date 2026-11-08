import { describe, expect, it } from 'vitest';
import { actionWithoutAttachment, buildMcqQuestions } from '../questionGenerators/mcq';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';

describe('an action question', () => {
  it('drops the attachment from an action sentence (student report, 3 Nov 2026)', () => {
    expect(actionWithoutAttachment('Laterally flexes the neck and assists inspiration; arises from the transverse processes C3–C6.')).toBe(
      'Laterally flexes the neck and assists inspiration.',
    );
    expect(actionWithoutAttachment('Extends the hip; flexes the knee; inserts on the medial condyle of the tibia.')).toBe('Extends the hip; flexes the knee.');
    expect(actionWithoutAttachment('Flexes the elbow.')).toBe('Flexes the elbow.');
  });

  it('names no attachment in any choice, and every choice is different', () => {
    const questions = buildMcqQuestions(ALL_STRUCTURES, ALL_IMAGES, buildIndexes(ALL_STRUCTURES), createRng(7), { promptKinds: ['action'] });
    expect(questions.length).toBeGreaterThan(100);
    for (const q of questions) {
      for (const choice of q.choices) expect(choice, q.id).not.toMatch(/arises from|inserts on/);
      expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
    }
    const scalene = questions.find((q) => q.id === 'mcq-scalene-anterior-action')!;
    expect(scalene.choices[scalene.correctIndex]).toBe('Laterally flexes the neck and assists inspiration.');
  });
});
