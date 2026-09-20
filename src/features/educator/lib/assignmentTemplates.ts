import type { QuestionType } from '../../anatomy-revision/types/question';
import { AREAS, AREA_LABELS, type Area } from '../../anatomy-revision/types/region';
import type { AssignmentScope, NewAssignment } from '../types/cohort';
import { ASSIGNMENT_QUESTION_TYPES, DEFAULT_ASSIGNMENT_QUESTION_COUNT, DEFAULT_TARGET_ACCURACY_PCT } from './assignmentScope';

/**
 * A reusable assignment definition: everything the create form sets except
 * the two things that change every time — the due date and the pass mark.
 *
 * Educators set the same shape of work term after term ("knee, everything,
 * twenty questions, before the practical"), and the form remembered nothing
 * between visits. A template is that shape with a name. Nine ship built in,
 * one per study area, so a new class can be set work with a date and a pass
 * mark and nothing else; an educator's own are saved to their account
 * (data/assignmentTemplatesRepository) and appear beside them.
 *
 * Pure and Firebase-free, like assignmentScope.ts, for the same reason.
 */
export interface AssignmentTemplate {
  id: string;
  title: string;
  /** One line under the title in the picker. */
  blurb?: string;
  scope: AssignmentScope;
  questionTypes: QuestionType[];
  questionCount: number;
  /** Suggested pass mark; the educator confirms it on every assignment. */
  defaultTargetAccuracyPct: number;
  /** Ships with the app rather than saved by an educator. */
  builtIn?: boolean;
}

/** What an educator saves; the id and the flag are the repository's. */
export type NewAssignmentTemplate = Omit<AssignmentTemplate, 'id' | 'builtIn'>;

const EVERY_FORMAT = ASSIGNMENT_QUESTION_TYPES.map((t) => t.value);

/**
 * One per area, every kind of structure, every graded format, twenty
 * questions, seventy percent. Wide on purpose: an area is the unit a module
 * is taught in, and the point of a preset is that nothing needs choosing.
 */
export const BUILT_IN_TEMPLATES: AssignmentTemplate[] = AREAS.map((area: Area) => ({
  id: `built-in:${area}`,
  title: AREA_LABELS[area],
  blurb: `Every structure of the ${AREA_LABELS[area].toLowerCase()}, all formats`,
  scope: { areas: [area] },
  questionTypes: [...EVERY_FORMAT],
  questionCount: DEFAULT_ASSIGNMENT_QUESTION_COUNT,
  defaultTargetAccuracyPct: DEFAULT_TARGET_ACCURACY_PCT,
  builtIn: true,
}));

export interface ApplyTemplateInput {
  cohortId: string;
  createdBy: string;
  /** ISO timestamp, already at the end of the chosen day (see CreateAssignmentForm). */
  dueAt: string;
  targetAccuracyPct: number;
  /** Defaults to the template's title. */
  title?: string;
}

/** A template plus the two per-assignment choices is a complete assignment. */
export function applyTemplate(template: AssignmentTemplate, input: ApplyTemplateInput): NewAssignment {
  return {
    cohortId: input.cohortId,
    createdBy: input.createdBy,
    title: (input.title ?? template.title).trim(),
    dueAt: input.dueAt,
    scope: {
      areas: [...template.scope.areas],
      ...(template.scope.category ? { category: template.scope.category } : {}),
      ...(template.scope.groups?.length ? { groups: [...template.scope.groups] } : {}),
    },
    questionTypes: [...template.questionTypes],
    questionCount: template.questionCount,
    targetAccuracyPct: input.targetAccuracyPct,
  };
}

/** The reverse: what the form has set, saved under a name. */
export function templateFromChoices(
  title: string,
  choices: { scope: AssignmentScope; questionTypes: QuestionType[]; questionCount: number; targetAccuracyPct: number },
): NewAssignmentTemplate {
  return {
    title: title.trim(),
    scope: {
      areas: [...choices.scope.areas],
      ...(choices.scope.category ? { category: choices.scope.category } : {}),
      ...(choices.scope.groups?.length ? { groups: [...choices.scope.groups] } : {}),
    },
    questionTypes: [...choices.questionTypes],
    questionCount: choices.questionCount,
    defaultTargetAccuracyPct: choices.targetAccuracyPct,
  };
}

/** Whether the form's current choices are exactly this template's, so the picker can show it as selected. */
export function matchesTemplate(
  template: AssignmentTemplate,
  choices: { scope: AssignmentScope; questionTypes: QuestionType[]; questionCount: number },
): boolean {
  const same = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
    [...(a ?? [])].sort().join('|') === [...(b ?? [])].sort().join('|');
  return (
    same(template.scope.areas, choices.scope.areas) &&
    (template.scope.category ?? null) === (choices.scope.category ?? null) &&
    same(template.scope.groups, choices.scope.groups) &&
    same(template.questionTypes, choices.questionTypes) &&
    template.questionCount === choices.questionCount
  );
}
