import type { ChangeRequest, ChangeStatus } from '../types/changeRequest';

export interface StatusTransitionResult {
  status: ChangeStatus;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Pure status-transition rule for the Change Register's inline status editor.
 * Moving to "inProgress" stamps startedAt; moving to "completed" stamps
 * completedAt — both only on first arrival (toggling back and forth doesn't
 * clobber the original stamp), matching how the rest of this codebase treats
 * timestamps as client-generated ISO strings (see lib/mastery.ts).
 */
export function applyStatusTransition(
  current: Pick<ChangeRequest, 'status' | 'startedAt' | 'completedAt'>,
  nextStatus: ChangeStatus,
  now: Date = new Date(),
): StatusTransitionResult {
  if (nextStatus === current.status) {
    return { status: current.status, startedAt: current.startedAt, completedAt: current.completedAt };
  }

  const startedAt = nextStatus === 'inProgress' && !current.startedAt ? now.toISOString() : current.startedAt;
  const completedAt = nextStatus === 'completed' && !current.completedAt ? now.toISOString() : current.completedAt;

  return { status: nextStatus, startedAt, completedAt };
}

/**
 * Refs in `dependsOn` that are not yet completed, per the current known
 * status of every change request (looked up by ref). Powers the
 * "moving to inProgress while a dependency isn't done" warning — the caller
 * decides whether to only compute/show this for a transition into
 * "inProgress"; this function itself just answers "what's still open".
 */
export function findIncompleteDependencies(
  dependsOn: string[],
  statusByRef: ReadonlyMap<string, ChangeStatus>,
): string[] {
  return dependsOn.filter((ref) => statusByRef.get(ref) !== 'completed');
}
