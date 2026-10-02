import type { FactMastery, StructureMastery } from '../types/attempt';
import { factDueAt, factIntervalDays } from './factMastery';
import type { SkillKind } from './masteryLevel';

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
