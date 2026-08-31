import { describe, it, expect } from 'vitest';
import type { JointStructure } from '../../types/structure';
import { buildMcqQuestions } from '../questionGenerators/mcq';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { isMcqQuestion } from '../../types/question';

function joint(overrides: Partial<JointStructure> & { id: string; name: string; jointType: JointStructure['jointType'] }): JointStructure {
  return {
    category: 'joint',
    region: 'shoulder-arm',
    subregion: 'shoulder',
    description: '',
    aliases: [],
    imageIds: [],
    eligibility: { flashcard: true, mcq: true, locate: false },
    difficulty: 'medium',
    tags: [],
    articulatingStructureIds: [],
    movements: ['Flexion', 'Extension'],
    ...overrides,
  };
}

const GLENOHUMERAL = joint({ id: 'glenohumeral-joint', name: 'Glenohumeral Joint', jointType: 'ball-and-socket' });
const HUMEROULNAR = joint({ id: 'humeroulnar-joint', name: 'Humeroulnar Joint', jointType: 'hinge' });
const PROXIMAL_RADIOULNAR = joint({ id: 'proximal-radioulnar-joint', name: 'Proximal Radioulnar Joint', jointType: 'pivot' });

const FIXTURE = [GLENOHUMERAL, HUMEROULNAR, PROXIMAL_RADIOULNAR];

describe('buildMcqQuestions (joints, CR-014)', () => {
  it('generates a joint-type question with the correctly formatted answer among the choices', () => {
    const indexes = buildIndexes(FIXTURE);
    const result = buildMcqQuestions(FIXTURE, [], indexes, createRng(1));
    const q = result.find((r) => r.id === 'mcq-glenohumeral-joint-joint-type');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.choices[q.correctIndex]).toBe('ball-and-socket joint');
  });

  // CR-017 added two non-synovial types to JointType. The old formatter mangled the raw
  // value ('symphysis' -> "symphysis joint"), which is not a thing; JOINT_TYPE_LABELS
  // names them properly, and this locks that in for the correct answer and distractors alike.
  it('names non-synovial joint types properly rather than suffixing "joint" onto the raw value', () => {
    const PUBIC_SYMPHYSIS = joint({ id: 'pubic-symphysis', name: 'Pubic Symphysis', jointType: 'symphysis' });
    const SYNDESMOSIS = joint({ id: 'distal-tibiofibular-joint', name: 'Distal Tibiofibular Joint', jointType: 'syndesmosis' });
    const fixture = [...FIXTURE, PUBIC_SYMPHYSIS, SYNDESMOSIS];
    const indexes = buildIndexes(fixture);
    const result = buildMcqQuestions(fixture, [], indexes, createRng(3));

    const q = result.find((r) => r.id === 'mcq-pubic-symphysis-joint-type');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.choices[q.correctIndex]).toBe('secondary cartilaginous joint (symphysis)');
    for (const choice of q.choices) {
      expect(choice).not.toMatch(/^(symphysis|syndesmosis) joint$/);
    }
  });

  it('generates a text-clue identify question for a joint (unlike bones, which skip this variant)', () => {
    const indexes = buildIndexes(FIXTURE);
    const result = buildMcqQuestions(FIXTURE, [], indexes, createRng(2));
    const q = result.find((r) => r.id === 'mcq-humeroulnar-joint-identify-text');
    expect(q).toBeDefined();
    if (!q || !isMcqQuestion(q)) return;
    expect(q.choices[q.correctIndex]).toBe('Humeroulnar Joint');
  });

  it('draws joint-type distractors from other joints, never duplicating the correct answer', () => {
    const indexes = buildIndexes(FIXTURE);
    const result = buildMcqQuestions(FIXTURE, [], indexes, createRng(3));
    for (const q of result.filter((r) => r.promptKind === 'joint-type')) {
      if (!isMcqQuestion(q)) continue;
      expect(new Set(q.choices).size).toBe(q.choices.length);
    }
  });
});
