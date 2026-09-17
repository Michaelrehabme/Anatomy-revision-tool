export type ChangeCategory = 'auth' | 'analytics' | 'content' | 'gamification' | 'infrastructure' | 'clinical';
export type ChangePriority = 'p0' | 'p1' | 'p2';
export type ChangeEffort = 's' | 'm' | 'l';
export type ChangeStatus = 'new' | 'inProgress' | 'completed';

/**
 * One tickable step inside a change request.
 *
 * The *definition* (id, rank, label, walkthrough) lives in
 * data/changeRequests.seed.ts and is version-controlled; only the tick state
 * lives in Firestore, as ChangeRequest.checklistDone keyed by `id`. That split
 * is deliberate — it means editing a walkthrough in git reaches an admin who
 * has already ticked half the list, instead of being frozen at seed time.
 * Never renumber or reuse an `id`: it is the only thing joining a stored tick
 * to the step it belongs to.
 */
/** A resource a checklist step points at — a regulator page, a form, a register. */
export interface ChecklistLink {
  label: string;
  url: string;
}

export interface ChecklistItem {
  /** Stable key, never reused — joins a stored tick to this step. */
  id: string;
  /** 1 = most important. Sorted on, not just displayed; ties break on id. */
  rank: number;
  /** One line, imperative: what to do. */
  label: string;
  /** Why this ranks where it does, in a sentence or two. */
  why: string;
  /** The walkthrough — numbered steps, one per line, concrete enough to act on. */
  walkthrough: string;
  /** Realistic wall-clock, e.g. '1 hour', 'half a day', 'ongoing'. */
  effort: string;
  /**
   * Where to actually go to do it. Absent on steps that touch only this repo —
   * those name files instead, and a file path is not a link worth faking.
   */
  links?: ChecklistLink[];
}

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
  /**
   * Step definitions, from the seed. Absent on the many change requests that
   * are a single indivisible piece of work — a checklist is for the ones made
   * of separately-completable tasks.
   */
  checklist?: ChecklistItem[];
  /**
   * Tick state, from Firestore: checklist item id -> ISO timestamp it was
   * ticked. An id missing from the record is unticked; there is no `false`.
   * Keeping the timestamp rather than a boolean is what makes "what did I
   * actually get done in September" answerable later.
   */
  checklistDone?: Record<string, string>;
}

/** Fields the "new change request" form collects; timestamps/status are set by the create flow, not typed in. */
export type NewChangeRequestInput = Omit<
  ChangeRequest,
  'status' | 'createdAt' | 'startedAt' | 'completedAt' | 'checklistDone'
>;

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
