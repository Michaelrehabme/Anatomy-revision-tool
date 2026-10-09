import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { generateRevisionSet, type RevisionSetConfig } from '../questionGenerators/generateSet';
import { buildMcqQuestions, MCQ_CHOICE_COUNT, MCQ_MIN_CHOICES } from '../questionGenerators/mcq';
import { OINA_MIN_DISTRACTORS } from '../questionGenerators/oina';
import { MULTI_SELECT_MIN_CHOICES } from '../questionGenerators/multiSelect';
import { buildIndexes, filterStructures } from '../indexes';
import { createRng } from '../rng';
import { stripHeadPrefix } from '../oinaValues';
import { AREAS, type Area } from '../../types/region';
import { areasOf, isMuscle } from '../../types/structure';
import type { StructureMastery } from '../../types/attempt';
import type { QuestionType, RevisionQuestion } from '../../types/question';

/**
 * EVERY QUESTION WITH CHOICES HAS ENOUGH OF THEM, IN EVERY MODE.
 *
 * Written for the adaptive mode (4 Oct 2026). It builds one question per
 * structure, and it handed the builders that one structure as the pool to draw
 * wrong answers from, so every adaptive MCQ was the right answer on its own:
 * about six questions in twenty once real mastery had moved the rest on to
 * flashcards and typing. Nothing failed, because nothing asked.
 *
 * The same hole was open wherever a pool was thin: a drill on one structure,
 * a ladder session with two muscles on the MCQ rung, an area whose other
 * joints are all the same type. So the floor is held here for every mode, over
 * the real seed, across seeds and mastery states, rather than for the one
 * path that was reported.
 */

const now = new Date('2026-10-04T12:00:00.000Z');
const SEEDS = [1, 7, 21, 42, 1234, 99991];
const CHOICE_TYPES: QuestionType[] = ['mcq', 'multi-select', 'oina'];
const LADDER: QuestionType[] = ['flashcard', 'mcq', 'identify-typed', 'multi-select', 'oina'];

/** Recorded performance of several shapes; "none" is a first-ever session. */
const MASTERY_STATES = ['none', 'sparse', 'mixed', 'weak', 'strong', 'mcq-rung'] as const;

function masteryFor(state: (typeof MASTERY_STATES)[number], seed: number): StructureMastery[] | undefined {
  if (state === 'none') return undefined;
  const rng = createRng(seed * 31 + state.length);
  const rows: StructureMastery[] = [];
  for (const s of ALL_STRUCTURES) {
    if (state === 'sparse' && rng() > 0.15) continue;
    const total = state === 'mcq-rung' ? 3 : 1 + Math.floor(rng() * 20);
    const accuracy = state === 'strong' ? 0.9 + rng() * 0.1 : state === 'weak' ? rng() * 0.4 : rng();
    rows.push({
      structureId: s.id,
      userId: 'u',
      attemptsTotal: total,
      attemptsCorrect: Math.round(total * accuracy),
      lastAttemptAt: '2026-09-20T00:00:00.000Z',
      dueAt: rng() > 0.5 ? '2026-10-01T00:00:00.000Z' : '2026-10-20T00:00:00.000Z',
      // Everything parked on the MCQ rung is the adaptive session with the
      // most MCQs in it: all twenty, where the bug made all twenty useless.
      ...(state === 'mcq-rung' ? { rung: 'mcq' as const } : {}),
    });
  }
  return rows;
}

const generate = (config: RevisionSetConfig) => generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { now, ...config });

/** The kinds mcq.ts fills to four from the entitled pool; the rest keep their own, smaller, floors. */
const FILLED_KINDS = new Set(['identify', 'origin', 'insertion', 'nerve', 'action']);
const isBuiltByMcq = (q: RevisionQuestion) => q.id.startsWith('mcq-');

/** Why a question is under its builder's floor, or null. */
function underFloor(q: RevisionQuestion): string | null {
  if (q.type === 'mcq') {
    if (new Set(q.choices).size !== q.choices.length) return 'a choice is offered twice';
    if (q.choices.length < MCQ_MIN_CHOICES) return `${q.choices.length} choice(s)`;
    if (isBuiltByMcq(q) && FILLED_KINDS.has(q.promptKind) && q.choices.length < MCQ_CHOICE_COUNT) {
      return `${q.choices.length} choices, and the entitled pool could have filled ${MCQ_CHOICE_COUNT}`;
    }
    return null;
  }
  if (q.type === 'oina' && q.format === 'select') {
    const wrong = q.choices.length - q.correctIndices.length;
    return wrong < OINA_MIN_DISTRACTORS ? `${wrong} wrong answer(s)` : null;
  }
  if (q.type === 'multi-select') {
    return q.choices.length < MULTI_SELECT_MIN_CHOICES ? `${q.choices.length} choice(s)` : null;
  }
  return null;
}

function failures(sets: [string, RevisionQuestion[]][]): string[] {
  return sets.flatMap(([name, questions]) =>
    questions.flatMap((q) => {
      const why = underFloor(q);
      return why ? [`${name}: ${q.id} — ${why}`] : [];
    }),
  );
}

const hasChoices = (q: RevisionQuestion) =>
  q.type === 'mcq' || q.type === 'multi-select' || (q.type === 'oina' && q.format === 'select');

describe('no question is asked with fewer choices than its builder allows', () => {
  it('adaptive: across seeds, mastery states, formats and entitlements', () => {
    const sets: [string, RevisionQuestion[]][] = [];
    for (const seed of SEEDS) {
      for (const state of MASTERY_STATES) {
        const mastery = masteryFor(state, seed);
        for (const types of [['mcq'], ['mcq', 'oina'], LADDER] as QuestionType[][]) {
          for (const entitledAreas of [AREAS, ['knee'], ['shoulder'], ['lumbar-spine']] as (readonly Area[])[]) {
            sets.push([
              `adaptive ${types.join('+')} ${state} ${entitledAreas.length === 1 ? entitledAreas[0] : 'all'} seed ${seed}`,
              generate({ types, mode: 'adaptive', count: 20, entitledAreas, seed, mastery }),
            ]);
          }
        }
      }
    }
    // The test is only worth its name if it looked at a lot of them.
    expect(sets.flatMap(([, qs]) => qs).filter((q) => q.type === 'mcq').length).toBeGreaterThan(2000);
    expect(failures(sets)).toEqual([]);
  });

  it('adaptive: a session of twenty MCQs is twenty four-choice questions', () => {
    const questions = generate({ types: ['mcq'], mode: 'adaptive', count: 20, entitledAreas: AREAS, seed: 3 });
    expect(questions).toHaveLength(20);
    for (const q of questions) {
      expect(q.type).toBe('mcq');
      if (q.type === 'mcq') expect(q.choices).toHaveLength(MCQ_CHOICE_COUNT);
    }
  });

  it('practice and assessment: across seeds, mastery states and entitlements', () => {
    const sets: [string, RevisionQuestion[]][] = [];
    // Three seeds, not six: a practice set builds every question the pool can
    // ask before it deals twenty, and the whole body is a second a time.
    for (const seed of SEEDS.slice(0, 3)) {
      for (const state of MASTERY_STATES) {
        const mastery = masteryFor(state, seed);
        // The ladder puts a handful of structures on the MCQ rung, and they
        // used to be each other's only wrong answers.
        sets.push([`ladder ${state} all seed ${seed}`, generate({ types: LADDER, mode: 'practice', count: 20, entitledAreas: AREAS, seed, mastery })]);
        sets.push([`ladder ${state} knee only seed ${seed}`, generate({ types: LADDER, mode: 'practice', count: 20, entitledAreas: ['knee'], seed, mastery })]);
        sets.push([`assessment ${state} knee only seed ${seed}`, generate({ types: CHOICE_TYPES, mode: 'assessment', count: 20, entitledAreas: ['knee'], seed, mastery })]);
      }
    }
    expect(failures(sets)).toEqual([]);
  });

  it('practice: every question each area can build, uncapped', () => {
    const sets = AREAS.map((area): [string, RevisionQuestion[]] => [
      `everything in ${area}`,
      generate({ types: CHOICE_TYPES, mode: 'practice', areas: [area], entitledAreas: AREAS, seed: 21, learnCardAttempts: 0 }),
    ]);
    expect(sets.flatMap(([, qs]) => qs).filter(hasChoices).length).toBeGreaterThan(2000);
    expect(failures(sets)).toEqual([]);
  });

  it('a drill on one structure, in either mode, still has neighbours to be confused with', () => {
    const sets: [string, RevisionQuestion[]][] = [];
    for (const [i, s] of ALL_STRUCTURES.entries()) {
      if (i % 5 !== 0) continue;
      for (const mode of ['practice', 'adaptive'] as const) {
        sets.push([
          `${mode} drill on ${s.id}`,
          generate({ types: CHOICE_TYPES, mode, structureIds: [s.id], entitledAreas: AREAS, seed: 5, learnCardAttempts: 0 }),
        ]);
      }
    }
    expect(failures(sets)).toEqual([]);
  });
});

describe('where an adaptive question finds its wrong answers', () => {
  const entitledTo = (areas: readonly Area[]) => ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => areas.includes(a)));

  it('names only structures in the areas the account may reach', () => {
    for (const area of ['knee', 'elbow', 'thoracic-spine'] as const) {
      const allowed = new Set(entitledTo([area]).map((s) => s.name));
      for (const seed of SEEDS) {
        const questions = generate({ types: ['mcq'], mode: 'adaptive', count: 20, entitledAreas: [area], seed });
        expect(questions.length).toBeGreaterThan(0);
        for (const q of questions) {
          if (q.type !== 'mcq' || q.promptKind !== 'identify') continue;
          for (const choice of q.choices) expect(allowed.has(choice), `${q.id} offers "${choice}", which is not in ${area}`).toBe(true);
        }
      }
    }
  });

  it('offers a locked muscle no origin or insertion as a wrong answer to a fact question', () => {
    const area: Area = 'knee';
    const allowed = new Set(
      entitledTo([area])
        .filter(isMuscle)
        .flatMap((m) => [...m.origin, ...m.insertion].map(stripHeadPrefix)),
    );
    let checked = 0;
    for (const seed of SEEDS) {
      const questions = generate({
        types: ['oina'],
        mode: 'adaptive',
        count: 40,
        entitledAreas: [area],
        oinaPromptKinds: ['origin', 'insertion'],
        oinaForceFormat: 'select',
        learnCardAttempts: 0,
        seed,
      });
      for (const q of questions) {
        if (q.type !== 'oina' || q.format !== 'select') continue;
        for (const choice of q.choices) {
          checked++;
          expect(allowed.has(choice), `${q.id} offers "${choice}", which no ${area} muscle lists`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('takes them from the session pool first, as a practice question would', () => {
    // A session narrowed to one group: the hamstrings are each other's wrong
    // answers, and the fourth choice comes from the nearest tier outside them.
    const hamstrings = ALL_STRUCTURES.filter((s) => s.groups?.includes('hamstrings'));
    expect(hamstrings.length).toBeGreaterThanOrEqual(3);
    const names = new Set(hamstrings.map((s) => s.name));
    const questions = generate({ types: ['mcq'], mode: 'adaptive', groups: ['hamstrings'], entitledAreas: AREAS, seed: 9 });
    expect(questions.length).toBe(hamstrings.length);
    for (const q of questions) {
      if (q.type !== 'mcq') continue;
      expect(q.choices).toHaveLength(MCQ_CHOICE_COUNT);
      expect(q.choices.filter((c) => names.has(c)).length).toBe(Math.min(MCQ_CHOICE_COUNT, hamstrings.length));
    }
  });
});

describe('the wider pool is only a top-up', () => {
  it('changes nothing for a pool that can fill its own choices', () => {
    // The top-up draws from the random stream, so a draw nobody needed would
    // reshuffle every question after it. This is what keeps an ordinary
    // practice session exactly what it was before the fallback existed.
    const indexes = buildIndexes(ALL_STRUCTURES);
    for (const area of AREAS) {
      const pool = filterStructures(ALL_STRUCTURES, { areas: [area] });
      const without = buildMcqQuestions(pool, ALL_IMAGES, indexes, createRng(11));
      const withFallback = buildMcqQuestions(pool, ALL_IMAGES, indexes, createRng(11), { fallbackPool: ALL_STRUCTURES });
      // Compared after the floor, which is the one thing that may differ: a
      // joint among joints all of its own type used to be asked with one
      // choice, and such an area would not be "a pool that can fill its own".
      const comparable = (qs: typeof without) => JSON.stringify(qs.filter((q) => q.promptKind !== 'joint-type'));
      // Nor is an area that cannot fill a question on its own: the elbow has
      // too few muscles to offer three actions that are not also true of
      // biceps, and its top-up moves the random stream for all that follows.
      if (without.some((q) => q.promptKind !== 'joint-type' && q.choices.length < MCQ_CHOICE_COUNT)) continue;
      expect(comparable(withFallback), area).toBe(comparable(without));
    }
  });

  it('asks nothing rather than a one-choice question when there is nowhere to top up from', () => {
    const one = ALL_STRUCTURES.filter(isMuscle).slice(0, 1);
    const questions = buildMcqQuestions(one, ALL_IMAGES, buildIndexes(one), createRng(1));
    for (const q of questions) expect(q.choices.length, q.id).toBeGreaterThanOrEqual(MCQ_MIN_CHOICES);
  });
});
