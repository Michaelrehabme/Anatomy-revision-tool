import type { FactMastery, StructureMastery } from '../types/attempt';
import type { StructureIndexEntry } from '../types/structureIndex';
import type { FactKind } from '../types/question';
import { LADDER_CONFIG, rungFor } from './ladder';
import {
  FACT_MASTERY_CONFIG,
  factDueAt,
  factIntervalDays,
  factMasteryKey,
  factStage,
  isStagedFactKind,
  requiredFactKinds,
} from './factMastery';

/**
 * The level a question type reads as, named for the student:
 *
 *   Beginner      never met, or only shown on a flashcard
 *   Novice        recognised from options (MCQ / select)
 *   Intermediate  recalled by typing, with the letter-count and first-letter hints
 *   Advanced      recalled by typing, no hints
 *   Master        the last three typed answers without hints all right
 *
 * Why levels and not a percentage: all-time accuracy keeps every answer the
 * student gave while they were still learning, so a structure they now know
 * cold can sit at 60% for weeks. A level only says what the student can do
 * NOW — each stage is earned by answers at that stage, and two misses in a
 * row take it away again.
 *
 * PER QUESTION TYPE (owner, 2 Oct 2026). Naming the deltoid and knowing its
 * origin are levelled — and scheduled — separately: naming on the structure's
 * ladder (masteryLevel, lib/ladder.ts), each fact on its own row (factLevel,
 * lib/factMastery.ts). A STRUCTURE's level is the average of the types the
 * student has met, rounded down (structureLevel); Master needs every type met
 * and at Master.
 */
export type MasteryLevel = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'master';

export const MASTERY_LEVELS: readonly MasteryLevel[] = ['beginner', 'novice', 'intermediate', 'advanced', 'master'];

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  beginner: 'Beginner',
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  master: 'Master',
};

export interface MasteryLevelState {
  level: MasteryLevel;
  /** False only for a structure the student has never met — a Beginner either way, but the Atlas tells them apart. */
  seen: boolean;
  /**
   * Master, but left so long the recall is in doubt: past its due date by
   * more than a whole review interval, i.e. at twice the gap the schedule
   * allowed. Display only; the next answer settles it either way.
   */
  fading: boolean;
  /** What the next level takes, for the structure card. Null at Master. */
  next: string | null;
}

/** A question type of a structure: naming, or one of its facts. */
export type SkillKind = 'identify' | FactKind;

export const SKILL_LABELS: Partial<Record<SkillKind, string>> = {
  identify: 'Naming',
  origin: 'Origin',
  insertion: 'Insertion',
  nerve: 'Nerve supply',
  action: 'Action',
  'blood-supply': 'Primary artery',
  'blood-supply-assisting': 'Other arteries',
  'blood-supply-rating': 'How rich its supply is',
  'described-region': 'Where it sits, in words',
};

export function skillLabel(kind: SkillKind): string {
  return SKILL_LABELS[kind] ?? kind.replace(/-/g, ' ');
}

const DAY_MS = 24 * 60 * 60 * 1000;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function isFading(dueAt: string | undefined, intervalDays: number | undefined, now: Date): boolean {
  const overdueMs = dueAt ? now.getTime() - new Date(dueAt).getTime() : 0;
  return overdueMs > (intervalDays ?? 1) * DAY_MS;
}

/** The NAMING level: the structure's ladder rung, with Master on top. */
export function masteryLevel(mastery: StructureMastery | undefined, now: Date = new Date()): MasteryLevelState {
  if (!mastery) return { level: 'beginner', seen: false, fading: false, next: 'Meet it in a session' };

  // A flashcard-only row sits on the MCQ rung (markSeen) but has never been
  // answered; it has been shown, not learned.
  if (mastery.attemptsTotal === 0) {
    return { level: 'beginner', seen: true, fading: false, next: 'Answer it once' };
  }

  const streak = mastery.rungStreak ?? 0;
  const toPromote = Math.max(1, LADDER_CONFIG.promotionStreak - streak);

  switch (rungFor(mastery)) {
    case 'flashcard':
    case 'mcq':
      return {
        level: 'novice',
        seen: true,
        fading: false,
        next: `${plural(toPromote, 'more right answer', 'more right answers')} in a row`,
      };
    case 'typed-hinted':
      return {
        level: 'intermediate',
        seen: true,
        fading: false,
        next: `${plural(toPromote, 'more typed answer', 'more typed answers')} with hints`,
      };
    case 'typed-bare': {
      if (streak < LADDER_CONFIG.masterStreak) {
        const toMaster = LADDER_CONFIG.masterStreak - streak;
        return {
          level: 'advanced',
          seen: true,
          fading: false,
          next: `${plural(toMaster, 'more typed answer', 'more typed answers')} without hints`,
        };
      }
      return { level: 'master', seen: true, fading: isFading(mastery.dueAt, mastery.intervalDays, now), next: null };
    }
  }
}

/**
 * One fact's level, or null when the student has not met it. The OINA kinds
 * climb select → typed with hints → typed without; a multiple-choice-only
 * kind ("how rich") reads its run of right answers, three being Master.
 */
export function factLevel(kind: FactKind, fact: FactMastery | undefined, now: Date = new Date()): MasteryLevelState | null {
  if (!fact || fact.attemptsTotal === 0) return null;
  const n = FACT_MASTERY_CONFIG.promotionStreak;
  const toGo = Math.max(1, n - fact.streak);
  const fading = (level: MasteryLevel) => level === 'master' && isFading(factDueAt(fact), factIntervalDays(fact), now);

  if (!isStagedFactKind(kind)) {
    const level: MasteryLevel = fact.streak >= n ? 'master' : (['novice', 'intermediate', 'advanced'] as const)[fact.streak];
    return {
      level,
      seen: true,
      fading: fading(level),
      next: level === 'master' ? null : `${plural(toGo, 'more right answer', 'more right answers')} in a row`,
    };
  }
  switch (factStage(fact)) {
    case 'select':
      return { level: 'novice', seen: true, fading: false, next: `${plural(toGo, 'more right answer', 'more right answers')} in a row` };
    case 'typed-hinted':
      return { level: 'intermediate', seen: true, fading: false, next: `${plural(toGo, 'more typed answer', 'more typed answers')} with hints` };
    case 'typed-bare': {
      const level: MasteryLevel = fact.streak >= n ? 'master' : 'advanced';
      return {
        level,
        seen: true,
        fading: fading(level),
        next: level === 'master' ? null : `${plural(toGo, 'more typed answer', 'more typed answers')} without hints`,
      };
    }
  }
}

export interface SkillLevel {
  kind: SkillKind;
  /** Null when not met yet. */
  state: MasteryLevelState | null;
  /** When this type is next due for review, if it is scheduled. */
  dueAt?: string;
}

export interface StructureLevelState extends MasteryLevelState {
  /** Naming and each of the structure's core facts, in that order. */
  perKind: SkillLevel[];
  /** The core types the student has not met yet. */
  unmet: SkillKind[];
}

/** Index a list of fact rows the way structureLevel looks them up. */
export function factsIndex(rows: readonly FactMastery[]): Map<string, FactMastery> {
  return new Map(rows.map((f) => [factMasteryKey(f.structureId, f.promptKind), f]));
}

/**
 * A structure's level: the average of the question types the student has
 * met, rounded down (owner, 2 Oct 2026). Types not met yet don't drag it
 * down — they are listed in `unmet` instead — but Master needs every type met
 * and at Master, so a structure named perfectly but never asked its origin
 * stops at Advanced.
 *
 * The types counted are naming plus the structure's core facts
 * (requiredFactKinds). Clinical and joint questions are scheduled on their
 * own rows but left out of the average.
 */
export function structureLevel(
  structure: StructureIndexEntry,
  mastery: StructureMastery | undefined,
  factsByKey: ReadonlyMap<string, FactMastery>,
  now: Date = new Date(),
): StructureLevelState {
  const naming = masteryLevel(mastery, now);
  const namingMet = !!mastery && mastery.attemptsTotal > 0;
  const perKind: SkillLevel[] = [
    { kind: 'identify', state: namingMet ? naming : null, dueAt: mastery?.dueAt },
    ...requiredFactKinds(structure).map((kind) => {
      const fact = factsByKey.get(factMasteryKey(structure.id, kind));
      return { kind, state: factLevel(kind, fact, now), dueAt: fact ? factDueAt(fact) : undefined };
    }),
  ];
  const met = perKind.filter((k) => k.state);
  const unmet = perKind.filter((k) => !k.state).map((k) => k.kind);

  if (met.length === 0) {
    return { level: 'beginner', seen: !!mastery, fading: false, next: naming.next, perKind, unmet };
  }

  const ranks = met.map((k) => masteryLevelRank(k.state!.level));
  let rank = Math.floor(ranks.reduce((a, b) => a + b, 0) / ranks.length);
  if (rank === masteryLevelRank('master') && unmet.length) rank = masteryLevelRank('advanced');
  const level = MASTERY_LEVELS[rank];

  // The next step is the weakest type's; once every met type is at Master,
  // what is left is meeting the rest.
  const weakest = met.reduce((a, b) => (masteryLevelRank(b.state!.level) < masteryLevelRank(a.state!.level) ? b : a));
  const next =
    weakest.state!.level !== 'master'
      ? `${skillLabel(weakest.kind)}: ${weakest.state!.next}`
      : unmet.length
        ? `Meet ${listText(unmet.map((k) => skillLabel(k).toLowerCase()))}`
        : null;

  return {
    level,
    seen: true,
    fading: level === 'master' && met.some((k) => k.state!.fading),
    next,
    perKind,
    unmet,
  };
}

function listText(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
}

/** "3 types not met", for the Atlas's secondary line. */
export function unmetText(unmet: readonly SkillKind[]): string | null {
  return unmet.length ? `${unmet.length} ${unmet.length === 1 ? 'type' : 'types'} not met` : null;
}

export function masteryLevelRank(level: MasteryLevel): number {
  return MASTERY_LEVELS.indexOf(level);
}
