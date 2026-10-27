import type { FactMastery, StructureMastery } from '../types/attempt';
import { factDueAt, factIntervalDays } from './factMastery';
import type { SkillKind } from './masteryLevel';
import { areasOf, type AnatomyStructure } from '../types/structure';
import type { Area } from '../types/region';

/** One question type of one structure, waiting in the daily review. */
export interface ReviewItem {
  structureId: string;
  kind: SkillKind;
  dueAt: string;
  /** Due now, as opposed to pulled forward because it is weak. */
  due: boolean;
}

/**
 * What makes a not-yet-due question type worth pulling forward: it is on a
 * short interval — it was missed, or rated Medium or Hard, recently — or its
 * recent answers are shaky. A type answered right and rated Easy has earned a
 * long interval and is left alone until it is due (owner, 2 Oct 2026: "if I'm
 * consistently getting the identify question for the deltoid right and finding
 * it easy I shouldn't see that question for another 10 days").
 */
export const WEAK_INTERVAL_DAYS = 4;
export const WEAK_ACCURACY = 0.8;

/**
 * The daily review queue, per question type (owner, 2 Oct 2026).
 *
 *   due      every type whose own date has come, most overdue first
 *   forward  when those run out the queue moves forward — the next-soonest
 *            types, but only weak ones
 *
 * The old queue was per structure and pulled EVERY scheduled structure
 * forward, so a student with a dozen muscles met reviewed all of them every
 * day, however well they knew them.
 */
export function buildReviewQueue(
  mastery: readonly StructureMastery[],
  facts: readonly FactMastery[],
  eligible: ReadonlySet<string>,
  now: Date = new Date(),
): { due: ReviewItem[]; forward: ReviewItem[] } {
  const nowIso = now.toISOString();
  const items: (ReviewItem & { weak: boolean })[] = [];

  for (const m of mastery) {
    if (!eligible.has(m.structureId) || !m.dueAt || m.attemptsTotal === 0) continue;
    const accuracy = m.recentAccuracy ?? m.attemptsCorrect / m.attemptsTotal;
    items.push({
      structureId: m.structureId,
      kind: 'identify',
      dueAt: m.dueAt,
      due: m.dueAt <= nowIso,
      weak: (m.intervalDays ?? 1) <= WEAK_INTERVAL_DAYS || accuracy < WEAK_ACCURACY,
    });
  }
  for (const f of facts) {
    if (!eligible.has(f.structureId) || f.attemptsTotal === 0) continue;
    const dueAt = factDueAt(f);
    items.push({
      structureId: f.structureId,
      kind: f.promptKind,
      dueAt,
      due: dueAt <= nowIso,
      weak: factIntervalDays(f) <= WEAK_INTERVAL_DAYS || f.attemptsCorrect / f.attemptsTotal < WEAK_ACCURACY,
    });
  }

  const byDate = (a: ReviewItem, b: ReviewItem) => a.dueAt.localeCompare(b.dueAt);
  const strip = (i: ReviewItem & { weak: boolean }): ReviewItem => ({ structureId: i.structureId, kind: i.kind, dueAt: i.dueAt, due: i.due });
  return {
    due: items.filter((i) => i.due).sort(byDate).map(strip),
    forward: items.filter((i) => !i.due && i.weak).sort(byDate).map(strip),
  };
}

/**
 * The same queue reordered for a "New set" review (owner, 3 Oct 2026).
 *
 * The queue above is oldest-first, and one structure's types all fall due
 * together — name, origin, insertion, nerve — so with a backlog a review
 * stays on the same dozen structures for days, a couple of types at a time.
 * That is the right thing for finishing a structure off ("Keep going") and
 * the wrong thing for a student who wants to move on. Here the structures
 * answered longest ago come first, so anything asked today goes to the back;
 * asked with one question per structure, each review reaches different ones.
 * Still only what is due or weak — the order changes, not what qualifies.
 */
export function spreadReviewItems(
  items: readonly ReviewItem[],
  mastery: readonly StructureMastery[],
  facts: readonly FactMastery[],
): ReviewItem[] {
  const lastAsked = new Map<string, string>();
  for (const row of [...mastery, ...facts]) {
    if (row.attemptsTotal === 0) continue;
    if (row.lastAttemptAt > (lastAsked.get(row.structureId) ?? '')) lastAsked.set(row.structureId, row.lastAttemptAt);
  }
  const at = (i: ReviewItem) => lastAsked.get(i.structureId) ?? '';
  // Due before pulled-forward, as in the queue itself; the sort is stable, so
  // within a structure the most overdue type is still the one asked.
  return [...items].sort((a, b) => Number(b.due) - Number(a.due) || at(a).localeCompare(at(b)));
}

/**
 * When each structure is next due: the earliest date among its question types,
 * by the same rows the queue above counts — so a list ordered by this agrees
 * with Today's "N due". A structure never answered has no entry.
 */
export function soonestDueByStructure(
  mastery: Iterable<StructureMastery>,
  facts: Iterable<FactMastery>,
): Map<string, string> {
  const soonest = new Map<string, string>();
  const note = (structureId: string, dueAt: string) => {
    const current = soonest.get(structureId);
    if (!current || dueAt < current) soonest.set(structureId, dueAt);
  };
  for (const m of mastery) {
    if (m.dueAt && m.attemptsTotal > 0) note(m.structureId, m.dueAt);
  }
  for (const f of facts) {
    if (f.attemptsTotal > 0) note(f.structureId, factDueAt(f));
  }
  return soonest;
}

/** "today", "tomorrow", "in 3 days". Overdue reads as today: it is due now. */
export function relativeDue(dueAt: string, now: Date): string {
  const days = Math.round((Date.parse(dueAt) - now.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** The queue cut to one area, for a review of that area alone. Order is kept. */
export function reviewItemsInArea(
  items: readonly ReviewItem[],
  area: Area,
  structuresById: ReadonlyMap<string, AnatomyStructure>,
): ReviewItem[] {
  return items.filter((i) => {
    const structure = structuresById.get(i.structureId);
    return !!structure && areasOf(structure).includes(area);
  });
}

/**
 * The structures with something due — THE count of "due" everywhere a student
 * reads one (owner, 27 Oct 2026). Today used to count due question types, so a
 * muscle with its name and its origin both due counted twice, and Today said
 * 18 where the Atlas, counting structures, said 15. One structure, one count.
 */
export function dueStructureIds(items: readonly ReviewItem[]): Set<string> {
  return new Set(items.filter((i) => i.due).map((i) => i.structureId));
}
