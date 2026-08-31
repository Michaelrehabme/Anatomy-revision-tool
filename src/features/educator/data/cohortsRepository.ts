import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteField } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import { generateJoinCode } from '../lib/joinCode';
import type { Cohort, CohortStudent } from '../types/cohort';

/**
 * cohorts/{cohortId} lives outside users/{uid} and outside AnatomyRepository
 * entirely — it's account/organisation metadata (CR-012), not anatomy
 * content or revision history, same reasoning as touchUserProfile in
 * anatomy-revision/data/firebase.ts. See firestore.rules: any signed-in user
 * can read a cohort doc (needed to resolve a join code), but only an admin
 * can create/edit one — the real access boundary for STUDENT DATA is the
 * educator custom claim's `cohorts` array (scripts/setEducator.ts), checked
 * server-side on users/attemptEvents, never this collection's own rule.
 */

function toCohort(id: string, data: Record<string, unknown>): Cohort {
  return {
    id,
    name: data.name as string,
    institution: data.institution as string,
    ownerUid: data.ownerUid as string,
    joinCode: data.joinCode as string,
    createdAt: data.createdAt as string,
    archivedAt: (data.archivedAt as string | null) ?? null,
  };
}

/** Admin-only (see firestore.rules) — creates the cohort doc an admin then grants an educator access to via scripts/setEducator.ts. */
export async function createCohort(input: { name: string; institution: string; ownerUid: string }): Promise<Cohort> {
  const db = getDb();
  const id = crypto.randomUUID();

  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await getCohortByJoinCode(joinCode))) break;
    joinCode = generateJoinCode();
  }

  const cohort: Cohort = {
    id,
    name: input.name,
    institution: input.institution,
    ownerUid: input.ownerUid,
    joinCode,
    createdAt: new Date().toISOString(),
    archivedAt: null,
  };
  await setDoc(doc(db, 'cohorts', id), cohort);
  return cohort;
}

/** Admin-only screen use (see firestore.rules — any signed-in user can technically read the whole collection, but only /admin/cohorts actually lists it). */
export async function listAllCohorts(): Promise<Cohort[]> {
  const snapshot = await getDocs(collection(getDb(), 'cohorts'));
  return snapshot.docs.map((d) => toCohort(d.id, d.data()));
}

export async function getCohort(id: string): Promise<Cohort | null> {
  const snapshot = await getDoc(doc(getDb(), 'cohorts', id));
  return snapshot.exists() ? toCohort(snapshot.id, snapshot.data()) : null;
}

export async function getCohortByJoinCode(joinCode: string): Promise<Cohort | null> {
  const snapshot = await getDocs(query(collection(getDb(), 'cohorts'), where('joinCode', '==', joinCode)));
  const found = snapshot.docs[0];
  return found ? toCohort(found.id, found.data()) : null;
}

/** Batch fetch for an educator's own claimed cohort ids (typically a handful) — one get() per id rather than a Firestore `in` query, so it degrades gracefully past the 30-id `in` limit. */
export async function listCohortsByIds(ids: string[]): Promise<Cohort[]> {
  const cohorts = await Promise.all(ids.map((id) => getCohort(id)));
  return cohorts.filter((c): c is Cohort => c !== null);
}

/** Every users/{uid} profile with cohort === cohortId — see firestore.rules' educator-scoped read rule on users/{uid}. */
export async function listStudentsInCohort(cohortId: string): Promise<CohortStudent[]> {
  const snapshot = await getDocs(query(collection(getDb(), 'users'), where('cohort', '==', cohortId)));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      displayName: (data.displayName as string | null) ?? null,
      email: (data.email as string | null) ?? null,
      joinedAt: (data.cohortJoinedAt as string | null) ?? null,
      lastActiveAt: (data.lastActiveAt as string | null) ?? null,
    };
  });
}

/** Student-initiated: looks up the code, then sets users/{uid}.cohort. Explicit and revocable, per CR-012's privacy requirement — never joined implicitly. */
export async function joinCohortByCode(uid: string, joinCode: string): Promise<Cohort> {
  const cohort = await getCohortByJoinCode(joinCode.trim().toUpperCase());
  if (!cohort) throw new Error('No cohort found with that code — check it and try again.');
  await setDoc(
    doc(getDb(), 'users', uid),
    { cohort: cohort.id, cohortJoinedAt: new Date().toISOString() },
    { merge: true },
  );
  return cohort;
}

/** Student-initiated: clears users/{uid}.cohort. Leaving is always available and immediate — see CR-012's "make leaving straightforward" requirement. */
export async function leaveCohort(uid: string): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), { cohort: null, cohortJoinedAt: deleteField() }, { merge: true });
}

export async function getMyCohort(uid: string): Promise<Cohort | null> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  const cohortId = snapshot.exists() ? (snapshot.data().cohort as string | null) : null;
  return cohortId ? getCohort(cohortId) : null;
}
