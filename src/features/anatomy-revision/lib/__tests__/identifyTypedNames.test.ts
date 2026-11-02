import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { isLandmark } from '../../types/structure';
import { isAnswerMatch, itemVariants } from '../answerMatching';
import { buildIndexes } from '../indexes';
import { gradeTypedSlots } from '../oinaAnswer';
import { createRng } from '../rng';
import { ownBoneNames, withBone } from '../attachmentSites';
import { buildFillBlankQuestions } from '../questionGenerators/fillBlank';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';
import { buildOinaQuestions } from '../questionGenerators/oina';
import type { OinaTypedQuestion } from '../../types/question';

/**
 * Student reports, 1 Nov 2026: "greater trochanter of femur" was marked wrong.
 * A student who adds the bone has not changed the answer, and one who leaves it
 * off a picture question has not either. Naming the WRONG bone still fails.
 */
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('typing a landmark with or without its bone', () => {
  const questions = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES);
  const acceptedFor = (id: string) => questions.find((q) => q.structureId === id)!.acceptedAnswers;

  it.each([
    ['greater-trochanter', 'Greater trochanter of the femur'],
    ['greater-trochanter', 'greater trochanter of femur'],
    ['greater-trochanter', 'greater trochanter femur'],
    ['greater-trochanter', 'greater trochanter, femur'],
    ['greater-trochanter', 'femoral greater trochanter'],
    ['intertrochanteric-line', 'Intertrochanteric line of the femur'],
    ['greater-tubercle-humerus', 'Greater tubercle'],
    ['medial-epicondyle-humerus', 'medial epicondyle'],
    ['iliac-crest', 'iliac crest of the pelvis'],
    ['iliac-crest', 'iliac crest of the ilium'],
    ['sustentaculum-tali', 'sustentaculum tali of the calcaneus'],
  ])('%s takes "%s"', (id, typed) => {
    expect(isAnswerMatch(typed, acceptedFor(id))).toBe(true);
  });

  it.each([
    ['greater-trochanter', 'femur'],
    ['greater-trochanter', 'Lesser trochanter of the femur'],
    ['medial-epicondyle-humerus', 'medial epicondyle of femur'],
    ['lateral-condyle-tibia', 'lateral condyle of femur'],
    ['head-of-fibula', 'head'],
    ['spine-of-scapula', 'spine'],
  ])('%s refuses "%s"', (id, typed) => {
    expect(isAnswerMatch(typed, acceptedFor(id))).toBe(false);
  });

  it('takes the bone in every written form, on every landmark that has one', () => {
    const missed: string[] = [];
    const seen = new Set<string>();
    for (const q of questions) {
      const s = byId.get(q.structureId)!;
      if (!isLandmark(s) || seen.has(s.id)) continue;
      seen.add(s.id);
      const name = s.name.replace(/\s*\([^)]*\)/g, '').trim();
      for (const form of withBone(name, ownBoneNames(s, byId))) {
        if (!isAnswerMatch(form, q.acceptedAnswers)) missed.push(`${s.id}: ${form}`);
      }
    }
    expect(missed).toEqual([]);
  });
});

describe('filling a blank with or without the bone', () => {
  const questions = buildFillBlankQuestions(ALL_STRUCTURES, createRng(1));
  const accepted = (id: string, answer: string) => {
    const q = questions.find((x) => x.id === id)!;
    return [...itemVariants(answer), ...(q.alsoAccepted?.[answer] ?? [])];
  };

  it('takes the bone the statement is on', () => {
    expect(isAnswerMatch('lesser trochanter of the femur', accepted('fillblank-femur-attachment-2', 'lesser trochanter'))).toBe(true);
    expect(isAnswerMatch('lesser trochanter of the tibia', accepted('fillblank-femur-attachment-2', 'lesser trochanter'))).toBe(false);
  });

  it('does not need a bone the answer was written with', () => {
    expect(isAnswerMatch('manubrium', accepted('fillblank-clavicle-articulation-0', 'manubrium of the sternum'))).toBe(true);
    expect(isAnswerMatch('anterior arch atlas', accepted('fillblank-dens-odontoid-process-articulation-0', 'anterior arch of the atlas'))).toBe(true);
  });
});

describe('typed origin and insertion boxes', () => {
  const pool = ALL_STRUCTURES;
  const questions = buildOinaQuestions(pool, pool, buildIndexes(pool), createRng(1), { forceFormat: 'typed' }) as OinaTypedQuestion[];
  const grade = (id: string, typed: string) => {
    const q = questions.find((x) => x.id === id)!;
    return gradeTypedSlots([typed], q.slots).slotCorrect[0];
  };

  it.each([
    ['oina-iliacus-insertion-typed', 'lesser trochanter'],
    ['oina-iliacus-insertion-typed', 'lesser trochanter of the femur'],
    ['oina-semimembranosus-insertion-typed', 'medial condyle'],
    ['oina-semimembranosus-insertion-typed', 'medial condyle of tibia'],
    ['oina-rectus-femoris-insertion-typed', 'tibial tuberosity'],
    ['oina-semitendinosus-origin-typed', 'ischial tuberosity of the hip bone'],
  ])('%s takes "%s"', (id, typed) => {
    expect(grade(id, typed)).toBe(true);
  });

  it.each([
    ['oina-iliacus-insertion-typed', 'greater trochanter of the femur'],
    ['oina-iliacus-insertion-typed', 'greater trochanter'],
    ['oina-semimembranosus-insertion-typed', 'medial condyle of femur'],
  ])('%s refuses "%s"', (id, typed) => {
    expect(grade(id, typed)).toBe(false);
  });
});
