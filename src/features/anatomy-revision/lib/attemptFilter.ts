import type { UserAttempt } from '../types/attempt';
import type { Area } from '../types/region';
import {
  accuracyDeltaByAttempts,
  accuracyTrendByAnswer,
  splitByFirstExposure,
  type AccuracyDelta,
  type AnswerTrend,
} from './accuracyTrend';

/**
 * Narrowing a student's accuracy by HOW a question was answered and WHERE in
 * the body it was about (7 Oct 2026).
 *
 * One accuracy figure mixes answers that are not comparable: picking a name
 * from four is easier than typing it from nothing, and a student strong on the
 * shoulder and weak on the knee averages out to "fine". The seen-before /
 * first-sight split stays underneath both filters — see filteredAccuracy for
 * why the split is taken first.
 */

/** The four ways an answer is given, easiest first. */
export type AnswerFormat = 'mcq' | 'typed-hinted' | 'typed-bare' | 'locate';

export const ANSWER_FORMATS: AnswerFormat[] = ['mcq', 'typed-hinted', 'typed-bare', 'locate'];

export const ANSWER_FORMAT_LABELS: Record<AnswerFormat, string> = {
  mcq: 'Multiple choice',
  'typed-hinted': 'Typed, with hints',
  'typed-bare': 'Typed, no hints',
  locate: 'Locate',
};

/**
 * Which format an attempt was answered in, or null for one that has none (a
 * flashcard, which is never graded anyway).
 *
 * Anything chosen from a list is multiple choice here, so multi-select and the
 * select stage of a fact card count with MCQ, and so does a locate question
 * answered in words (lib/answerRoute.ts records it as 'mcq').
 *
 * A fact card's stage is not stored on the attempt, but its question id ends
 * in the stage (questionGenerators/oina.ts). Its hints are stored only since
 * 7 Oct 2026; a typed fact row without them reads as bare, which is how typed
 * facts always ran before their hinted stage existed (29 Sep 2026).
 * Fill-blank is typed with the sentence as its hint, as lib/ladder.ts has it.
 */
export function formatOfAttempt(attempt: Pick<UserAttempt, 'questionType' | 'questionId' | 'hints'>): AnswerFormat | null {
  switch (attempt.questionType) {
    case 'mcq':
    case 'multi-select':
      return 'mcq';
    case 'locate':
      return 'locate';
    case 'fill-blank':
      return 'typed-hinted';
    case 'identify-typed':
      return attempt.hints === 'none' ? 'typed-bare' : 'typed-hinted';
    case 'oina':
      if (!attempt.questionId.endsWith('-typed')) return 'mcq';
      return attempt.hints === 'full' ? 'typed-hinted' : 'typed-bare';
    default:
      return null;
  }
}

/** An empty set means "all of them", the same convention the area picker uses. */
export interface ProgressFilter {
  formats: ReadonlySet<AnswerFormat>;
  areas: ReadonlySet<Area>;
  /**
   * Only the most recent this-many answers, or null for all time. Counted
   * AFTER the two filters above, so "last 50" with Locate picked is the last
   * fifty locate answers, not whichever of the last fifty answers were locate.
   */
  last: number | null;
}

export const NO_PROGRESS_FILTER: ProgressFilter = { formats: new Set(), areas: new Set(), last: null };

/** The ranges offered as chips; anything else is typed in as a custom number. */
export const LAST_ANSWER_PRESETS = [10, 25, 50, 100] as const;

/** Every area each structure revises under (types/structure.ts areasOf), by structure id. */
export type AreasByStructure = ReadonlyMap<string, readonly Area[]>;

export function matchesProgressFilter(attempt: UserAttempt, filter: ProgressFilter, areasByStructure: AreasByStructure): boolean {
  if (filter.formats.size > 0) {
    const format = formatOfAttempt(attempt);
    if (!format || !filter.formats.has(format)) return false;
  }
  if (filter.areas.size > 0) {
    // A structure in several areas (a pedicle is in all three spine areas)
    // counts under each of them, as it does in the area picker.
    const areas = areasByStructure.get(attempt.structureId) ?? [];
    if (!areas.some((area) => filter.areas.has(area))) return false;
  }
  return true;
}

export interface Tally {
  total: number;
  /** Whole percent, or null with nothing answered. */
  pct: number | null;
}

function tally(attempts: readonly UserAttempt[]): Tally {
  const correct = attempts.filter((a) => a.correct).length;
  return { total: attempts.length, pct: attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : null };
}

export interface FilteredAccuracy {
  all: Tally;
  seenBefore: Tally;
  firstSight: Tally;
  trend: AnswerTrend;
  delta: AccuracyDelta | null;
  /** Timestamps of the earliest and latest answer included, or null with none. */
  from: string | null;
  to: string | null;
}

/**
 * Accuracy for the answers a filter keeps. `graded` is every graded attempt,
 * unfiltered: the seen-before / first-sight split is taken over all of them
 * and each half narrowed afterwards, because whether a structure had been met
 * is a fact about the whole history, not about the answers left on screen.
 */
export function filteredAccuracy(
  graded: readonly UserAttempt[],
  filter: ProgressFilter,
  areasByStructure: AreasByStructure,
): FilteredAccuracy {
  const keep = (a: UserAttempt) => matchesProgressFilter(a, filter, areasByStructure);
  const whole = splitByFirstExposure(graded);
  const matching = [...whole.firstSight, ...whole.seenBefore].filter(keep).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const kept = filter.last !== null ? matching.slice(-Math.max(1, filter.last)) : matching;
  const metFirst = new Set(whole.firstSight);
  const firstSight = kept.filter((a) => metFirst.has(a));
  const seenBefore = kept.filter((a) => !metFirst.has(a));
  return {
    all: tally(kept),
    seenBefore: tally(seenBefore),
    firstSight: tally(firstSight),
    // Averaged over everything that matches, drawn for the range only, so a
    // short range does not open on a blank (accuracyTrendByAnswer).
    trend: accuracyTrendByAnswer(
      { firstSight: matching.filter((a) => metFirst.has(a)), seenBefore: matching.filter((a) => !metFirst.has(a)) },
      { firstSight, seenBefore },
    ),
    // The headline is about revision, so it reads the seen-before attempts;
    // a student with too few of those falls back to everything kept.
    delta: accuracyDeltaByAttempts(seenBefore) ?? accuracyDeltaByAttempts(kept),
    from: kept[0]?.timestamp ?? null,
    to: kept[kept.length - 1]?.timestamp ?? null,
  };
}

export interface FilterCounts {
  formats: Record<AnswerFormat, number>;
  areas: Partial<Record<Area, number>>;
}

/** How many graded answers each chip would keep on its own, so an empty one can say so. */
export function progressFilterCounts(graded: readonly UserAttempt[], areasByStructure: AreasByStructure): FilterCounts {
  const formats: Record<AnswerFormat, number> = { mcq: 0, 'typed-hinted': 0, 'typed-bare': 0, locate: 0 };
  const areas: Partial<Record<Area, number>> = {};
  for (const attempt of graded) {
    const format = formatOfAttempt(attempt);
    if (format) formats[format] += 1;
    for (const area of areasByStructure.get(attempt.structureId) ?? []) areas[area] = (areas[area] ?? 0) + 1;
  }
  return { formats, areas };
}
