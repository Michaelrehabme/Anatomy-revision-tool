import type { DiagnosticResult } from './diagnostic';

/**
 * Whether to offer a student a sitting, and which one.
 *
 * Separated from the screen because the judgements here are the ones worth
 * arguing about, and none of them should be buried in a component: when a
 * baseline stops being a baseline, how long a term is, and what happens to a
 * student who says no.
 */

/**
 * After this long in a class, a first sitting is no longer a baseline.
 *
 * A student who joins in week one and sits it that day gives a clean "before".
 * One who joins in week one, revises for two months and sits it in December
 * gives a number that measures neither where they started nor where they got
 * to, and pairing it with a later follow-up would understate the gain while
 * looking exactly as authoritative. Four weeks is generous for a twelve-week
 * term and still recognisably the start of one.
 *
 * Past this point the honest thing is to stop asking, not to collect a figure
 * that will quietly corrupt a mean.
 */
export const BASELINE_WINDOW_DAYS = 28;

/**
 * How long after the baseline the follow-up becomes worth offering.
 *
 * Ten weeks is the back end of a normal UK teaching term. Earlier and there has
 * not been enough revision to detect; much later and students have gone home.
 * This is a default, not a rule — an educator running a different shape of
 * module should be able to trigger it, which is why the phase is computed here
 * rather than assumed by the screen.
 */
export const FOLLOW_UP_AFTER_DAYS = 70;

export interface DiagnosticPromptInput {
  /** The class the student is in, or null if they are in none. */
  cohortId: string | null;
  /** When they joined it. Null if unknown — see the note in `nextDiagnosticPhase`. */
  joinedAt: string | null;
  results: DiagnosticResult[];
  now?: Date;
}

function daysBetween(fromIso: string, to: Date): number {
  return (to.getTime() - Date.parse(fromIso)) / 86400000;
}

/**
 * The sitting to offer, or null for "do not ask".
 *
 * Returns null rather than throwing on anything unexpected. This decides
 * whether to interrupt someone who came here to revise, and the cost of a
 * wrong "yes" is higher than the cost of a wrong "no".
 */
export function nextDiagnosticPhase(input: DiagnosticPromptInput): 'baseline' | 'followUp' | null {
  const { cohortId, joinedAt, results } = input;
  const now = input.now ?? new Date();

  // No class, no comparison to contribute to. The diagnostic exists to show a
  // cohort moved; a solo student sitting one measures nothing anybody reads.
  if (!cohortId) return null;

  const mine = results.filter((r) => r.cohortId === cohortId);
  const baseline = mine
    .filter((r) => r.phase === 'baseline')
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0];

  if (!baseline) {
    // Unknown join date: offer it. A missing timestamp is a gap in our records,
    // not evidence the student has been here for months, and the window check
    // below is a quality filter rather than a safety one.
    if (!joinedAt) return 'baseline';
    return daysBetween(joinedAt, now) <= BASELINE_WINDOW_DAYS ? 'baseline' : null;
  }

  // Already done the follow-up: never ask again. A second follow-up would pair
  // ambiguously and there is nothing further to learn.
  if (mine.some((r) => r.phase === 'followUp')) return null;

  return daysBetween(baseline.takenAt, now) >= FOLLOW_UP_AFTER_DAYS ? 'followUp' : null;
}

/**
 * How the offer is worded. The baseline and the follow-up are the same fifteen
 * questions and a different proposition, and saying "take the diagnostic" for
 * both would waste the only moment a student is paying attention to it.
 */
export function promptCopy(phase: 'baseline' | 'followUp'): { title: string; body: string; cta: string } {
  return phase === 'baseline'
    ? {
        title: 'Before you start revising',
        body:
          'Fifteen questions, about six minutes. It does not count for anything, and your course '
          + 'leader never sees your score — only whether the class as a whole moved. You will sit '
          + 'the same fifteen again at the end of term.',
        cta: 'Take the baseline',
      }
    : {
        title: 'The same fifteen questions, ten weeks on',
        body:
          'You sat these when you joined. Sitting them again is the only way to show what a term '
          + 'of revision actually did — and it is the number your course leader sees, about the '
          + 'class rather than about you.',
        cta: 'Take the follow-up',
      };
}
