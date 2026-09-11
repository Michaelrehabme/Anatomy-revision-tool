import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { Region } from '../../anatomy-revision/types/region';
import type { QuestionType } from '../../anatomy-revision/types/question';
import type { Assignment, AssignmentScope, NewAssignment, ScopedAssignment } from '../types/cohort';

/** Both generations live in one collection — a document with a scope is a scoped assignment, one without is a region assignment. */
function toAssignment(cohortId: string, id: string, data: Record<string, unknown>): Assignment {
  const base = {
    id,
    cohortId,
    title: data.title as string,
    dueAt: data.dueAt as string,
    createdAt: data.createdAt as string,
    createdBy: data.createdBy as string,
  };
  if (data.scope) {
    return {
      ...base,
      scope: data.scope as AssignmentScope,
      questionTypes: data.questionTypes as QuestionType[],
      questionCount: data.questionCount as number,
      targetAccuracyPct: data.targetAccuracyPct as number,
    };
  }
  return { ...base, region: data.region as Region };
}

export async function listAssignments(cohortId: string): Promise<Assignment[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), 'cohorts', cohortId, 'assignments'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((d) => toAssignment(cohortId, d.id, d.data()));
}

export async function createAssignment(input: NewAssignment): Promise<ScopedAssignment> {
  const id = crypto.randomUUID();
  const assignment: ScopedAssignment = {
    ...input,
    // Firestore rejects undefined field values, and an unset category or an
    // empty group list both mean "no restriction" — so they are left off.
    scope: {
      areas: input.scope.areas,
      ...(input.scope.category ? { category: input.scope.category } : {}),
      ...(input.scope.groups?.length ? { groups: input.scope.groups } : {}),
    },
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(getDb(), 'cohorts', input.cohortId, 'assignments', id), assignment);
  return assignment;
}
