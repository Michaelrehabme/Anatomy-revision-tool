/**
 * One-line explanations that appear the first few times a student meets a
 * mechanic — the confidence rating, clicking a locate image — and then get
 * out of the way. Counted per device in localStorage, like the study
 * preferences in preferences.ts: a hint is about this person's familiarity,
 * not their progress, and it must never cost a repository read.
 */

const PREFIX = 'anatomy-revision:v1:hint:';

export type HintKey = 'confidence' | 'locate';

/** How many times each hint is shown before it stops appearing. */
export const HINT_SHOW_LIMIT: Record<HintKey, number> = {
  confidence: 3,
  locate: 2,
};

function read(key: HintKey): number {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/** True while the hint has been shown fewer than its limit. */
export function shouldShowHint(key: HintKey): boolean {
  return read(key) < HINT_SHOW_LIMIT[key];
}

/** Call once per showing, not per render. */
export function recordHintShown(key: HintKey): void {
  try {
    localStorage.setItem(PREFIX + key, String(read(key) + 1));
  } catch {
    // Storage unavailable: the hint simply keeps showing, which is the safe failure.
  }
}
