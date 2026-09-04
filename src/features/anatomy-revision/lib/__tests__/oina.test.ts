import { describe, it, expect } from 'vitest';
import { buildOinaQuestions, correctValuesFor } from '../questionGenerators/oina';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { ALL_STRUCTURES } from '../../data/seed';
import { isMuscle } from '../../types/structure';
import type { MuscleStructure } from '../../types/structure';
import type { FactMastery } from '../../types/attempt';
import { OINA_PROMPT_KINDS } from '../../types/question';
import type { OinaPromptKind, OinaSelectQuestion, OinaTypedQuestion } from '../../types/question';
import {
  actionsConflict,
  canonicalNerveNames,
  conflictsWith,
  humanizeActionTag,
  stripHeadPrefix,
} from '../oinaValues';

const muscles = ALL_STRUCTURES.filter(isMuscle);
const byId = new Map(muscles.map((m) => [m.id, m]));
const indexes = buildIndexes(ALL_STRUCTURES);

const build = (pool: MuscleStructure[], options = {}, seed = 42) =>
  buildOinaQuestions(pool, ALL_STRUCTURES, indexes, createRng(seed), options);

const one = (id: string, promptKind: OinaPromptKind, options = {}, seed = 42) => {
  const questions = build([byId.get(id)!], { promptKinds: [promptKind], ...options }, seed);
  return questions[0];
};

const fact = (structureId: string, promptKind: OinaPromptKind, typed: boolean): FactMastery => ({
  userId: 'u1',
  structureId,
  promptKind,
  attemptsTotal: 5,
  attemptsCorrect: 5,
  streak: 5,
  missStreak: 0,
  lastCorrect: true,
  lastAttemptAt: '2026-09-01T00:00:00.000Z',
  typed,
});

describe('buildOinaQuestions', () => {
  it('asks each fact separately rather than joining a field into one choice', () => {
    const questions = build([byId.get('biceps-femoris')!]);
    expect(questions.map((q) => q.promptKind)).toEqual(['origin', 'insertion', 'nerve', 'action']);
    expect(questions.every((q) => q.format === 'select')).toBe(true);
  });

  it('makes every authored value of a multi-headed muscle its own correct choice', () => {
    const q = one('biceps-femoris', 'origin') as OinaSelectQuestion;
    const correct = q.correctIndices.map((i) => q.choices[i]).sort();
    expect(correct).toEqual(['Ischial tuberosity', 'Linea aspera of the femur']);
    // The head prefix would give the answer away next to unprefixed distractors.
    expect(q.choices.some((c) => c.includes(':'))).toBe(false);
  });

  it('humanizes action tags and asks for all of them', () => {
    const q = one('biceps-femoris', 'action') as OinaSelectQuestion;
    const correct = q.correctIndices.map((i) => q.choices[i]).sort();
    expect(correct).toEqual(['Hip extension', 'Knee external rotation', 'Knee flexion']);
  });

  it('drops nerve entries that are not answerable nerve names', () => {
    const q = one('trapezius', 'nerve') as OinaSelectQuestion;
    expect(q.correctIndices.map((i) => q.choices[i])).toEqual(['Spinal accessory nerve']);
    expect(q.choices).not.toContain('C3–C4 (sensory)');
  });

  it('scopes the explanation to the fact asked, so the other three are not given away', () => {
    const q = one('biceps-brachii', 'origin');
    expect(q.explanation).toContain('origin');
    expect(q.explanation).not.toContain('Musculocutaneous');
    expect(q.explanation).not.toContain('Radial tuberosity');
  });

  it('is deterministic for a given seed', () => {
    const a = build(muscles.slice(0, 20));
    const b = build(muscles.slice(0, 20));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe('every muscle and fact across the dataset', () => {
  const all = build(muscles);

  it('produces a question for all four facts of every muscle', () => {
    const missing: string[] = [];
    for (const m of muscles) {
      for (const promptKind of OINA_PROMPT_KINDS) {
        if (!all.some((q) => q.structureId === m.id && q.promptKind === promptKind)) {
          missing.push(`${m.id}.${promptKind}`);
        }
      }
    }
    expect(missing).toEqual([]);
    expect(all).toHaveLength(muscles.length * OINA_PROMPT_KINDS.length);
  });

  it('never offers a distractor that is also a true answer', () => {
    const offending: string[] = [];
    for (const q of all) {
      if (q.format !== 'select') continue;
      const correctSet = new Set(q.correctIndices);
      const muscle = byId.get(q.structureId)!;
      const correctValues = correctValuesFor(muscle, q.promptKind);
      const reject = q.promptKind === 'action' ? actionsConflict : conflictsWith;
      q.choices.forEach((choice, index) => {
        if (correctSet.has(index)) return;
        const raw = q.promptKind === 'action' ? muscle.actions.find((a) => humanizeActionTag(a) === choice) ?? choice : choice;
        const value = q.promptKind === 'action' ? raw : choice;
        if (correctValues.some((correctValue) => reject(correctValue, value))) {
          offending.push(`${q.id}: "${choice}"`);
        }
      });
    }
    expect(offending).toEqual([]);
  });

  it('never renders the same choice twice, and always leaves something to eliminate', () => {
    for (const q of all) {
      if (q.format !== 'select') continue;
      expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
      expect(q.correctIndices.length, q.id).toBeGreaterThan(0);
      expect(q.choices.length - q.correctIndices.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.choices.length, q.id).toBeLessThanOrEqual(7);
    }
  });

  /**
   * A distractor drawn from anywhere in the body is answerable without the
   * anatomy — asked for the nerve supply of a hamstring, "Median nerve" can be
   * ruled out on the grounds that it belongs to the arm. Before the tiered key
   * picker, only ~18% of the nerve and action key pool was in the muscle's own
   * group or region, so most alternatives were eliminable on region alone.
   */
  it('draws every alternative from a muscle in the same group or region', () => {
    const valuesOf = (m: MuscleStructure, promptKind: OinaPromptKind) => {
      switch (promptKind) {
        case 'origin':
          return m.origin.map(stripHeadPrefix);
        case 'insertion':
          return m.insertion.map(stripHeadPrefix);
        case 'nerve':
          return canonicalNerveNames(m.nerve);
        case 'action':
          return m.actions.map(humanizeActionTag);
      }
    };

    const unrelated: string[] = [];
    for (const q of all) {
      if (q.format !== 'select') continue;
      const muscle = byId.get(q.structureId)!;
      const groups = new Set(muscle.groups ?? []);
      const correct = new Set(q.correctIndices.map((i) => q.choices[i]));

      for (const choice of q.choices) {
        if (correct.has(choice)) continue;
        const from = muscles.filter((m) => valuesOf(m, q.promptKind).includes(choice));
        const related = from.some((m) => m.region === muscle.region || (m.groups ?? []).some((g) => groups.has(g)));
        if (!related) unrelated.push(`${q.id}: "${choice}"`);
      }
    }
    expect(unrelated).toEqual([]);
  });

  it('marks exactly the muscle\'s own values as correct', () => {
    for (const q of all) {
      if (q.format !== 'select') continue;
      const correct = q.correctIndices.map((i) => q.choices[i]).sort();
      const muscle = byId.get(q.structureId)!;
      const expected = correctValuesFor(muscle, q.promptKind)
        .map((v) => (q.promptKind === 'action' ? humanizeActionTag(v) : v))
        .sort();
      expect(correct, q.id).toEqual(expected);
    }
  });
});

describe('select to typed escalation', () => {
  it('switches only the fact that has been mastered', () => {
    const questions = build([byId.get('biceps-femoris')!], {
      factMastery: [fact('biceps-femoris', 'nerve', true)],
    });
    const formats = Object.fromEntries(questions.map((q) => [q.promptKind, q.format]));
    expect(formats).toEqual({ origin: 'select', insertion: 'select', nerve: 'typed', action: 'select' });
  });

  it('gives one box per authored value', () => {
    const q = one('biceps-femoris', 'origin', { forceFormat: 'typed' }) as OinaTypedQuestion;
    expect(q.slots.map((s) => s.label)).toEqual(['origin 1 of 2', 'origin 2 of 2']);
    expect(q.prompt).toBe('Name all 2 origins of Biceps Femoris.');
  });

  it('collapses triceps brachii to two boxes — two of its three heads share one origin', () => {
    const q = one('triceps-brachii', 'origin', { forceFormat: 'typed' }) as OinaTypedQuestion;
    expect(q.slots).toHaveLength(2);
  });

  it('asks in the singular when there is one value', () => {
    const q = one('iliacus', 'insertion', { forceFormat: 'typed' }) as OinaTypedQuestion;
    expect(q.slots).toHaveLength(1);
    expect(q.prompt).toBe('What is the insertion of Iliacus?');
    expect(q.slots[0].label).toBe('insertion');
  });

  it('gives every typed slot at least one accepted answer', () => {
    for (const q of build(muscles, { forceFormat: 'typed' })) {
      if (q.format !== 'typed') continue;
      for (const slot of q.slots) expect(slot.accepted.length, `${q.id}/${slot.label}`).toBeGreaterThan(0);
    }
  });
});
