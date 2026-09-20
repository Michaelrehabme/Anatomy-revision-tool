import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import { normaliseAreas } from '../../anatomy-revision/types/region';
import type { QuestionType } from '../../anatomy-revision/types/question';
import type { AssignmentScope } from '../types/cohort';
import type { AssignmentTemplate, NewAssignmentTemplate } from '../lib/assignmentTemplates';

/**
 * An educator's own assignment templates, at
 * users/{uid}/assignmentTemplates/{templateId}.
 *
 * Under the educator's own document rather than a cohort, because a template
 * is a way of setting work rather than a piece of work set: the same "knee,
 * everything, twenty questions" serves every class they teach. The owner-only
 * rule on users/{uid}/** in firestore.rules already covers it.
 */
function toTemplate(id: string, data: Record<string, unknown>): AssignmentTemplate {
  const scope = data.scope as AssignmentScope;
  return {
    id,
    title: data.title as string,
    blurb: typeof data.blurb === 'string' ? data.blurb : undefined,
    scope: { ...scope, areas: normaliseAreas(scope.areas) },
    questionTypes: data.questionTypes as QuestionType[],
    questionCount: data.questionCount as number,
    defaultTargetAccuracyPct: data.defaultTargetAccuracyPct as number,
  };
}

export async function listTemplates(uid: string): Promise<AssignmentTemplate[]> {
  const snapshot = await getDocs(query(collection(getDb(), 'users', uid, 'assignmentTemplates'), orderBy('title')));
  return snapshot.docs.map((d) => toTemplate(d.id, d.data()));
}

export async function saveTemplate(uid: string, input: NewAssignmentTemplate): Promise<AssignmentTemplate> {
  const id = crypto.randomUUID();
  // Firestore rejects undefined field values; an unset category, an empty
  // group list and a missing blurb are all "nothing here" and are left off.
  const body = {
    title: input.title,
    ...(input.blurb ? { blurb: input.blurb } : {}),
    scope: {
      areas: input.scope.areas,
      ...(input.scope.category ? { category: input.scope.category } : {}),
      ...(input.scope.groups?.length ? { groups: input.scope.groups } : {}),
    },
    questionTypes: input.questionTypes,
    questionCount: input.questionCount,
    defaultTargetAccuracyPct: input.defaultTargetAccuracyPct,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(getDb(), 'users', uid, 'assignmentTemplates', id), body);
  return { id, ...body };
}

export async function deleteTemplate(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'users', uid, 'assignmentTemplates', id));
}
