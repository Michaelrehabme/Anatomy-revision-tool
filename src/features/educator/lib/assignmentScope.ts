import { generateRevisionSet, type RevisionSetConfig } from '../../anatomy-revision/lib/questionGenerators/generateSet';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../anatomy-revision/data/seed';
import { filterStructures } from '../../anatomy-revision/lib/indexes';
import { AREAS as EVERY_AREA } from '../../anatomy-revision/types/region';
import type { QuestionType } from '../../anatomy-revision/types/question';
import { AREA_LABELS, normaliseAreas, type Area } from '../../anatomy-revision/types/region';
import { CATEGORY_LABELS, MUSCLE_GROUP_LABELS } from '../../anatomy-revision/types/structure';
import type { AssignmentScope, ScopedAssignment } from '../types/cohort';

/**
 * What an assignment is, in both directions: the generator config a student's
 * attempt is built from, and the line an educator and a student both read.
 *
 * Pure and Firebase-free on purpose — the student's Today screen imports it,
 * and must not pull the educator bundle or the SDK in with it.
 */

/**
 * Formats an educator may set. Flashcards are left out because they are
 * ungraded since CR-018 — an assignment scored on a pass mark cannot be made of
 * questions that have no right answer. Fill-blank is left out because the study
 * screen does not offer it either.
 */
export const ASSIGNMENT_QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'identify-typed', label: 'Type answer' },
  { value: 'multi-select', label: 'Select all' },
  { value: 'locate', label: 'Locate' },
  { value: 'oina', label: 'OINA (origin, insertion, nerve, action)' },
];

export const ASSIGNMENT_QUESTION_COUNTS = [10, 20, 30, 40];
export const DEFAULT_ASSIGNMENT_QUESTION_COUNT = 20;
export const DEFAULT_TARGET_ACCURACY_PCT = 70;

// The plural kind names live with the Category type; re-exported so the
// educator screens keep their import.
export { CATEGORY_LABELS };

/**
 * Exam mode: no feedback until the end, and never a learn card — an attempt is
 * a measurement against the pass mark, and a card that shows the answer first
 * would make the measurement meaningless. Everything else matches what the
 * study screen would build for the same choices.
 */
export function assignmentSetConfig(
  assignment: ScopedAssignment,
  /**
   * What the STUDENT sitting it may reach (CR-027). A licensed cohort carries
   * an institutional entitlement, so for the students this feature exists for
   * it is every area. A free student in an unlicensed cohort is still a free
   * student: an assignment is set work, not a licence, and must not become the
   * way round the paywall.
   */
  entitledAreas: readonly Area[],
): RevisionSetConfig {
  return {
    entitledAreas,
    types: assignment.questionTypes,
    // Normalised here as well as on the Firestore read, so an assignment built in
    // memory (the demo cohort, a test fixture) with a since-split area still scopes
    // correctly — normaliseAreas is pure and idempotent.
    areas: normaliseAreas(assignment.scope.areas),
    category: assignment.scope.category,
    groups: assignment.scope.groups?.length ? assignment.scope.groups : undefined,
    mode: 'assessment',
    count: assignment.questionCount,
  };
}

/**
 * "Hip flexors, Hip adductors · Hip", "Muscles · Shoulder, Elbow",
 * "Everything · Ankle & Foot". Groups lead when present because they are the
 * specific thing the educator chose; the category is implied by them (only
 * muscles carry groups) so naming both would read "Muscles · Hip flexors".
 */
export function describeAssignmentScope(scope: AssignmentScope): string {
  const areas = normaliseAreas(scope.areas).map((a) => AREA_LABELS[a]).join(', ');
  if (scope.groups?.length) {
    return `${scope.groups.map((g) => MUSCLE_GROUP_LABELS[g] ?? g).join(', ')} · ${areas}`;
  }
  return `${scope.category ? CATEGORY_LABELS[scope.category] : 'Everything'} · ${areas}`;
}

/**
 * What a scope and a format list would build: how many structures are in
 * scope, and how many questions the generator can make from them, which is
 * the ceiling on an attempt's length. The create form shows it live and the
 * built-in templates are tested against it, so a preset can never be one
 * that builds nothing.
 *
 * Over EVERY area, not the educator's own entitlement: this previews what the
 * cohort will be set, and an educator on a free account must still be able
 * to set work covering the whole body.
 */
export function previewAssignment(scope: AssignmentScope, types: readonly QuestionType[]): { poolSize: number; available: number } {
  if (scope.areas.length === 0 || types.length === 0) return { poolSize: 0, available: 0 };
  return {
    poolSize: filterStructures(ALL_STRUCTURES, scope).length,
    // Practice with learn cards off counts every question the scope can build.
    available: generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      entitledAreas: EVERY_AREA,
      ...scope,
      types: [...types],
      mode: 'practice',
      learnCardAttempts: 0,
      seed: 1,
    }).length,
  };
}
