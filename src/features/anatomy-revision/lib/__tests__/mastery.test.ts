import { describe, it, expect } from 'vitest';
import { computeNextReview } from '../mastery';

describe('computeNextReview', () => {
  it('grows the interval on an easy rating', () => {
    const first = computeNextReview(undefined, 'easy');
    const second = computeNextReview(
      { intervalDays: first.intervalDays, easeFactor: first.easeFactor },
      'easy',
    );
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
  });

  it('resets the interval to 1 day on a hard rating', () => {
    const grown = computeNextReview({ intervalDays: 10, easeFactor: 2.5 }, 'easy');
    const reset = computeNextReview(grown, 'hard');
    expect(reset.intervalDays).toBe(1);
  });

  it('holds the interval steady on a medium rating', () => {
    const result = computeNextReview({ intervalDays: 4, easeFactor: 2.5 }, 'medium');
    expect(result.intervalDays).toBe(4);
  });

  it('never drops ease factor below the floor', () => {
    let mastery = { intervalDays: 1, easeFactor: 1.3 };
    for (let i = 0; i < 5; i++) {
      mastery = computeNextReview(mastery, 'hard');
    }
    expect(mastery.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
