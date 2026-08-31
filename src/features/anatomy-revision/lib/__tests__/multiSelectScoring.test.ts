import { describe, it, expect } from 'vitest';
import { scoreMultiSelect } from '../multiSelectScoring';

describe('scoreMultiSelect', () => {
  it('scores a perfect selection as 1', () => {
    const result = scoreMultiSelect([0, 2], [0, 2]);
    expect(result.score).toBe(1);
    expect(result.isFullyCorrect).toBe(true);
  });

  it('scores an empty selection as 0', () => {
    const result = scoreMultiSelect([0, 2], []);
    expect(result.score).toBe(0);
    expect(result.isFullyCorrect).toBe(false);
  });

  it('gives partial credit for a partial correct selection with no wrong picks', () => {
    const result = scoreMultiSelect([0, 1, 2, 3], [0, 1]);
    expect(result.score).toBe(0.5);
    expect(result.isFullyCorrect).toBe(false);
  });

  it('penalizes an incorrect selection against the correct ones picked', () => {
    const result = scoreMultiSelect([0, 1], [0, 2]); // 1 correct, 1 wrong, out of 2 correct total
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
    expect(result.score).toBe(0); // (1-1)/2 = 0
  });

  it('floors the score at 0 rather than going negative', () => {
    const result = scoreMultiSelect([0], [1, 2, 3]); // 0 correct, 3 wrong, 1 correct total
    expect(result.score).toBe(0);
  });

  it('selecting everything scores no better than selecting nothing when all are wrong', () => {
    const allWrong = scoreMultiSelect([0], [1, 2]);
    const nothing = scoreMultiSelect([0], []);
    expect(allWrong.score).toBe(nothing.score);
  });

  it('returns 0 when there are no correct answers to begin with (degenerate input)', () => {
    const result = scoreMultiSelect([], [0, 1]);
    expect(result.score).toBe(0);
    expect(result.totalCorrect).toBe(0);
  });
});
