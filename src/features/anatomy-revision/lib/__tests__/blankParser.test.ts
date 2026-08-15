import { describe, it, expect } from 'vitest';
import { parseBlank } from '../questionGenerators/blankParser';
import type { Rng } from '../rng';

const alwaysSubject: Rng = () => 0;
const alwaysSite: Rng = () => 0.9;

describe('parseBlank', () => {
  it('splits a "with" articulation statement, blanking the subject when rng picks low', () => {
    const result = parseBlank('Knee joint with the femur', alwaysSubject);
    expect(result).toEqual({ before: '', after: ' with the femur', answer: 'Knee joint' });
  });

  it('splits a "with" articulation statement, blanking the site when rng picks high', () => {
    const result = parseBlank('Knee joint with the femur', alwaysSite);
    expect(result).toEqual({ before: 'Knee joint with the ', after: '', answer: 'femur' });
  });

  it('splits an em-dash attachment statement and strips the trailing role word from the subject blank', () => {
    const result = parseBlank('Gluteus maximus insertion — gluteal tuberosity', alwaysSubject);
    expect(result).toEqual({
      before: '',
      after: ' insertion — gluteal tuberosity',
      answer: 'Gluteus maximus',
    });
  });

  it('splits an em-dash attachment statement, blanking the site with no leading article to strip', () => {
    const result = parseBlank('Gluteus maximus insertion — gluteal tuberosity', alwaysSite);
    expect(result).toEqual({
      before: 'Gluteus maximus insertion — ',
      after: '',
      answer: 'gluteal tuberosity',
    });
  });

  it('blanks the subject of a role-word-only statement with no site clause', () => {
    const result = parseBlank('Gluteus medius insertion', alwaysSubject);
    expect(result).toEqual({ before: '', after: ' insertion', answer: 'Gluteus medius' });
  });

  it('strips a trailing parenthetical before matching the role word', () => {
    const result = parseBlank('Deltoid origin (acromial part)', alwaysSubject);
    expect(result).toEqual({ before: '', after: ' origin', answer: 'Deltoid' });
  });

  it('returns null for a full-sentence statement with no connector or role word', () => {
    expect(parseBlank('Glenoid labrum (fibrocartilage rim) deepens the socket', alwaysSubject)).toBeNull();
  });

  it('returns null when a verb precedes the role word (not a clean noun-phrase subject)', () => {
    expect(parseBlank('Latissimus dorsi has a variable attachment here', alwaysSubject)).toBeNull();
  });
});
