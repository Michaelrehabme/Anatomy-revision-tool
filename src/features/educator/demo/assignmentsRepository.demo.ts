import { DEMO_ASSIGNMENTS } from './demoData';
import type { Assignment, ChallengeAssignment, NewAssignment, NewChallenge, ScopedAssignment } from '../types/cohort';
import { challengeEnd, regionOfArea } from '../lib/classChallenge';

/**
 * Demo-mode stand-in for data/assignmentsRepository.ts (see that file, and
 * README "Educator demo mode"). Assignments created here live in memory for
 * the session so the create form can actually be exercised, then reset.
 */

export async function listAssignments(cohortId: string): Promise<Assignment[]> {
  return DEMO_ASSIGNMENTS.filter((a) => a.cohortId === cohortId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAssignment(input: NewAssignment): Promise<ScopedAssignment> {
  const assignment: ScopedAssignment = {
    ...input,
    id: `demo-assignment-${DEMO_ASSIGNMENTS.length + 1}`,
    createdAt: new Date().toISOString(),
  };
  DEMO_ASSIGNMENTS.push(assignment);
  return assignment;
}

/** Challenges set in the demo live in memory for the session, like assignments. */
const DEMO_CHALLENGES: ChallengeAssignment[] = [];

export async function listChallenges(cohortId: string): Promise<ChallengeAssignment[]> {
  return DEMO_CHALLENGES.filter((c) => c.cohortId === cohortId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createChallenge(input: NewChallenge): Promise<ChallengeAssignment> {
  const challenge: ChallengeAssignment = {
    ...input,
    kind: 'challenge',
    region: regionOfArea(input.area),
    dueAt: challengeEnd(input.weekStart).toISOString(),
    id: `demo-challenge-${DEMO_CHALLENGES.length + 1}`,
    createdAt: new Date().toISOString(),
  };
  DEMO_CHALLENGES.push(challenge);
  return challenge;
}
