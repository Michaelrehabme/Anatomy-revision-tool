import type { RevisionSetConfig } from '../../anatomy-revision/lib/questionGenerators/generateSet';
import type { QuestionType } from '../../anatomy-revision/types/question';
import { AREA_LABELS } from '../../anatomy-revision/types/region';
import { MUSCLE_GROUP_LABELS, type Category } from '../../anatomy-revision/types/structure';
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

export const CATEGORY_LABELS: Record<Category, string> = {
  muscle: 'Muscles',
  bone: 'Bones',
  landmark: 'Landmarks',
  joint: 'Joints',
};

/**
 * Exam mode: no feedback until the end, and never a learn card — an attempt is
 * a measurement against the pass mark, and a card that shows the answer first
 * would make the measurement meaningless. Everything else matches what the
 * study screen would build for the same choices.
 */
export function assignmentSetConfig(assignment: ScopedAssignment): RevisionSetConfig {
  return {
    types: assignment.questionTypes,
    areas: assignment.scope.areas,
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
  const areas = scope.areas.map((a) => AREA_LABELS[a]).join(', ');
  if (scope.groups?.length) {
    return `${scope.groups.map((g) => MUSCLE_GROUP_LABELS[g] ?? g).join(', ')} · ${areas}`;
  }
  return `${scope.category ? CATEGORY_LABELS[scope.category] : 'Everything'} · ${areas}`;
}
