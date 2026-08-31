import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { Region } from '../../anatomy-revision/types/region';
import type { Assignment } from '../types/cohort';

function toAssignment(cohortId: string, id: string, data: Record<string, unknown>): Assignment {
  return {
    id,
    cohortId,
    region: data.region as Region,
    title: data.title as string,
    dueAt: data.dueAt as string,
    createdAt: data.createdAt as string,
    createdBy: data.createdBy as string,
  };
}

export async function listAssignments(cohortId: string): Promise<Assignment[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), 'cohorts', cohortId, 'assignments'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.map((d) => toAssignment(cohortId, d.id, d.data()));
}

export async function createAssignment(input: {
  cohortId: string;
  region: Region;
  title: string;
  dueAt: string;
  createdBy: string;
}): Promise<Assignment> {
  const id = crypto.randomUUID();
  const assignment: Assignment = {
    id,
    cohortId: input.cohortId,
    region: input.region,
    title: input.title,
    dueAt: input.dueAt,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  await setDoc(doc(getDb(), 'cohorts', input.cohortId, 'assignments', id), assignment);
  return assignment;
}
