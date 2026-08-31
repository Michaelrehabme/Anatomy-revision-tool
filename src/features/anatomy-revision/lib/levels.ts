/**
 * Level curve tuning — quick early wins, meaningful later ones. Cumulative
 * XP required to REACH a level grows as scale * (level-1)^exponent, so the
 * gap between consecutive levels widens as the exponent is > 1.
 */
export const LEVEL_CONFIG = {
  xpScale: 50,
  xpExponent: 1.5,
};

/** Cumulative XP required to reach `level` (level 1 requires 0). */
export function xpForLevel(level: number, config = LEVEL_CONFIG): number {
  if (level <= 1) return 0;
  return Math.round(config.xpScale * Math.pow(level - 1, config.xpExponent));
}

/** The level `totalXp` currently sits at (never below 1). */
export function levelForXp(totalXp: number, config = LEVEL_CONFIG): number {
  let level = 1;
  while (xpForLevel(level + 1, config) <= totalXp) level += 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0-100, rounded. */
  pct: number;
}

/** Everything a level-progress bar needs, derived from cumulative XP alone. */
export function levelProgress(totalXp: number, config = LEVEL_CONFIG): LevelProgress {
  const level = levelForXp(totalXp, config);
  const floor = xpForLevel(level, config);
  const ceiling = xpForLevel(level + 1, config);
  const xpIntoLevel = totalXp - floor;
  const xpForNextLevel = ceiling - floor;
  const pct = xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return { level, xpIntoLevel, xpForNextLevel, pct };
}
