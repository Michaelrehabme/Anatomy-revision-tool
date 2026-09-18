import { describe, expect, it } from 'vitest';
import { INACTIVITY_MONTHS, INACTIVITY_LABEL, dormantBefore, isDormant } from '../retention';

/**
 * This module exists because a published promise and an empty codebase drifted
 * apart for months without anything noticing. What is worth pinning is the
 * cases where "delete it" would be the wrong answer.
 */

const NOW = new Date('2027-06-15T12:00:00.000Z');

describe('dormantBefore', () => {
  it('is the retention period back from now', () => {
    expect(dormantBefore(NOW).toISOString().slice(0, 10)).toBe('2025-06-15');
  });

  it('matches the published period', () => {
    expect(INACTIVITY_MONTHS).toBe(24);
    expect(INACTIVITY_LABEL).toBe('24 months of inactivity');
  });
});

describe('isDormant', () => {
  it('is true a day past the cutoff', () => {
    expect(isDormant('2025-06-14T00:00:00.000Z', NOW)).toBe(true);
  });

  it('is false a day inside it', () => {
    expect(isDormant('2025-06-16T00:00:00.000Z', NOW)).toBe(false);
  });

  it('never deletes an account with no recorded activity', () => {
    // A missing field is not evidence of dormancy — it is evidence of a
    // missing field, and the cost of guessing wrong is a student's history.
    expect(isDormant(null, NOW)).toBe(false);
    expect(isDormant(undefined, NOW)).toBe(false);
  });

  it('never deletes on an unparseable date', () => {
    expect(isDormant('not a date', NOW)).toBe(false);
  });

  it('accepts a Date as readily as an ISO string', () => {
    expect(isDormant(new Date('2020-01-01T00:00:00.000Z'), NOW)).toBe(true);
  });
});
