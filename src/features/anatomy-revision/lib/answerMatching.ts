/**
 * Normalizes a typed answer: trims, lowercases, collapses internal
 * whitespace, and drops a leading article — fill-blank answers are often a
 * bare noun phrase ("femur") and students may reasonably type "the femur"
 * instead, which shouldn't count as a spelling mismatch.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '');
}

/** Levenshtein edit distance (insert/delete/substitute), computed with a single-row DP. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(prevRow[j] + 1, currentRow[j - 1] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currentRow;
  }
  return prevRow[b.length];
}

/**
 * Checks a typed answer against a list of accepted strings, tolerant of a
 * single-character typo (insertion, deletion, or substitution) so students
 * aren't marked wrong for one mistyped letter.
 */
export function isAnswerMatch(input: string, accepted: string[], maxDistance = 1): boolean {
  const normalizedInput = normalize(input);
  if (!normalizedInput) return false;
  return accepted.some((candidate) => editDistance(normalizedInput, normalize(candidate)) <= maxDistance);
}
