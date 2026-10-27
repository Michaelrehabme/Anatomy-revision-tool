import type { Confidence, UserAttempt } from '../types/attempt';
import { skillOf } from './factMastery';

/**
 * THE CONFIDENCE CHECK (owner, 19 Oct 2026): does the student's own rating
 * predict what they will remember?
 *
 * The rating already decides the schedule — Easy sends a question out for
 * over a week, Hard brings it back tomorrow (lib/mastery.ts). So the useful
 * question is not "were you right" but "when you said Easy, were you right
 * NEXT time?" Each correct, rated answer is paired with the next answer to
 * the same question about the same structure, and the share of those that
 * came back right is what the rating was worth.
 *
 * A wrong answer is left out: the schedule already treats it as Hard whatever
 * was pressed (scheduleConfidence), so its rating moves nothing.
 */

/** Pairs needed before a rating's figure is shown. Fewer, and one bad day reads as a habit. */
export const CALIBRATION_MIN = 12;
/** Below this, Easy is being pressed for things that do not last a week. */
export const EASY_HOLDS = 0.75;
/** At or above this, Hard is being pressed for things the student keeps. */
export const HARD_TOO_HUMBLE = 0.85;

export interface RatingRecord {
  /** Correct answers given this rating that have been asked again since. */
  pairs: number;
  /** Of those, how many were right the next time. */
  heldUp: number;
  /** heldUp / pairs, or null with no pairs at all. Shown from the first pair; judged only from CALIBRATION_MIN. */
  share: number | null;
  /** Enough pairs for the share to be judged (CALIBRATION_MIN). */
  judged: boolean;
}

export type CalibrationVerdict =
  /** Easy answers often do not last: a week out is too far for them. */
  | 'easy-too-often'
  /** Hard answers nearly always come back right: reviews spent on what is known. */
  | 'hard-too-often'
  /** Both ratings mean what they say. */
  | 'well-judged'
  /** Not enough rated answers yet. */
  | 'too-soon';

export interface Calibration {
  easy: RatingRecord;
  medium: RatingRecord;
  hard: RatingRecord;
  verdict: CalibrationVerdict;
}

function record(pairs: number, heldUp: number): RatingRecord {
  return { pairs, heldUp, share: pairs > 0 ? heldUp / pairs : null, judged: pairs >= CALIBRATION_MIN };
}

/** Over GRADED attempts (lib/accuracyTrend.ts gradedAttempts), any order. */
export function calibration(attempts: readonly UserAttempt[]): Calibration {
  const byQuestion = new Map<string, UserAttempt[]>();
  for (const a of attempts) {
    const key = `${a.structureId}|${skillOf(a.questionType, a.promptKind)}`;
    const list = byQuestion.get(key);
    if (list) list.push(a);
    else byQuestion.set(key, [a]);
  }
  const tally: Record<Confidence, { pairs: number; heldUp: number }> = {
    easy: { pairs: 0, heldUp: 0 },
    medium: { pairs: 0, heldUp: 0 },
    hard: { pairs: 0, heldUp: 0 },
  };
  for (const list of byQuestion.values()) {
    list.sort((x, y) => x.timestamp.localeCompare(y.timestamp));
    for (let i = 0; i < list.length - 1; i++) {
      const rated = list[i];
      if (!rated.correct || !rated.confidence) continue;
      tally[rated.confidence].pairs += 1;
      if (list[i + 1].correct) tally[rated.confidence].heldUp += 1;
    }
  }
  const easy = record(tally.easy.pairs, tally.easy.heldUp);
  const medium = record(tally.medium.pairs, tally.medium.heldUp);
  const hard = record(tally.hard.pairs, tally.hard.heldUp);
  // The advice waits for enough answers; the figures do not.
  const verdict: CalibrationVerdict =
    !easy.judged && !hard.judged
      ? 'too-soon'
      : easy.judged && easy.share! < EASY_HOLDS
        ? 'easy-too-often'
        : hard.judged && hard.share! >= HARD_TOO_HUMBLE
          ? 'hard-too-often'
          : 'well-judged';
  return { easy, medium, hard, verdict };
}
