import { describe, it, expect } from 'vitest';
import { xpForLevel, levelForXp, levelProgress } from '../levels';

describe('xpForLevel', () => {
  it('requires 0 XP for level 1', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('requires increasing XP for each subsequent level', () => {
    const l2 = xpForLevel(2);
    const l3 = xpForLevel(3);
    const l4 = xpForLevel(4);
    expect(l2).toBeGreaterThan(0);
    expect(l3).toBeGreaterThan(l2);
    expect(l4).toBeGreaterThan(l3);
  });

  it('widens the gap between consecutive levels as level increases (slows down)', () => {
    const gapEarly = xpForLevel(3) - xpForLevel(2);
    const gapLate = xpForLevel(11) - xpForLevel(10);
    expect(gapLate).toBeGreaterThan(gapEarly);
  });
});

describe('levelForXp', () => {
  it('returns level 1 for 0 XP', () => {
    expect(levelForXp(0)).toBe(1);
  });

  it('never returns below level 1', () => {
    expect(levelForXp(-100)).toBe(1);
  });

  it('returns exactly the level whose threshold is met', () => {
    const level5Xp = xpForLevel(5);
    expect(levelForXp(level5Xp)).toBe(5);
    expect(levelForXp(level5Xp - 1)).toBe(4);
  });
});

describe('levelProgress', () => {
  it('reports 0% right at a level threshold', () => {
    const xp = xpForLevel(4);
    const progress = levelProgress(xp);
    expect(progress.level).toBe(4);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.pct).toBe(0);
  });

  it('reports partial progress toward the next level', () => {
    const floor = xpForLevel(3);
    const ceiling = xpForLevel(4);
    const midpoint = Math.round((floor + ceiling) / 2);
    const progress = levelProgress(midpoint);
    expect(progress.level).toBe(3);
    expect(progress.pct).toBeGreaterThan(0);
    expect(progress.pct).toBeLessThan(100);
  });

  it('xpForNextLevel matches the gap to the next threshold', () => {
    const floor = xpForLevel(6);
    const progress = levelProgress(floor);
    expect(progress.xpForNextLevel).toBe(xpForLevel(7) - floor);
  });
});
