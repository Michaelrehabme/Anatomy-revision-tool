import { DEMO_COHORTS, demoStudentsInCohort } from './demoData';
import { generateJoinCode } from '../lib/joinCode';
import type { Cohort, CohortStudent } from '../types/cohort';

/**
 * Demo-mode stand-in for data/cohortsRepository.ts, swapped in by the
 * VITE_EDUCATOR_DEMO alias in vite.config.ts. Same exported signatures, no
 * Firestore — see README "Educator demo mode".
 *
 * Writes are in-memory and deliberately not persisted: a demo that
 * accumulated yesterday's clicking is worse than one that resets.
 */

const cohorts = [...DEMO_COHORTS];

export async function createCohort(input: { name: string; institution: string; ownerUid: string }): Promise<Cohort> {
  const cohort: Cohort = {
    id: `demo-cohort-${cohorts.length + 1}`,
    name: input.name,
    institution: input.institution,
    ownerUid: input.ownerUid,
    // Real codes are claimed as a joinCodes/{CODE} document id; here it just needs to look like one.
    joinCode: generateJoinCode(),
    createdAt: new Date().toISOString(),
    archivedAt: null,
  };
  cohorts.push(cohort);
  return cohort;
}

/**
 * Cohorts owned by this person. Demo mode hands back the fixture classes
 * whoever asks: the demo's signed-in uid is a locally generated one, so
 * matching on ownerUid would show an empty "create your first class" state
 * and hide the populated screens this mode exists to show.
 */
export async function listCohortsOwnedBy(ownerUid: string): Promise<Cohort[]> {
  return cohorts.map((cohort) => ({ ...cohort, ownerUid }));
}

export async function listAllCohorts(): Promise<Cohort[]> {
  return [...cohorts];
}

export async function getCohort(id: string): Promise<Cohort | null> {
  return cohorts.find((c) => c.id === id) ?? null;
}

export async function getCohortByJoinCode(joinCode: string): Promise<Cohort | null> {
  return cohorts.find((c) => c.joinCode === joinCode.trim().toUpperCase()) ?? null;
}

export async function listCohortsByIds(ids: string[]): Promise<Cohort[]> {
  return cohorts.filter((c) => ids.includes(c.id));
}

export async function listStudentsInCohort(cohortId: string): Promise<CohortStudent[]> {
  return demoStudentsInCohort(cohortId);
}

/** Whoever "joins" during a demo session, so join -> leave -> join can actually be clicked through. Cleared by a reload, like everything else here. */
const membership = new Map<string, string>();

export async function joinCohortByCode(uid: string, joinCode: string): Promise<Cohort> {
  const cohort = await getCohortByJoinCode(joinCode);
  if (!cohort) throw new Error('No cohort found with that code — check it and try again.');
  membership.set(uid, cohort.id);
  return cohort;
}

export async function leaveCohort(uid: string): Promise<void> {
  membership.delete(uid);
}

export async function getMyCohort(uid: string): Promise<Cohort | null> {
  const joined = membership.get(uid);
  return joined ? await getCohort(joined) : null;
}
