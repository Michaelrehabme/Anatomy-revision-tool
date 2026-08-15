import { describe, it, expect } from 'vitest';
import { isAnswerMatch } from '../answerMatching';

describe('isAnswerMatch', () => {
  it('accepts an exact match', () => {
    expect(isAnswerMatch('Femur', ['Femur'])).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(isAnswerMatch('  femur  ', ['Femur'])).toBe(true);
  });

  it('accepts a single-letter substitution typo', () => {
    expect(isAnswerMatch('Femer', ['Femur'])).toBe(true);
  });

  it('accepts a single missing letter', () => {
    expect(isAnswerMatch('Femr', ['Femur'])).toBe(true);
  });

  it('accepts a single extra letter', () => {
    expect(isAnswerMatch('Femurr', ['Femur'])).toBe(true);
  });

  it('rejects a two-letter typo', () => {
    expect(isAnswerMatch('Fumar', ['Femur'])).toBe(false);
  });

  it('rejects an unrelated word', () => {
    expect(isAnswerMatch('Tibia', ['Femur'])).toBe(false);
  });

  it('rejects an empty answer', () => {
    expect(isAnswerMatch('   ', ['Femur'])).toBe(false);
  });

  it('matches against any of several accepted answers', () => {
    expect(isAnswerMatch('ASIS', ['Anterior superior iliac spine', 'ASIS'])).toBe(true);
  });

  it('tolerates a missing leading article', () => {
    expect(isAnswerMatch('femur', ['the femur'])).toBe(true);
    expect(isAnswerMatch('the femur', ['femur'])).toBe(true);
  });
});
