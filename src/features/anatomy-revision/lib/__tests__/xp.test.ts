import { describe, it, expect } from 'vitest';
import { xpForAnswer, streakMultiplier, computeSessionXp, DEFAULT_XP_CONFIG } from '../xp';

describe('xpForAnswer', () => {
  it('awards 0 XP for an incorrect answer regardless of type', () => {
    expect(xpForAnswer(false, 'identify-typed', true)).toBe(0);
  });

  it('scales base XP by question type: typed recall > locate > mcq > flashcard', () => {
    const flashcard = xpForAnswer(true, 'flashcard', false);
    const mcq = xpForAnswer(true, 'mcq', false);
    const locate = xpForAnswer(true, 'locate', false);
    const fillBlank = xpForAnswer(true, 'fill-blank', false);
    const identifyTyped = xpForAnswer(true, 'identify-typed', false);
    expect(flashcard).toBeLessThan(mcq);
    expect(mcq).toBeLessThan(locate);
    expect(locate).toBeLessThan(fillBlank);
    expect(identifyTyped).toBe(fillBlank);
  });

  it('adds the first-correct-in-session bonus on top of base XP', () => {
    const base = xpForAnswer(true, 'mcq', false);
    const withBonus = xpForAnswer(true, 'mcq', true);
    expect(withBonus).toBe(base + DEFAULT_XP_CONFIG.firstCorrectBonus);
  });
});

describe('streakMultiplier', () => {
  it('is 1x with no streak', () => {
    expect(streakMultiplier(0)).toBe(1);
  });

  it('grows with streak days', () => {
    expect(streakMultiplier(10)).toBeGreaterThan(streakMultiplier(5));
  });

  it('caps at the configured maximum', () => {
    expect(streakMultiplier(10000)).toBe(DEFAULT_XP_CONFIG.streakMultiplierCap);
  });

  it('treats a negative streak as zero rather than reducing XP', () => {
    expect(streakMultiplier(-5)).toBe(1);
  });
});

describe('computeSessionXp', () => {
  it('sums answer XP, applies the streak multiplier, then adds the completion bonus', () => {
    const result = computeSessionXp({ answerXp: [10, 10], streakDays: 0, completed: true });
    expect(result).toBe(10 + 10 + DEFAULT_XP_CONFIG.sessionCompletionBonus);
  });

  it('omits the completion bonus for an incomplete session', () => {
    const result = computeSessionXp({ answerXp: [10, 10], streakDays: 0, completed: false });
    expect(result).toBe(20);
  });

  it('applies the streak multiplier before the completion bonus, not after', () => {
    const config = { ...DEFAULT_XP_CONFIG, streakMultiplierPerDay: 1, streakMultiplierCap: 2 };
    const result = computeSessionXp({ answerXp: [10], streakDays: 1, completed: true, config });
    // base 10 * 2x multiplier = 20, + flat 20 completion bonus = 40 (not (10+20)*2=60)
    expect(result).toBe(40);
  });

  it('returns just the completion bonus for a completed session with no answers', () => {
    expect(computeSessionXp({ answerXp: [], streakDays: 0, completed: true })).toBe(DEFAULT_XP_CONFIG.sessionCompletionBonus);
  });
});
