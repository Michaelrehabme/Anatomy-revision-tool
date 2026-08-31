import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../../data/seed';
import { isJoint, areaOf, EQUIVALENT_MOVEMENT_GROUPS } from '../../types/structure';
import type { JointMovement } from '../../types/structure';
import { buildIndexes } from '../indexes';
import { buildMultiSelectQuestions } from '../questionGenerators/multiSelect';
import { createRng } from '../rng';

describe('buildMultiSelectQuestions', () => {
  const indexes = buildIndexes(ALL_STRUCTURES);

  it('generates at least one question over the full seed dataset', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(1));
    expect(result.length).toBeGreaterThan(0);
  });

  it('is deterministic given the same seed', () => {
    const a = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(42));
    const b = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(42));
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it('every question has at least 2 correct indices for nerve-based questions, or exactly 1 for exclusion questions', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(3));
    for (const q of result) {
      expect(q.correctIndices.length).toBeGreaterThan(0);
      if (q.id.startsWith('multiselect-nerve-')) {
        expect(q.correctIndices.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(q.correctIndices.length).toBe(1);
      }
    }
  });

  it('every correct index is within bounds and choices have no duplicate names', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(5));
    for (const q of result) {
      for (const i of q.correctIndices) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(q.choices.length);
      }
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });

  it('generates at least one joint-movement question, with exactly one correct index (CR-014)', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(2));
    const jointQuestions = result.filter((q) => q.id.startsWith('multiselect-joint-movement-'));
    expect(jointQuestions.length).toBeGreaterThan(0);
    for (const q of jointQuestions) {
      expect(q.correctIndices.length).toBe(1);
    }
  });

  it('the humeroulnar joint question flags a movement genuinely absent from its own movements list', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(2));
    const q = result.find((r) => r.id === 'multiselect-joint-movement-humeroulnar-joint');
    expect(q).toBeDefined();
    if (!q) return;
    const oddOneOut = q.choices[q.correctIndices[0]];
    expect(['Flexion', 'Extension']).not.toContain(oddOneOut);
  });

  // The three CR-017 correctness guards on the odd-one-out. All of these were reachable
  // once the joint pool grew from 5 to 29 — the generator compares movement strings
  // literally, so a "not possible here" answer can be flatly false without them.
  describe('joint-movement odd-one-out truthfulness (CR-017)', () => {
    const joints = ALL_STRUCTURES.filter(isJoint);
    const byId = new Map(joints.map((j) => [j.id, j]));
    // Sweep seeds rather than trusting one: which odd-one-out gets sampled is rng-dependent,
    // so a single seed would only exercise a fraction of the candidate pool.
    const allJointQuestions = Array.from({ length: 25 }, (_, i) =>
      buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(i + 1)),
    )
      .flat()
      .filter((q) => q.id.startsWith('multiselect-joint-movement-'));

    it('never offers a movement the joint actually performs', () => {
      for (const q of allJointQuestions) {
        const joint = byId.get(q.id.replace('multiselect-joint-movement-', ''));
        expect(joint).toBeDefined();
        if (!joint) continue;
        const oddOneOut = q.choices[q.correctIndices[0]];
        expect(joint.movements).not.toContain(oddOneOut);
      }
    });

    it('never offers gliding, which occurs at essentially every synovial joint', () => {
      for (const q of allJointQuestions) {
        expect(q.choices[q.correctIndices[0]]).not.toBe('Gliding');
      }
    });

    it('never offers a regional synonym of a movement the joint performs', () => {
      // e.g. the radiocarpal joint lists 'Radial deviation'; offering 'Abduction' as the
      // movement it cannot do would be false, since at the wrist they are the same motion.
      for (const q of allJointQuestions) {
        const joint = byId.get(q.id.replace('multiselect-joint-movement-', ''));
        if (!joint) continue;
        const oddOneOut = q.choices[q.correctIndices[0]] as JointMovement;
        const synonyms = EQUIVALENT_MOVEMENT_GROUPS.find((g) => g.includes(oddOneOut)) ?? [];
        for (const synonym of synonyms) {
          expect(joint.movements).not.toContain(synonym);
        }
      }
    });

    it('prefers an odd-one-out from the joint\'s own area, so the question stays discriminating', () => {
      // The wrist has five other joints to draw from, so it should never need the fallback.
      const radiocarpal = byId.get('radiocarpal-joint');
      expect(radiocarpal).toBeDefined();
      if (!radiocarpal) return;
      const sameAreaMovements = new Set(
        joints.filter((j) => areaOf(j) === 'wrist-hand' && j.id !== radiocarpal.id).flatMap((j) => j.movements),
      );
      for (const q of allJointQuestions.filter((q) => q.id.endsWith('radiocarpal-joint'))) {
        expect(sameAreaMovements).toContain(q.choices[q.correctIndices[0]]);
      }
    });
  });

  it('nerve questions only mark muscles actually on that nerve as correct', () => {
    const result = buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(8));
    const nerveQuestion = result.find((q) => q.id.startsWith('multiselect-nerve-'));
    expect(nerveQuestion).toBeDefined();
    if (!nerveQuestion) return;

    const nerveName = nerveQuestion.id.replace('multiselect-nerve-', '').replace(/-/g, ' ');
    const structureIdsOnNerve = new Set(
      [...indexes.byNerve.entries()].find(([name]) => name.toLowerCase() === nerveName)?.[1] ?? [],
    );
    const structuresByName = new Map(ALL_STRUCTURES.map((s) => [s.name, s.id]));

    nerveQuestion.choices.forEach((name, i) => {
      const id = structuresByName.get(name);
      const isMarkedCorrect = nerveQuestion.correctIndices.includes(i);
      if (id && structureIdsOnNerve.has(id)) {
        expect(isMarkedCorrect).toBe(true);
      } else {
        expect(isMarkedCorrect).toBe(false);
      }
    });
  });
});
