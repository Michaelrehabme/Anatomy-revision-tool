import { describe, it, expect } from 'vitest';
import type { UserAttempt } from '../../types/attempt';
import type { Area } from '../../types/region';
import { filteredAccuracy, formatOfAttempt, NO_PROGRESS_FILTER, progressFilterCounts, type ProgressFilter } from '../attemptFilter';

let minute = 0;
function attempt(overrides: Partial<UserAttempt>): UserAttempt {
  minute += 1;
  return {
    id: `a${minute}`,
    userId: 'u1',
    sessionId: 's1',
    questionId: 'q1',
    questionType: 'mcq',
    structureId: 'deltoid',
    promptKind: 'identify',
    region: 'shoulder-arm',
    category: 'muscle',
    correct: true,
    attemptNumber: 1,
    timestamp: new Date(Date.UTC(2026, 9, 1, 9, minute)).toISOString(),
    ...overrides,
  };
}

const areas = new Map<string, readonly Area[]>([
  ['deltoid', ['shoulder']],
  ['patella', ['knee']],
  ['pedicle', ['cervical-spine', 'thoracic-spine', 'lumbar-spine']],
]);

const only = (filter: Partial<ProgressFilter>): ProgressFilter => ({ ...NO_PROGRESS_FILTER, ...filter });

describe('formatOfAttempt', () => {
  it('reads typed naming by its stored hints, and an unstamped row as hinted', () => {
    expect(formatOfAttempt(attempt({ questionType: 'identify-typed', hints: 'none' }))).toBe('typed-bare');
    expect(formatOfAttempt(attempt({ questionType: 'identify-typed', hints: 'full' }))).toBe('typed-hinted');
    expect(formatOfAttempt(attempt({ questionType: 'identify-typed' }))).toBe('typed-hinted');
  });

  it('reads a fact card by the stage in its question id', () => {
    expect(formatOfAttempt(attempt({ questionType: 'oina', questionId: 'oina-deltoid-origin-select' }))).toBe('mcq');
    expect(formatOfAttempt(attempt({ questionType: 'oina', questionId: 'oina-deltoid-origin-typed', hints: 'full' }))).toBe('typed-hinted');
    // No hints stored: typed facts ran bare before their hinted stage existed.
    expect(formatOfAttempt(attempt({ questionType: 'oina', questionId: 'oina-deltoid-origin-typed' }))).toBe('typed-bare');
  });

  it('counts anything chosen from a list as multiple choice, and a flashcard as nothing', () => {
    expect(formatOfAttempt(attempt({ questionType: 'multi-select' }))).toBe('mcq');
    expect(formatOfAttempt(attempt({ questionType: 'locate' }))).toBe('locate');
    expect(formatOfAttempt(attempt({ questionType: 'flashcard' }))).toBeNull();
  });
});

describe('filteredAccuracy', () => {
  it('keeps everything with no filter', () => {
    const graded = [attempt({}), attempt({ correct: false }), attempt({ structureId: 'patella' })];
    const result = filteredAccuracy(graded, NO_PROGRESS_FILTER, areas);
    expect(result.all).toEqual({ total: 3, pct: 67 });
    expect(result.firstSight.total).toBe(2);
    expect(result.seenBefore.total).toBe(1);
  });

  it('narrows by format and by area together', () => {
    const graded = [
      attempt({ questionType: 'locate', correct: false }),
      attempt({ questionType: 'locate', structureId: 'patella' }),
      attempt({ questionType: 'mcq', structureId: 'patella', correct: false }),
    ];
    expect(filteredAccuracy(graded, only({ formats: new Set(['locate']) }), areas).all).toEqual({ total: 2, pct: 50 });
    expect(filteredAccuracy(graded, only({ areas: new Set<Area>(['knee']) }), areas).all).toEqual({ total: 2, pct: 50 });
    expect(filteredAccuracy(graded, only({ formats: new Set(['locate']), areas: new Set<Area>(['knee']) }), areas).all).toEqual({
      total: 1,
      pct: 100,
    });
  });

  it('decides first sight over the whole history, not over what the filter keeps', () => {
    // Met by multiple choice first; the typed answer after it is a repeat.
    const graded = [attempt({ questionType: 'mcq' }), attempt({ questionType: 'identify-typed', hints: 'none' })];
    const result = filteredAccuracy(graded, only({ formats: new Set(['typed-bare']) }), areas);
    expect(result.firstSight.total).toBe(0);
    expect(result.seenBefore.total).toBe(1);
  });

  it('counts a structure in several areas under each of them', () => {
    const graded = [attempt({ structureId: 'pedicle' })];
    expect(filteredAccuracy(graded, only({ areas: new Set<Area>(['lumbar-spine']) }), areas).all.total).toBe(1);
    expect(progressFilterCounts(graded, areas).areas).toEqual({ 'cervical-spine': 1, 'thoracic-spine': 1, 'lumbar-spine': 1 });
  });

  it('reports nothing rather than zero percent when the filter keeps no answers', () => {
    const result = filteredAccuracy([attempt({})], only({ formats: new Set(['locate']) }), areas);
    expect(result.all).toEqual({ total: 0, pct: null });
    expect(result.trend.seenBeforeTrend).toEqual([]);
    expect(result.delta).toBeNull();
    expect(result.from).toBeNull();
  });

  it('keeps the most recent answers that match, and says which dates they span', () => {
    const graded = [
      attempt({ questionType: 'locate', correct: false }),
      attempt({ questionType: 'mcq' }),
      attempt({ questionType: 'locate' }),
      attempt({ questionType: 'mcq' }),
      attempt({ questionType: 'locate' }),
    ];
    // The last two LOCATE answers, not the locate answers among the last two.
    const result = filteredAccuracy(graded, only({ formats: new Set(['locate']), last: 2 }), areas);
    expect(result.all).toEqual({ total: 2, pct: 100 });
    expect(result.from).toBe(graded[2].timestamp);
    expect(result.to).toBe(graded[4].timestamp);
    // Asking for more than there is gives what there is.
    expect(filteredAccuracy(graded, only({ last: 100 }), areas).all.total).toBe(5);
  });
});
