export type ChangeCategory = 'auth' | 'analytics' | 'content' | 'gamification' | 'infrastructure' | 'clinical';
export type ChangePriority = 'p0' | 'p1' | 'p2';
export type ChangeEffort = 's' | 'm' | 'l';
export type ChangeStatus = 'new' | 'inProgress' | 'completed';

export interface ChangeRequest {
  ref: string;
  title: string;
  category: ChangeCategory;
  priority: ChangePriority;
  effort: ChangeEffort;
  status: ChangeStatus;
  description: string;
  /** The full Claude Code prompt, verbatim — copied by the detail panel's copy button. */
  prompt: string;
  /** Refs of other ChangeRequests this one depends on. */
  dependsOn: string[];
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
}

/** Fields the "new change request" form collects; timestamps/status are set by the create flow, not typed in. */
export type NewChangeRequestInput = Omit<ChangeRequest, 'status' | 'createdAt' | 'startedAt' | 'completedAt'>;

export const CHANGE_CATEGORIES: ChangeCategory[] = [
  'auth',
  'analytics',
  'content',
  'gamification',
  'infrastructure',
  'clinical',
];
export const CHANGE_PRIORITIES: ChangePriority[] = ['p0', 'p1', 'p2'];
export const CHANGE_EFFORTS: ChangeEffort[] = ['s', 'm', 'l'];
export const CHANGE_STATUSES: ChangeStatus[] = ['new', 'inProgress', 'completed'];

export const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  auth: 'Auth',
  analytics: 'Analytics',
  content: 'Content',
  gamification: 'Gamification',
  infrastructure: 'Infrastructure',
  clinical: 'Clinical',
};

export const CHANGE_PRIORITY_LABELS: Record<ChangePriority, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
};

export const CHANGE_EFFORT_LABELS: Record<ChangeEffort, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
};

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  new: 'New',
  inProgress: 'In progress',
  completed: 'Completed',
};
