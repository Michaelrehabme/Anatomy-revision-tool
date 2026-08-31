/**
 * Partial credit for multi-select (CR-010: "score it partially rather than
 * all-or-nothing"). Each correctly-selected choice earns credit; each
 * incorrectly-selected choice removes it, floored at 0 — picking everything
 * scores no better than picking nothing. `correct` for mastery/XP/scheduling
 * purposes stays binary (an exact match) — see MultiSelectSession's comment
 * for why fractional correctness isn't threaded through the wider pipeline.
 */
export interface MultiSelectScoreResult {
  correctCount: number;
  incorrectCount: number;
  totalCorrect: number;
  /** 0-1, clamped. */
  score: number;
  isFullyCorrect: boolean;
}

export function scoreMultiSelect(correctIndices: number[], selectedIndices: number[]): MultiSelectScoreResult {
  const correctSet = new Set(correctIndices);
  const selectedSet = new Set(selectedIndices);

  let correctCount = 0;
  let incorrectCount = 0;
  for (const i of selectedSet) {
    if (correctSet.has(i)) correctCount += 1;
    else incorrectCount += 1;
  }

  const totalCorrect = correctSet.size;
  const rawScore = totalCorrect > 0 ? (correctCount - incorrectCount) / totalCorrect : 0;
  const score = Math.max(0, Math.min(1, rawScore));
  const isFullyCorrect = correctCount === totalCorrect && incorrectCount === 0;

  return { correctCount, incorrectCount, totalCorrect, score, isFullyCorrect };
}
