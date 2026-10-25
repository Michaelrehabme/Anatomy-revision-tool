import { AREAS_BY_SUBREGION, REGION_SUBREGIONS, REGIONS, type Area, type Region, type SubRegion } from '../../anatomy-revision/types/region';
import { areasOf } from '../../anatomy-revision/types/structure';
import type { StructureIndexEntry } from '../../anatomy-revision/types/structureIndex';
import { factsIndex, structureLevel, type MasteryLevel } from '../../anatomy-revision/lib/masteryLevel';
import type { FactMastery, StructureMastery } from '../../anatomy-revision/types/attempt';
import { weekStartOf } from '../../anatomy-revision/lib/studyProfile';
import type { ChallengeAssignment } from '../types/cohort';

/**
 * The rules of a weekly class challenge (types/cohort.ts ChallengeAssignment),
 * shared by the educator's dashboard and the student's Today so both count
 * "secure" the same way: Intermediate or above (lib/masteryLevel.ts), the
 * threshold the student's own weekly focus already uses.
 */

const SECURE: ReadonlySet<MasteryLevel> = new Set(['intermediate', 'advanced', 'master']);

export function isSecure(level: MasteryLevel | undefined): boolean {
  return !!level && SECURE.has(level);
}

/** Structures in the area, the most a challenge could ask for. */
export function areaTotal(index: readonly StructureIndexEntry[], area: Area): number {
  return index.filter((s) => areasOf(s).includes(area)).length;
}

/** A suggested target: half the area, rounded to a five, so the first form a teacher sees is a sensible week's work. */
export function suggestedTarget(total: number): number {
  return Math.min(total, Math.max(5, Math.round((total * 0.5) / 5) * 5));
}

/** How many of the area's structures one student has secure, from a rollup's levels (structureId → level). */
export function securedInArea(levels: Readonly<Record<string, MasteryLevel>>, index: readonly StructureIndexEntry[], area: Area): number {
  let n = 0;
  for (const s of index) if (areasOf(s).includes(area) && isSecure(levels[s.id])) n += 1;
  return n;
}

/**
 * The student's own count, from their mastery on the device, by the rule the
 * teacher's rollup uses (lib/studentRollup.ts buildStudentRollup): a structure
 * answered in any way since `since`, at the level all its answers give it.
 * Kept here, beside securedInArea, so the two cannot drift apart unseen —
 * classChallenge.test.ts checks one against the other.
 */
export function studentSecured(
  index: readonly StructureIndexEntry[],
  mastery: readonly StructureMastery[],
  facts: readonly FactMastery[],
  area: Area,
  since: string,
  now: Date = new Date(),
): number {
  const sinceMs = Date.parse(since);
  const touched = new Set([...mastery, ...facts].filter((r) => Date.parse(r.lastAttemptAt) >= sinceMs).map((r) => r.structureId));
  const masteryById = new Map(mastery.map((m) => [m.structureId, m]));
  const factsByKey = factsIndex(facts);
  let n = 0;
  for (const s of index) {
    if (!touched.has(s.id) || !areasOf(s).includes(area)) continue;
    const state = structureLevel(s, masteryById.get(s.id), factsByKey, now);
    if (state.seen && isSecure(state.level)) n += 1;
  }
  return n;
}

/** The end of the challenge week: 23:59:59.999 local on the Sunday after `weekStart`. */
export function challengeEnd(weekStart: string): Date {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(y, m - 1, d + 6, 23, 59, 59, 999);
}

/** This week's Monday and next week's, for the form's choice. */
export function challengeWeeks(now: Date): { thisWeek: string; nextWeek: string } {
  const thisWeek = weekStartOf(now);
  const [y, m, d] = thisWeek.split('-').map(Number);
  return { thisWeek, nextWeek: weekStartOf(new Date(y, m - 1, d + 7)) };
}

/**
 * The challenge running this week, if any: the newest one set for this
 * week's Monday. A teacher who sets two in a week means the second.
 */
export function activeChallenge(challenges: readonly ChallengeAssignment[], now: Date): ChallengeAssignment | null {
  const week = weekStartOf(now);
  return [...challenges].filter((c) => c.weekStart === week).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** The old coarse region an area belongs to, for the `region` field older app versions read. */
export function regionOfArea(area: Area): Region {
  for (const region of REGIONS) {
    const subs: SubRegion[] = REGION_SUBREGIONS[region];
    if (subs.some((sub) => AREAS_BY_SUBREGION[sub].includes(area))) return region;
  }
  return 'back-core';
}
