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

describe('two neighbouring letters swapped', () => {
  it('counts as one letter wrong (24 Oct 2026)', () => {
    expect(isAnswerMatch('intretransversarii', ['Intertransversarii'])).toBe(true);
    expect(isAnswerMatch('intertransverasrii', ['Intertransversarii'])).toBe(true);
    expect(isAnswerMatch('intretransverasrii', ['Intertransversarii'])).toBe(false);
  });
});

describe('a hyphen inside a word', () => {
  it('is optional (student report, 7 Nov 2026)', () => {
    expect(isAnswerMatch('Interosseous sacroiliac ligament', ['Interosseous sacro-iliac ligament'])).toBe(true);
    expect(isAnswerMatch('sacro-iliac joint', ['Sacroiliac joint'])).toBe(true);
  });

  it('still separates a range of levels', () => {
    expect(isAnswerMatch('C3-C6', ['C3–C6'])).toBe(true);
    expect(isAnswerMatch('C3 - C6', ['C3–C6'])).toBe(true);
  });
});

describe('two slips in a long name', () => {
  it('count as a misspelling when letters are doubled, dropped or swapped (owner, 8 Nov 2026)', () => {
    expect(isAnswerMatch('Interroseous sacroiliac ligament', ['Interosseous sacro-iliac ligament'])).toBe(true);
    expect(isAnswerMatch('interosseus sacroilliac ligament', ['Interosseous sacro-iliac ligament'])).toBe(true);
  });

  it('never make one structure another', () => {
    expect(isAnswerMatch('Internal intercostal muscles', ['External intercostal muscles'])).toBe(false);
    expect(isAnswerMatch('Deep transverse metatarsal ligament', ['Deep transverse metacarpal ligament'])).toBe(false);
    expect(isAnswerMatch('Musculus gluteus minimus', ['Musculus gluteus maximus'])).toBe(false);
    expect(isAnswerMatch('Pectoralis minor muscle', ['Pectoralis major muscle'])).toBe(false);
    expect(isAnswerMatch('Musculus triceps brachii', ['Musculus biceps brachii'])).toBe(false);
  });

  it('are not forgiven in a short name', () => {
    expect(isAnswerMatch('interroseus', ['Interosseous'])).toBe(false);
  });
});
