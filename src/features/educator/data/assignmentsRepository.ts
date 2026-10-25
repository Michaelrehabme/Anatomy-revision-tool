import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import type { Region } from '../../anatomy-revision/types/region';
import { normaliseAreas } from '../../anatomy-revision/types/region';
import type { QuestionType } from '../../anatomy-revision/types/question';
import type { Area } from '../../anatomy-revision/types/region';
import { AREAS } from '../../anatomy-revision/types/region';
import type { Assignment, AssignmentScope, ChallengeAssignment, NewAssignment, NewChallenge, ScopedAssignment } from '../types/cohort';
import { challengeEnd, regionOfArea } from '../lib/classChallenge';

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
    const scope = data.scope as AssignmentScope;
    return {
      ...base,
      // Areas are normalised on the way out of Firestore: a document written before an
      // area was split still names the old value (CR-032), and an unknown area would
      // render a blank chip and match no structure.
      scope: { ...scope, areas: normaliseAreas(scope.areas) },
      questionTypes: data.questionTypes as QuestionType[],
      questionCount: data.questionCount as number,
      targetAccuracyPct: data.targetAccuracyPct as number,
    };
  }
  return { ...base, region: data.region as Region };
}

/** Assignments only: weekly challenges share the collection and are read by listChallenges instead. */
export async function listAssignments(cohortId: string): Promise<Assignment[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), 'cohorts', cohortId, 'assignments'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs.filter((d) => d.data().kind !== 'challenge').map((d) => toAssignment(cohortId, d.id, d.data()));
}

function toChallenge(cohortId: string, id: string, data: Record<string, unknown>): ChallengeAssignment | null {
  const area = data.area as Area;
  if (!AREAS.includes(area) || typeof data.weekStart !== 'string' || typeof data.targetSecure !== 'number') return null;
  return {
    id,
    cohortId,
    kind: 'challenge',
    title: data.title as string,
    dueAt: data.dueAt as string,
    createdAt: data.createdAt as string,
    createdBy: data.createdBy as string,
    area,
    targetSecure: data.targetSecure,
    weekStart: data.weekStart,
    region: regionOfArea(area),
  };
}

/** Weekly class challenges, newest first (types/cohort.ts ChallengeAssignment). */
export async function listChallenges(cohortId: string): Promise<ChallengeAssignment[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), 'cohorts', cohortId, 'assignments'), orderBy('createdAt', 'desc')),
  );
  return snapshot.docs
    .filter((d) => d.data().kind === 'challenge')
    .map((d) => toChallenge(cohortId, d.id, d.data()))
    .filter((c): c is ChallengeAssignment => !!c);
}

export async function createChallenge(input: NewChallenge): Promise<ChallengeAssignment> {
  const id = crypto.randomUUID();
  const challenge: ChallengeAssignment = {
    ...input,
    kind: 'challenge',
    region: regionOfArea(input.area),
    dueAt: challengeEnd(input.weekStart).toISOString(),
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(getDb(), 'cohorts', input.cohortId, 'assignments', id), challenge);
  return challenge;
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
