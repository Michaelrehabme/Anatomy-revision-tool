import { describe, it, expect } from 'vitest';
import { evaluateAchievements, type AchievementStats, type AchievementDoc, type AchievementId } from '../achievements';

const now = new Date('2026-08-25T12:00:00.000Z');

function baseStats(overrides: Partial<AchievementStats> = {}): AchievementStats {
  return {
    currentStreak: 0,
    xpToday: 0,
    fastestCorrectAnswerMs: null,
    structuresMasteredThisWeek: 0,
    attemptedMuscleCount: 0,
    totalMuscleCount: 122,
    masteredStructureCount: 0,
    completedRegionCount: 0,
    questionTypesUsedEver: new Set(),
    ...overrides,
  };
}

describe('evaluateAchievements', () => {
  it('returns nothing for a stats snapshot with no achievements met', () => {
    const result = evaluateAchievements(baseStats(), new Map());
    expect(result).toEqual([]);
  });

  it('awards the longest-streak record on first nonzero streak', () => {
    const result = evaluateAchievements(baseStats({ currentStreak: 3 }), new Map(), now);
    expect(result).toContainEqual({ id: 'record-longest-streak', earnedAt: now.toISOString(), value: 3 });
  });

  it('does not re-award a record that has not improved', () => {
    const existing = new Map<AchievementId, AchievementDoc>([
      ['record-longest-streak', { id: 'record-longest-streak', earnedAt: '2026-08-01T00:00:00.000Z', value: 5 }],
    ]);
    const result = evaluateAchievements(baseStats({ currentStreak: 3 }), existing, now);
    expect(result.find((u) => u.id === 'record-longest-streak')).toBeUndefined();
  });

  it('re-awards a record once it is beaten, refreshing earnedAt and value', () => {
    const existing = new Map<AchievementId, AchievementDoc>([
      ['record-longest-streak', { id: 'record-longest-streak', earnedAt: '2026-08-01T00:00:00.000Z', value: 5 }],
    ]);
    const result = evaluateAchievements(baseStats({ currentStreak: 6 }), existing, now);
    expect(result).toContainEqual({ id: 'record-longest-streak', earnedAt: now.toISOString(), value: 6 });
  });

  it('treats the fastest-correct-answer record as lower-is-better', () => {
    const existing = new Map<AchievementId, AchievementDoc>([
      ['record-fastest-correct-answer-ms', { id: 'record-fastest-correct-answer-ms', earnedAt: '2026-08-01T00:00:00.000Z', value: 2000 }],
    ]);
    const slower = evaluateAchievements(baseStats({ fastestCorrectAnswerMs: 3000 }), existing, now);
    expect(slower.find((u) => u.id === 'record-fastest-correct-answer-ms')).toBeUndefined();

    const faster = evaluateAchievements(baseStats({ fastestCorrectAnswerMs: 900 }), existing, now);
    expect(faster).toContainEqual({ id: 'record-fastest-correct-answer-ms', earnedAt: now.toISOString(), value: 900 });
  });

  it('ignores a null fastest-correct-answer reading', () => {
    const result = evaluateAchievements(baseStats({ fastestCorrectAnswerMs: null }), new Map(), now);
    expect(result.find((u) => u.id === 'record-fastest-correct-answer-ms')).toBeUndefined();
  });

  it('awards the all-muscles-attempted milestone only once every muscle has been attempted', () => {
    const partial = evaluateAchievements(baseStats({ attemptedMuscleCount: 121, totalMuscleCount: 122 }), new Map(), now);
    expect(partial.find((u) => u.id === 'milestone-all-muscles-attempted')).toBeUndefined();

    const complete = evaluateAchievements(baseStats({ attemptedMuscleCount: 122, totalMuscleCount: 122 }), new Map(), now);
    expect(complete).toContainEqual({ id: 'milestone-all-muscles-attempted', earnedAt: now.toISOString() });
  });

  it('never re-awards an already-earned milestone, even if still met', () => {
    const existing = new Map<AchievementId, AchievementDoc>([
      ['milestone-30-day-streak', { id: 'milestone-30-day-streak', earnedAt: '2026-08-01T00:00:00.000Z' }],
    ]);
    const result = evaluateAchievements(baseStats({ currentStreak: 45 }), existing, now);
    expect(result.find((u) => u.id === 'milestone-30-day-streak')).toBeUndefined();
  });

  it('awards the 50-structures-mastered milestone at the threshold', () => {
    const below = evaluateAchievements(baseStats({ masteredStructureCount: 49 }), new Map(), now);
    expect(below.find((u) => u.id === 'milestone-50-structures-mastered')).toBeUndefined();

    const at = evaluateAchievements(baseStats({ masteredStructureCount: 50 }), new Map(), now);
    expect(at).toContainEqual({ id: 'milestone-50-structures-mastered', earnedAt: now.toISOString() });
  });

  it('awards every-angle only once all 5 question types have been used', () => {
    const four = evaluateAchievements(
      baseStats({ questionTypesUsedEver: new Set(['flashcard', 'mcq', 'locate', 'fill-blank']) }),
      new Map(),
      now,
    );
    expect(four.find((u) => u.id === 'milestone-all-question-types-used')).toBeUndefined();

    const five = evaluateAchievements(
      baseStats({ questionTypesUsedEver: new Set(['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed']) }),
      new Map(),
      now,
    );
    expect(five).toContainEqual({ id: 'milestone-all-question-types-used', earnedAt: now.toISOString() });
  });

  it('awards first-region-completed as soon as any region is complete', () => {
    const result = evaluateAchievements(baseStats({ completedRegionCount: 1 }), new Map(), now);
    expect(result).toContainEqual({ id: 'milestone-first-region-completed', earnedAt: now.toISOString() });
  });
});
