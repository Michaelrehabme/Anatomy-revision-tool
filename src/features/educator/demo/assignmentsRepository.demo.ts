import { DEMO_ASSIGNMENTS } from './demoData';
import type { Region } from '../../anatomy-revision/types/region';
import type { Assignment } from '../types/cohort';

/**
 * Demo-mode stand-in for data/assignmentsRepository.ts (see that file, and
 * README "Educator demo mode"). Assignments created here live in memory for
 * the session so the create form can actually be exercised, then reset.
 */

export async function listAssignments(cohortId: string): Promise<Assignment[]> {
  return DEMO_ASSIGNMENTS.filter((a) => a.cohortId === cohortId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAssignment(input: {
  cohortId: string;
  region: Region;
  title: string;
  dueAt: string;
  createdBy: string;
}): Promise<Assignment> {
  const assignment: Assignment = {
    id: `demo-assignment-${DEMO_ASSIGNMENTS.length + 1}`,
    cohortId: input.cohortId,
    region: input.region,
    title: input.title,
    dueAt: input.dueAt,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  DEMO_ASSIGNMENTS.push(assignment);
  return assignment;
}
