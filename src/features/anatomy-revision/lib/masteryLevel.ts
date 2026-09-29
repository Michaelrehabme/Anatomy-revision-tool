import type { FactMastery, StructureMastery } from '../types/attempt';
import type { AnatomyStructure } from '../types/structure';
import type { FactKind } from '../types/question';
import { LADDER_CONFIG, rungFor } from './ladder';
import { factMasteryKey, outstandingFacts } from './factMastery';

/**
 * The level a structure reads as, named for the student — the ladder's rung
 * (lib/ladder.ts) with one step on top:
 *
 *   Beginner      never met, or only shown on a flashcard
 *   Novice        recognised from options (MCQ)
 *   Intermediate  recalled by typing, with the letter-count and first-letter hints
 *   Advanced      recalled by typing, no hints
 *   Master        the last three typed answers without hints all right
 *
 * Why levels and not a percentage: all-time accuracy keeps every answer the
 * student gave while they were still learning, so a structure they now know
 * cold can sit at 60% for weeks. A level only says what the student can do
 * NOW — each rung is earned by answers at that rung, and two misses in a row
 * take it away again.
 *
 * Master needs no stored state of its own. Typed-bare is the top rung, so
 * nothing promotes off it, and promoteOrDemote keeps counting consecutive
 * correct answers there in rungStreak — zeroed on the way in and on any miss.
 * A rungStreak of three on typed-bare IS "the last three typed answers without
 * hints were right".
 *
 * AND THE FACTS (owner, 29 Sep 2026). Naming alone is not mastering a
 * structure: Master also needs every fact it carries at its final stage —
 * a muscle's origin, insertion, nerve and action, and blood supply (the
 * primary and assisting arteries typed without hints, "how rich" right three
 * running). See lib/factMastery.ts requiredFactKinds. The levels below Master
 * still read naming alone.
 *
 * EVERY SCREEN MUST PASS `context`. Without it there is nothing to check the
 * facts against, and the level falls back to naming alone — which would call
 * a structure Master on its name. `context` is optional only so the naming
 * ladder can be tested on its own.
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
  /** The facts still short of their final stage, when facts were supplied. Empty at Master. */
  factsLeft: FactKind[];
}

/** What a level needs to see about the structure's facts. */
export interface FactContext {
  structure: AnatomyStructure;
  /** Every fact row, or just this structure's — keyed with factMasteryKey. */
  factsByKey: ReadonlyMap<string, FactMastery>;
}

const FACT_WORDS: Record<FactKind, string> = {
  origin: 'origin',
  insertion: 'insertion',
  nerve: 'nerve',
  action: 'action',
  'blood-supply': 'primary artery',
  'blood-supply-assisting': 'other arteries',
  'blood-supply-rating': 'how rich its supply is',
};

export function factsLeftText(left: readonly FactKind[]): string {
  const words = left.map((k) => FACT_WORDS[k]);
  const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
  return `Recall from memory: ${list}`;
}

/** Index a list of fact rows for FactContext. */
export function factsIndex(rows: readonly FactMastery[]): Map<string, FactMastery> {
  return new Map(rows.map((f) => [factMasteryKey(f.structureId, f.promptKind), f]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function masteryLevel(
  mastery: StructureMastery | undefined,
  now: Date = new Date(),
  context?: FactContext,
): MasteryLevelState {
  const factsLeft = context ? outstandingFacts(context.structure, context.factsByKey) : [];
  if (!mastery) return { level: 'beginner', seen: false, fading: false, next: 'Meet it in a session', factsLeft };

  // A flashcard-only row sits on the MCQ rung (markSeen) but has never been
  // answered; it has been shown, not learned.
  if (mastery.attemptsTotal === 0) {
    return { level: 'beginner', seen: true, fading: false, next: 'Answer it once', factsLeft };
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
        factsLeft,
      };
    case 'typed-hinted':
      return {
        level: 'intermediate',
        seen: true,
        fading: false,
        next: `${plural(toPromote, 'more typed answer', 'more typed answers')} with hints`,
        factsLeft,
      };
    case 'typed-bare': {
      if (streak < LADDER_CONFIG.masterStreak) {
        const toMaster = LADDER_CONFIG.masterStreak - streak;
        return {
          level: 'advanced',
          seen: true,
          fading: false,
          next: `${plural(toMaster, 'more typed answer', 'more typed answers')} without hints`,
          factsLeft,
        };
      }
      // Named unaided, but a fact is still short of its final stage.
      if (factsLeft.length) {
        return { level: 'advanced', seen: true, fading: false, next: factsLeftText(factsLeft), factsLeft };
      }
      const overdueMs = mastery.dueAt ? now.getTime() - new Date(mastery.dueAt).getTime() : 0;
      const fading = overdueMs > (mastery.intervalDays ?? 1) * DAY_MS;
      return { level: 'master', seen: true, fading, next: null, factsLeft };
    }
  }
}

export function masteryLevelRank(level: MasteryLevel): number {
  return MASTERY_LEVELS.indexOf(level);
}
