import { DEMO_ASSIGNMENTS } from './demoData';
import type { Assignment, NewAssignment, ScopedAssignment } from '../types/cohort';

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
