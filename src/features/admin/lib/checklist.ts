import type { ChecklistItem } from '../types/changeRequest';

/**
 * Pure rules for the Change Register's per-request checklist.
 *
 * Tick state is a Record<itemId, isoTimestamp> rather than a boolean map: the
 * question worth answering months later is "when did this get done", and a
 * boolean throws that away. Absence means unticked — there is no stored
 * `false`, so an item added to the seed after an admin started ticking simply
 * arrives unticked rather than needing a migration.
 */
export type ChecklistDone = Record<string, string>;

/** Rank order, ties broken on id so the list never reshuffles between renders. */
export function sortChecklist(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

export function isChecklistItemDone(done: ChecklistDone | undefined, id: string): boolean {
  return typeof done?.[id] === 'string';
}

/**
 * Ticking stamps now; unticking removes the key entirely rather than writing
 * null, so the stored shape stays "only what is done" and Firestore documents
 * don't accumulate tombstones for every item ever unticked.
 *
 * This is a plain toggle: unticking discards the original timestamp, and
 * re-ticking stamps the new time. That is the honest reading of "I hadn't
 * actually finished it" — but it does mean an accidental untick-retick loses
 * the real completion date, so the panel asks for a second click on untick.
 */
export function toggleChecklistItem(
  done: ChecklistDone | undefined,
  id: string,
  now: Date = new Date(),
): ChecklistDone {
  const current = done ?? {};
  if (isChecklistItemDone(current, id)) {
    const next = { ...current };
    delete next[id];
    return next;
  }
  return { ...current, [id]: now.toISOString() };
}

export interface ChecklistProgress {
  completed: number;
  total: number;
  /** 0–1. A checklist with no items reads as 0, not NaN. */
  fraction: number;
  /** Highest-ranked item not yet ticked — what to do next. Null when finished. */
  nextUp: ChecklistItem | null;
}

export function checklistProgress(
  items: readonly ChecklistItem[],
  done: ChecklistDone | undefined,
): ChecklistProgress {
  const ordered = sortChecklist(items);
  const completed = ordered.filter((item) => isChecklistItemDone(done, item.id)).length;
  return {
    completed,
    total: ordered.length,
    fraction: ordered.length === 0 ? 0 : completed / ordered.length,
    nextUp: ordered.find((item) => !isChecklistItemDone(done, item.id)) ?? null,
  };
}

/**
 * Tick state for ids the seed no longer defines — a step that was removed or
 * had its id changed. Surfaced rather than silently dropped, because a stored
 * tick with nothing to attach to usually means someone renamed an id, which
 * this file's contract forbids.
 */
export function orphanedChecklistTicks(
  items: readonly ChecklistItem[],
  done: ChecklistDone | undefined,
): string[] {
  const known = new Set(items.map((item) => item.id));
  return Object.keys(done ?? {}).filter((id) => !known.has(id)).sort();
}

/** The walkthrough as lines, blank lines dropped — the panel renders one row per step. */
export function walkthroughSteps(walkthrough: string): string[] {
  return walkthrough
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
