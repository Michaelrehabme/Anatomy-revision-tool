import { collection, deleteField, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDb } from '../../anatomy-revision/data/firebase';
import { generateJoinCode } from '../lib/joinCode';
import type { Cohort, CohortStudent } from '../types/cohort';

/**
 * cohorts/{cohortId} lives outside users/{uid} and outside AnatomyRepository
 * entirely — it's account/organisation metadata, not anatomy content or
 * revision history, same reasoning as touchUserProfile in
 * anatomy-revision/data/firebase.ts.
 *
 * Creating a cohort is self-service: any signed-in user may create one, and
 * doing so makes them its owner. Ownership is the access boundary — see
 * firestore.rules — so there is no role to be granted first and no admin in
 * the loop. A student is only ever visible to the owner of a cohort they
 * chose to join.
 */

function toCohort(id: string, data: Record<string, unknown>): Cohort {
  return {
    id,
    name: data.name as string,
    institution: (data.institution as string) ?? '',
    ownerUid: data.ownerUid as string,
    joinCode: data.joinCode as string,
    createdAt: data.createdAt as string,
    archivedAt: (data.archivedAt as string | null) ?? null,
  };
}

const CODE_ATTEMPTS = 8;

/**
 * Claims a join code by writing joinCodes/{CODE} — the code is the document
 * id, so Firestore's create fails if it already exists and uniqueness is
 * settled by the database. The old "generate, query for a match, hope"
 * approach could hand the same code to two people creating a class at the
 * same moment, which would send one class's students into the other's roster.
 */
async function claimJoinCode(cohortId: string, ownerUid: string): Promise<string> {
  const db = getDb();

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateJoinCode();
    try {
      // create-only: setDoc with a doc that exists is an overwrite, so the
      // guard is the rules' `allow update: if false` on this collection.
      await setDoc(doc(db, 'joinCodes', code), { cohortId, ownerUid, createdAt: new Date().toISOString() });
      return code;
    } catch {
      // Taken (or refused) — try another. 31^6 ≈ 887 million codes, so this loop
      // effectively never runs twice until the platform is enormous.
    }
  }

  throw new Error('Could not allocate a join code. Please try again.');
}

/** Self-service: the signed-in user becomes the owner, and owning it is what grants access to the students who join. */
export async function createCohort(input: { name: string; institution: string; ownerUid: string }): Promise<Cohort> {
  const db = getDb();
  const id = crypto.randomUUID();
  const joinCode = await claimJoinCode(id, input.ownerUid);

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

/** Admin-only: firestore.rules allows an unfiltered list of the collection to admins alone. */
export async function listAllCohorts(): Promise<Cohort[]> {
  const snapshot = await getDocs(collection(getDb(), 'cohorts'));
  return snapshot.docs.map((d) => toCohort(d.id, d.data()));
}

/**
 * Every cohort this person owns — the educator's own list, and the query the
 * rules are shaped around: filtering by ownerUid is what makes the list
 * permitted at all, since an unfiltered read would expose every class on the
 * platform.
 */
export async function listCohortsOwnedBy(ownerUid: string): Promise<Cohort[]> {
  const snapshot = await getDocs(query(collection(getDb(), 'cohorts'), where('ownerUid', '==', ownerUid)));
  return snapshot.docs.map((d) => toCohort(d.id, d.data())).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getCohort(id: string): Promise<Cohort | null> {
  const snapshot = await getDoc(doc(getDb(), 'cohorts', id));
  return snapshot.exists() ? toCohort(snapshot.id, snapshot.data()) : null;
}

/** Resolves a code through joinCodes/{CODE} — one get() by id, so nobody needs list access to the cohorts collection. */
export async function getCohortByJoinCode(joinCode: string): Promise<Cohort | null> {
  const snapshot = await getDoc(doc(getDb(), 'joinCodes', joinCode.trim().toUpperCase()));
  if (!snapshot.exists()) return null;
  return getCohort(snapshot.data().cohortId as string);
}

/** Batch fetch by id — one get() per id rather than a Firestore `in` query, so it degrades gracefully past the 30-id `in` limit. */
export async function listCohortsByIds(ids: string[]): Promise<Cohort[]> {
  const cohorts = await Promise.all(ids.map((id) => getCohort(id)));
  return cohorts.filter((c): c is Cohort => c !== null);
}

/** Every users/{uid} profile with cohort === cohortId — see firestore.rules' ownership-scoped read rule on users/{uid}. */
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

/** Student-initiated: looks up the code, then sets users/{uid}.cohort. Explicit and revocable — never joined implicitly. */
export async function joinCohortByCode(uid: string, joinCode: string): Promise<Cohort> {
  const cohort = await getCohortByJoinCode(joinCode);
  if (!cohort) throw new Error('No cohort found with that code — check it and try again.');
  await setDoc(
    doc(getDb(), 'users', uid),
    { cohort: cohort.id, cohortJoinedAt: new Date().toISOString() },
    { merge: true },
  );
  return cohort;
}

/** Student-initiated: clears users/{uid}.cohort. Leaving is always available and immediate. */
export async function leaveCohort(uid: string): Promise<void> {
  await setDoc(doc(getDb(), 'users', uid), { cohort: null, cohortJoinedAt: deleteField() }, { merge: true });
}

export async function getMyCohort(uid: string): Promise<Cohort | null> {
  const snapshot = await getDoc(doc(getDb(), 'users', uid));
  const cohortId = snapshot.exists() ? (snapshot.data().cohort as string | null) : null;
  return cohortId ? getCohort(cohortId) : null;
}
