import type { PromptKind } from '../types/question';
import { stripHeadPrefix } from './oinaValues';

/**
 * Typed-answer grading for OINA questions (CR-018).
 *
 * answerMatching.ts's isAnswerMatch is deliberately left alone — fill-blank
 * and identify-typed depend on its exact behaviour, and its fixed
 * maxDistance of 1 is right for the bare nouns they ask for ("femur"). It is
 * far too strict for an attachment phrase like "supraglenoid tubercle &
 * adjacent glenoid labrum".
 *
 * Scaling that edit distance by string length — the obvious fix — is worse
 * than the problem. It hands out the most slack exactly where the
 * discriminating difference is a single character, so a length-scaled
 * tolerance accepts "anterior inferior iliac spine" for "anterior superior
 * iliac spine", "base of 2nd metacarpal" for "base of 3rd metacarpal", and
 * "spinous processes C7-T12" for "spinous processes C7-T1". Roughly 28 such
 * pairs exist in this dataset.
 *
 * So grading here is token-set based instead, with the tokens that actually
 * discriminate — vertebral levels, digit ordinals, laterality — required to
 * match exactly, and only ordinary words allowed a typo. See
 * oinaAnswer.test.ts, which asserts the invariant directly: no authored
 * attachment value may ever grade as correct for a different one.
 */

const STOPWORDS = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'from', 'in', 'on', 'at', 'via', 'its', 'into']);

/**
 * Tokens where a one-character difference changes the answer rather than
 * spelling it wrong: anything carrying a digit (vertebral levels "c7-t12",
 * ordinals "2nd", counts), and the position words that distinguish otherwise
 * identical attachment sites (supraspinous vs infraspinous is caught by the
 * word rule, but "medial side of ..." vs "lateral side of ..." is not).
 */
const POSITION_TOKENS = new Set([
  'medial',
  'lateral',
  'superior',
  'inferior',
  'anterior',
  'posterior',
  'deep',
  'superficial',
  'proximal',
  'distal',
  'upper',
  'lower',
  'left',
  'right',
]);

export function isIdentifierToken(token: string): boolean {
  return /\d/.test(token) || POSITION_TOKENS.has(token);
}

/**
 * Folds everything a student cannot reasonably be expected to type: case,
 * en/em dashes (46 attachment values contain one), ampersands (13 do),
 * apostrophes and other punctuation, and a leading article.
 */
export function normalizeForGrading(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '');
}

/** Normalised content tokens. Hyphens are kept inside a token so "c7-t12" stays one identifier. */
export function gradingTokens(value: string): string[] {
  return normalizeForGrading(value)
    .split(' ')
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Levenshtein edit distance, single-row DP — same algorithm as answerMatching.ts. */
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

/** A word token tolerates one typo, but only once it is long enough that a typo and a different word are distinguishable. */
function wordTokensMatch(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected.length < 5 || actual.length < 5) return false;
  return editDistance(expected, actual) <= 1;
}

/**
 * Fraction of an accepted value's ordinary word tokens that must appear in
 * the student's answer. Below 1 so that an incidental descriptor can be
 * dropped, but high — this threshold, not the identifier rule, is what
 * separates the attachments whose difference is a whole word: "Greater"
 * from "Lesser trochanter of the femur" (2 of 3 words shared), "flexor
 * digitorum longus" from "profundus" (3 of 4), "Spinous" from "Transverse
 * processes of the cervical and lumbar vertebrae" (4 of 5). 0.85 is the
 * lowest value that rejects all three; it was chosen by sweeping every pair
 * of authored values in the dataset, and oinaAnswer.test.ts pins it there.
 *
 * Values a student can fairly answer more briefly are handled by generating
 * shorter accepted variants in acceptedVariantsFor, not by loosening this.
 */
export const MIN_WORD_COVERAGE = 0.85;

/** At least this many word tokens must match, so a long value can't be satisfied by one lucky word. */
const MIN_WORDS_MATCHED = 2;

/**
 * How many of the student's own words may go unaccounted for. One, so that
 * naming the bone a landmark sits on still counts ("supraglenoid tubercle of
 * the scapula" for "Supraglenoid tubercle") while a longer, different
 * attachment that merely contains the accepted value does not — Gerdy's
 * tubercle on the iliotibial band is not the answer to "lateral condyle of
 * tibia", even though it mentions both words.
 */
const MAX_UNMATCHED_INPUT_WORDS = 1;

/**
 * True when `input` is an acceptable rendering of `accepted`. Word order is
 * irrelevant; extra descriptive words are allowed (so "supraglenoid tubercle
 * of the scapula" answers "Supraglenoid tubercle"), but an extra identifier
 * token is not — adding "3rd" to an answer about the 2nd metacarpal makes it
 * a different answer, not a more detailed one.
 */
export function matchesAcceptedValue(input: string, accepted: string): boolean {
  const inputTokens = gradingTokens(input);
  const acceptedTokens = gradingTokens(accepted);
  if (inputTokens.length === 0 || acceptedTokens.length === 0) return false;

  const inputIds = inputTokens.filter(isIdentifierToken);
  const acceptedIds = acceptedTokens.filter(isIdentifierToken);
  if (!acceptedIds.every((t) => inputIds.includes(t))) return false;
  if (!inputIds.every((t) => acceptedIds.includes(t))) return false;

  const acceptedWords = acceptedTokens.filter((t) => !isIdentifierToken(t));
  const inputWords = inputTokens.filter((t) => !isIdentifierToken(t));
  if (acceptedWords.length === 0) return inputWords.length === 0;

  const matched = acceptedWords.filter((expected) => inputWords.some((actual) => wordTokensMatch(expected, actual)));
  if (matched.length < Math.min(MIN_WORDS_MATCHED, acceptedWords.length)) return false;
  if (matched.length / acceptedWords.length < MIN_WORD_COVERAGE) return false;

  const unmatchedInput = inputWords.filter((actual) => !acceptedWords.some((expected) => wordTokensMatch(expected, actual)));
  return unmatchedInput.length <= MAX_UNMATCHED_INPUT_WORDS;
}

/** True when the input matches any of a slot's accepted renderings. */
export function matchesSlot(input: string, accepted: string[]): boolean {
  return accepted.some((candidate) => matchesAcceptedValue(input, candidate));
}

/**
 * Every rendering of one authored value a student could fairly type. Beyond
 * the head-stripped canonical form this covers the two shapes a trailing
 * parenthetical takes in the data: an expansion the student may omit
 * ("Medial surface of tibia (pes anserinus)") and an abbreviation they may
 * use on its own ("Anterior superior iliac spine (ASIS)" -> "ASIS").
 *
 * The authored value is always first, and the UI relies on that: a missed
 * slot reveals `accepted[0]`, so the student gets the full authored form
 * back — including the head prefix the choices strip, since once the answer
 * is being shown, knowing it was specifically the short head is the useful
 * part.
 */
export function acceptedVariantsFor(promptKind: PromptKind, raw: string): string[] {
  const variants = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) variants.add(trimmed);
  };

  add(raw);
  if (promptKind === 'origin' || promptKind === 'insertion') {
    const canonical = stripHeadPrefix(raw);
    add(canonical);
    const withoutParens = canonical.replace(/\s*\([^)]*\)/g, '');
    add(withoutParens);
    for (const match of canonical.matchAll(/\(([^)]*)\)/g)) {
      // Only an abbreviation stands alone as an answer ("ASIS", "ITB"); a prose
      // gloss like "(between the anterior and posterior gluteal lines)" does not.
      if (/^[A-Z][A-Za-z]{1,7}$/.test(match[1])) add(match[1]);
    }
    // A value naming two sites ("Supraglenoid tubercle & adjacent glenoid
    // labrum", "Sternum & costal cartilages 1-6") is answered correctly by
    // naming either. Split on the ampersand only — " and " runs through the
    // middle of single attachment names ("Medial and lateral sides of the
    // base of ...") and splitting there would produce fragments.
    for (const part of withoutParens.split(/\s+&\s+/)) {
      if (gradingTokens(part).length >= 2) add(part);
    }
  }
  if (promptKind === 'nerve') {
    // "Musculocutaneous nerve" typed as "musculocutaneous" is a correct answer.
    add(raw.replace(/\s+nerve$/i, ''));
  }
  return [...variants];
}

export interface TypedSlot {
  label: string;
  accepted: string[];
}

export interface TypedGradeResult {
  /** Per slot, the index of the input that satisfied it, or null. */
  matchedInputIndex: (number | null)[];
  slotCorrect: boolean[];
  correctCount: number;
  allCorrect: boolean;
}

/**
 * Grades typed slots order-independently: a student who knows both heads of
 * biceps femoris should not be marked wrong for entering them the other way
 * round. Each input satisfies at most one slot.
 *
 * First-fit rather than optimal assignment, which is sound here because no
 * muscle has two of its own values close enough to match the same input —
 * validateContent.ts asserts that, so if the content ever drifts the build
 * fails rather than the grading silently going wrong.
 */
export function gradeTypedSlots(inputs: string[], slots: TypedSlot[]): TypedGradeResult {
  const usedInput = new Set<number>();
  const matchedInputIndex: (number | null)[] = [];

  for (const slot of slots) {
    let found: number | null = null;
    for (let i = 0; i < inputs.length; i++) {
      if (usedInput.has(i) || !inputs[i]?.trim()) continue;
      if (matchesSlot(inputs[i], slot.accepted)) {
        found = i;
        usedInput.add(i);
        break;
      }
    }
    matchedInputIndex.push(found);
  }

  const slotCorrect = matchedInputIndex.map((i) => i !== null);
  const correctCount = slotCorrect.filter(Boolean).length;
  return { matchedInputIndex, slotCorrect, correctCount, allCorrect: correctCount === slots.length };
}
