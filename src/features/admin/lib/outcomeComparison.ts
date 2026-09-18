import type { UserAttempt } from '../../anatomy-revision/types/attempt';

/**
 * The February sentence: "students who completed N sessions scored X% higher
 * than those who did not" (CR-033 item 14).
 *
 * WHY THIS EXISTS BEFORE THE DATA DOES. Not because the data needs capturing —
 * it is already captured. `attemptEvents` carries userId, sessionId, timestamp
 * and correctness, and firestore.rules grants an admin read across every one,
 * so sessions completed, accuracy over time and structures mastered are all
 * derivable from a term that has already happened. The reason to write the
 * analysis now is to find out whether the recorded data actually answers the
 * question while there is still time to change what is recorded. Discovering a
 * missing denominator in February is discovering it a year late.
 *
 * WHAT IS NOT DERIVABLE, AND WHY IT IS NOT IN THIS FILE. An in-app accuracy
 * figure compared against in-app engagement is close to circular: students who
 * revise more get better at the revision tool. The claim a course leader cares
 * about needs an EXTERNAL outcome — anonymised module marks — and that is an
 * agreement with the pilot lead, made at the start of term, not a computation.
 * `externalMarks` is the slot it arrives in; everything else here works without
 * it and says less.
 *
 * THE THRESHOLD IS PRE-REGISTERED ON PURPOSE. Picking the split after seeing
 * the data — the median, or whatever number maximises the gap — is how a real
 * effect and a coincidence come to look identical. It is fixed here, in git,
 * with a date on it, so the choice can be shown to precede the data.
 */

/**
 * Sessions that count as "engaged", fixed 18 September 2026, before any pilot
 * cohort existed.
 *
 * Ten sessions is roughly one a week across a twelve-week term with a fortnight
 * missed — enough to represent sustained use rather than a burst before an
 * exam, and low enough that a reasonable number of students clear it. It is a
 * judgement, not a derivation; what matters is that it was made first.
 */
export const ENGAGED_SESSION_THRESHOLD = 10;

/**
 * Below this many students in either group, no figure is reported. A gap
 * computed over three students is not a weak finding, it is a misleading one,
 * and it would be quoted without its denominator the moment it existed.
 */
export const MIN_GROUP_SIZE = 8;

/** Graded attempts a student needs before their own early-vs-late trend means anything. */
export const MIN_ATTEMPTS_FOR_TREND = 30;

/**
 * A structure counts as mastered when the student's last this-many graded
 * attempts on it were all correct.
 *
 * WHY THIS AND NOT AN ACCURACY TREND. Raw accuracy over a term does not measure
 * learning in this app, and running the comparison over the demo cohort proved
 * it: that fixture holds each student's ability CONSTANT for the whole term,
 * and accuracy still fell 5.4 points from their first third to their last.
 * Nothing was learned or forgotten — the mix of material changed. In the real
 * product the effect is stronger and deliberate, because the scheduler serves
 * what you are about to forget, which holds accuracy near a target however well
 * you are doing.
 *
 * A mastery count does not have that problem: it only goes up when a structure
 * is answered right repeatedly, and a harder mix slows it rather than reversing
 * it. It is also the measure CR-033 item 14 asked for in the first place —
 * "sessions completed and structures mastered per student".
 */
export const MASTERY_STREAK = 3;

/** Learn cards are ungraded (CR-018); every accuracy figure in the product excludes them. */
function isGraded(attempt: UserAttempt): boolean {
  return attempt.graded !== false;
}

function pct(correct: number, total: number): number | null {
  return total > 0 ? (correct / total) * 100 : null;
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** One student's term, derived entirely from their attempt rows. */
export interface StudentOutcome {
  userId: string;
  /** Distinct sessionIds. A session is a session because the attempts share an id, not because one was "finished". */
  sessions: number;
  gradedAttempts: number;
  gradedCorrect: number;
  accuracyPct: number | null;
  /** Distinct structures with at least one graded attempt. */
  structuresSeen: number;
  /** Structures whose last MASTERY_STREAK graded attempts were all correct. See that constant. */
  structuresMastered: number;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
  /**
   * Accuracy over this student's first and last third of graded attempts, in
   * time order. Null until MIN_ATTEMPTS_FOR_TREND, because a trend over twelve
   * answers is noise wearing a trend's clothes.
   */
  earlyAccuracyPct: number | null;
  lateAccuracyPct: number | null;
}

export interface GroupSummary {
  students: number;
  meanAccuracyPct: number | null;
  medianSessions: number;
  gradedAttempts: number;
  /** Mean structures mastered per student — the progress measure an accuracy trend cannot be. */
  meanStructuresMastered: number | null;
  /** Mean of whatever external marks were supplied for this group's students. */
  meanExternalMark: number | null;
  /** How many of this group's students had an external mark — the denominator for the line above. */
  studentsWithMark: number;
}

export interface OutcomeComparison {
  threshold: number;
  engaged: GroupSummary;
  lessEngaged: GroupSummary;
  /** Percentage POINTS, not a relative change: 62% against 55% is 7, not 12.7. */
  accuracyGapPoints: number | null;
  /** Same, for external marks, when they were supplied for enough students. */
  externalMarkGap: number | null;
  /** Difference in mean structures mastered. The progress figure to quote. */
  masteryGap: number | null;
  /**
   * Mean within-student change from first to last third, across every student
   * with enough attempts. CONFOUNDED — see MASTERY_STREAK. Kept because it is
   * worth watching, never to be quoted as evidence of learning.
   */
  withinStudentGainPoints: number | null;
  studentsWithTrend: number;
  /** False when either group is under MIN_GROUP_SIZE — do not quote the numbers. */
  reportable: boolean;
  /** Everything that must be said out loud alongside the figure. Never empty. */
  caveats: string[];
  /** The claim, written out, or null when it must not be made yet. */
  sentence: string | null;
}

/**
 * Per-student outcomes from raw attempt rows.
 *
 * Attempts arrive in whatever order the query returned them, so anything
 * time-ordered sorts first rather than trusting the caller.
 */
export function summariseStudents(attempts: UserAttempt[]): StudentOutcome[] {
  const byUser = new Map<string, UserAttempt[]>();
  for (const attempt of attempts) {
    const list = byUser.get(attempt.userId);
    if (list) list.push(attempt);
    else byUser.set(attempt.userId, [attempt]);
  }

  return [...byUser.entries()]
    .map(([userId, rows]) => {
      const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const graded = ordered.filter(isGraded);
      const gradedCorrect = graded.filter((a) => a.correct).length;

      // Thirds by COUNT, not by calendar: a student who did nothing for a month
      // has not regressed, and splitting their term by date would say they had.
      let earlyAccuracyPct: number | null = null;
      let lateAccuracyPct: number | null = null;
      if (graded.length >= MIN_ATTEMPTS_FOR_TREND) {
        const third = Math.floor(graded.length / 3);
        const early = graded.slice(0, third);
        const late = graded.slice(graded.length - third);
        earlyAccuracyPct = pct(early.filter((a) => a.correct).length, early.length);
        lateAccuracyPct = pct(late.filter((a) => a.correct).length, late.length);
      }

      // Per structure, in time order, so "the last three" means the last three.
      const byStructure = new Map<string, boolean[]>();
      for (const a of graded) {
        const list = byStructure.get(a.structureId);
        if (list) list.push(a.correct);
        else byStructure.set(a.structureId, [a.correct]);
      }
      let structuresMastered = 0;
      for (const results of byStructure.values()) {
        if (results.length < MASTERY_STREAK) continue;
        if (results.slice(-MASTERY_STREAK).every(Boolean)) structuresMastered += 1;
      }

      return {
        userId,
        sessions: new Set(ordered.map((a) => a.sessionId)).size,
        gradedAttempts: graded.length,
        gradedCorrect,
        accuracyPct: pct(gradedCorrect, graded.length),
        structuresSeen: byStructure.size,
        structuresMastered,
        firstActiveAt: ordered[0]?.timestamp ?? null,
        lastActiveAt: ordered[ordered.length - 1]?.timestamp ?? null,
        earlyAccuracyPct,
        lateAccuracyPct,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

function summariseGroup(group: StudentOutcome[], externalMarks?: ReadonlyMap<string, number>): GroupSummary {
  const marks = group
    .map((s) => externalMarks?.get(s.userId))
    .filter((m): m is number => typeof m === 'number' && Number.isFinite(m));

  return {
    students: group.length,
    meanAccuracyPct: mean(group.map((s) => s.accuracyPct).filter((a): a is number => a !== null)),
    medianSessions: median(group.map((s) => s.sessions)),
    gradedAttempts: group.reduce((sum, s) => sum + s.gradedAttempts, 0),
    meanStructuresMastered: mean(group.map((s) => s.structuresMastered)),
    meanExternalMark: mean(marks),
    studentsWithMark: marks.length,
  };
}

export interface OutcomeComparisonOptions {
  /** Override only with a reason; the default is the pre-registered figure. */
  sessionThreshold?: number;
  /** Anonymised module marks by uid, from the pilot lead. Without these the claim is nearly circular. */
  externalMarks?: ReadonlyMap<string, number>;
}

/**
 * The comparison, and the sentence it licenses.
 *
 * Deliberately returns `sentence: null` rather than a hedged sentence when the
 * groups are too small. A caller that wants to say something anyway has the
 * numbers; what it does not get is this module's endorsement of them.
 */
export function computeOutcomeComparison(
  attempts: UserAttempt[],
  options: OutcomeComparisonOptions = {},
): OutcomeComparison {
  const threshold = options.sessionThreshold ?? ENGAGED_SESSION_THRESHOLD;
  const students = summariseStudents(attempts);

  const engagedGroup = students.filter((s) => s.sessions >= threshold);
  const lessEngagedGroup = students.filter((s) => s.sessions < threshold);

  const engaged = summariseGroup(engagedGroup, options.externalMarks);
  const lessEngaged = summariseGroup(lessEngagedGroup, options.externalMarks);

  const accuracyGapPoints =
    engaged.meanAccuracyPct !== null && lessEngaged.meanAccuracyPct !== null
      ? engaged.meanAccuracyPct - lessEngaged.meanAccuracyPct
      : null;

  const externalMarkGap =
    engaged.meanExternalMark !== null &&
    lessEngaged.meanExternalMark !== null &&
    engaged.studentsWithMark >= MIN_GROUP_SIZE &&
    lessEngaged.studentsWithMark >= MIN_GROUP_SIZE
      ? engaged.meanExternalMark - lessEngaged.meanExternalMark
      : null;

  const masteryGap =
    engaged.meanStructuresMastered !== null && lessEngaged.meanStructuresMastered !== null
      ? engaged.meanStructuresMastered - lessEngaged.meanStructuresMastered
      : null;

  const withTrend = students.filter((s) => s.earlyAccuracyPct !== null && s.lateAccuracyPct !== null);
  const withinStudentGainPoints = mean(withTrend.map((s) => s.lateAccuracyPct! - s.earlyAccuracyPct!));

  const reportable = engaged.students >= MIN_GROUP_SIZE && lessEngaged.students >= MIN_GROUP_SIZE;

  const caveats: string[] = [
    'Association, not causation: students who revise more are likely to differ in ways this cannot measure.',
    `Groups split at ${threshold} sessions, fixed in git on 18 September 2026 before any data existed.`,
  ];
  if (!reportable) {
    caveats.unshift(
      `Not reportable: ${engaged.students} engaged and ${lessEngaged.students} less-engaged students, ` +
        `against a minimum of ${MIN_GROUP_SIZE} in each.`,
    );
  }
  if (externalMarkGap === null) {
    caveats.push(
      'No external marks, so this compares in-app accuracy against in-app engagement — ' +
        'a weaker claim than one against module marks.',
    );
  }
  caveats.push(
    'Accuracy over time is confounded by the scheduler, which serves what a student is about to ' +
      'forget. Quote structures mastered for progress, not the accuracy trend.',
  );
  if (withTrend.length < students.length) {
    caveats.push(
      `${students.length - withTrend.length} of ${students.length} students had fewer than ` +
        `${MIN_ATTEMPTS_FOR_TREND} graded answers, so are excluded from the within-student trend.`,
    );
  }

  let sentence: string | null = null;
  if (reportable && externalMarkGap !== null) {
    sentence =
      `Students who completed ${threshold} or more revision sessions scored ` +
      `${externalMarkGap.toFixed(1)} marks higher on average than those who did not ` +
      `(${engaged.studentsWithMark} against ${lessEngaged.studentsWithMark} students).`;
  } else if (reportable && masteryGap !== null) {
    sentence =
      `Students who completed ${threshold} or more revision sessions mastered ` +
      `${masteryGap.toFixed(1)} more structures on average than those who did not ` +
      `(${engaged.students} against ${lessEngaged.students} students).`;
  }

  return {
    threshold,
    engaged,
    lessEngaged,
    accuracyGapPoints,
    externalMarkGap,
    masteryGap,
    withinStudentGainPoints,
    studentsWithTrend: withTrend.length,
    reportable,
    caveats,
    sentence,
  };
}
