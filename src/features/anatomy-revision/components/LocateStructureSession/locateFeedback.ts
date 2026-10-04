import { PASS_SCORE, RING_COUNT } from '../../lib/hotspot/accuracy';

/**
 * What to say after a locate answer, in one place so the desktop panel and the
 * mobile sheet cannot drift apart.
 *
 * A SCORED LANDMARK NEEDS DIFFERENT WORDS from a shape. "Not quite — that was
 * the Linea Aspera" is what the old copy said for both, and for a landmark it
 * is close to nonsense: the linea aspera IS what was asked for, so the student
 * is told they got it wrong and then told the name they were already given.
 * What actually happened is that they tapped near it rather than on it, and
 * the score is the only thing that says how near.
 */
export function locateFeedback(
  { correct, accuracy }: { correct: boolean; accuracy?: number },
  targetName: string,
  /** What the tap actually landed on, when the picture can name it. */
  tappedName?: string,
): { title: string; detail?: string } {
  if (accuracy === undefined) {
    if (correct) return { title: 'Correct', detail: 'Nice.' };
    // "That was the flexor carpi radialis" reads as a label for the thing you
    // just tapped, so a student who tapped the wrong muscle is told the name of
    // the wrong muscle and believes it. Name the tap, then the answer.
    return {
      title: 'Not quite',
      detail:
        tappedName && tappedName !== targetName
          ? `That was ${tappedName}. ${targetName} is shown in green.`
          : `${targetName} is shown in green.`,
    };
  }

  const score = `${accuracy}/${RING_COUNT}`;
  if (correct) {
    return {
      title: `Correct — ${score}`,
      detail: accuracy === RING_COUNT ? 'Dead centre.' : 'On the landmark.',
    };
  }
  // Inside the target but outside the pass zone: the near-miss halo exists to
  // tell them which, so say so rather than implying they picked a wrong part.
  if (accuracy > 0) {
    return {
      title: `Not quite — ${score}`,
      detail: `Close, but that is not ${targetName} itself. You needed ${PASS_SCORE} or better.`,
    };
  }
  // A SCORED PICTURE CAN HOLD SEVERAL TARGETS. The carpal gap plate carries five
  // seams, each scored by its core, so a miss there is usually a tap on the
  // NEIGHBOURING gap — and "that is not where it sits" throws away the one
  // thing the picture knows: which gap it was. Name it, as an outline target's
  // miss is named. A landmark plate has one target and nothing else to name,
  // so it keeps the line it always had.
  if (tappedName && tappedName !== targetName) {
    return { title: `Not quite — ${score}`, detail: `That was ${tappedName}. ${targetName} is shown in green.` };
  }
  return { title: `Not quite — ${score}`, detail: `That is not where ${targetName} sits.` };
}
