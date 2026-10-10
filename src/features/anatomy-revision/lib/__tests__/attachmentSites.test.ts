import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { isLigament } from '../../types/structure';
import { siteLabel } from '../attachmentSites';
import { gradeTypedSlots } from '../oinaAnswer';
import { buildIdentifyTypedQuestions } from '../questionGenerators/identifyTyped';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildVocabulary } from '../../data/content/vocabulary';
import { AREAS } from '../../types/region';
import { areasOf, reviewedAttachmentIds } from '../../types/structure';
import type { FlashcardQuestion, MCQQuestion } from '../../types/question';

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const label = (id: string) => siteLabel(byId.get(id)!, byId);

describe('an attachment reads as "landmark of bone"', () => {
  it('names the bone a landmark is on', () => {
    expect(label('greater-trochanter')).toBe('Greater Trochanter of the femur');
    expect(label('intertrochanteric-line')).toBe('Intertrochanteric Line of the femur');
    expect(label('dens-odontoid-process')).toBe('Dens (Odontoid Process) of the axis');
    expect(label('acetabulum')).toBe('Acetabulum of the hip bone');
    expect(label('coracoid-process')).toBe('Coracoid Process of the scapula');
  });

  it('leaves a bone, a bone filed as a landmark, and a name that already says its bone', () => {
    expect(label('femur')).toBe('Femur');
    expect(label('ilium')).toBe('Ilium');
    expect(label('scaphoid')).toBe('Scaphoid');
    expect(label('head-of-fibula')).toBe('Head of Fibula');
    // The adjective names the bone too.
    expect(label('ischial-tuberosity')).toBe('Ischial Tuberosity');
    expect(label('aiis')).toBe('Anterior Inferior Iliac Spine (AIIS)');
    expect(label('femoral-head')).toBe('Femoral Head');
    expect(label('medial-condyle-femur')).toBe('Medial Condyle of Femur');
  });

  it('prints every ligament attachment without saying "of the X" twice', () => {
    for (const l of ALL_STRUCTURES.filter(isLigament)) {
      for (const id of l.attachmentStructureIds) {
        const site = byId.get(id);
        if (site) expect(siteLabel(site, byId), `${l.id}: ${id}`).not.toMatch(/ of (?:the )?(\w+) of the \1/i);
      }
    }
  });
});

describe('a bonus box takes the landmark with or without its bone', () => {
  const question = buildIdentifyTypedQuestions(ALL_STRUCTURES, ALL_IMAGES).find((q) => q.structureId === 'ischiofemoral-ligament')!;
  const slots = question.attachmentSlots!;
  const right = (...typed: string[]) => gradeTypedSlots(typed, slots).correctCount;

  it('shows the full form', () => {
    expect(slots.map((s) => s.accepted[0]).sort()).toEqual(['Greater Trochanter of the femur', 'Ischium']);
  });

  it('is right for the landmark alone, and with its bone', () => {
    expect(right('greater trochanter', 'ischium')).toBe(2);
    expect(right('greater trochanter of the femur', 'ischium')).toBe(2);
  });

  it('is not right for the bone alone', () => {
    expect(right('femur', 'pelvis')).toBe(0);
  });
});

/**
 * Found at the merge with the content-server branch, 10 Oct 2026. The back of
 * a card and a multiple-choice explanation looked a site up among the
 * structures they had been handed, and fell back to the id as words when it
 * was not there. So a session narrowed to ligaments (no bone in its pool), or
 * built from one area's facts (the bone is in another), read "greater
 * trochanter; ischium" where every other session read "Greater Trochanter of
 * the femur; Ischium". They now look sites up in the index, which holds
 * every name.
 */
describe('an explanation names a site the same way whatever the session holds', () => {
  const sources = { index: ALL_STRUCTURES, vocabulary: buildVocabulary(ALL_STRUCTURES) };
  const base = { mode: 'practice' as const, seed: 1, count: 50, entitledAreas: AREAS };
  const attachesTo = (text: string) => text.split('\n').find((line) => line.startsWith('Attaches to: '));

  it('in a session of ligaments alone, on the card and in the explanation', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, {
      ...base, types: ['flashcard', 'mcq'], category: 'ligament', structureIds: ['ischiofemoral-ligament'],
    });
    const cards = set.filter((q): q is FlashcardQuestion => q.type === 'flashcard');
    const mcqs = set.filter((q): q is MCQQuestion => q.type === 'mcq');
    expect(cards.length).toBeGreaterThan(0);
    expect(mcqs.length).toBeGreaterThan(0);
    for (const card of cards) expect(attachesTo(card.back.text), card.id).toBe('Attaches to: Ischium; Greater Trochanter of the femur');
    for (const q of mcqs) expect(attachesTo(q.explanation), q.id).toBe('Attaches to: Ischium; Greater Trochanter of the femur');
  });

  it("from one area's facts, where the bone a ligament reaches is in another area", () => {
    let checked = 0;
    for (const area of AREAS) {
      const loaded = ALL_STRUCTURES.filter((s) => areasOf(s).includes(area));
      const held = new Set(loaded.map((s) => s.id));
      const reaching = loaded.filter(isLigament).find((l) => reviewedAttachmentIds(l).some((id) => byId.has(id) && !held.has(id)));
      if (!reaching) continue;
      const set = generateRevisionSet(
        loaded,
        ALL_IMAGES,
        { ...base, types: ['flashcard', 'mcq'], areas: [area], entitledAreas: [area], structureIds: [reaching.id] },
        sources,
      );
      const expected = `Attaches to: ${reviewedAttachmentIds(reaching).map((id) => label(id)).join('; ')}`;
      const texts = set.flatMap((q) => (q.type === 'flashcard' ? [q.back.text] : q.type === 'mcq' ? [q.explanation] : []));
      for (const text of texts.filter((t) => t.includes('Attaches to: '))) {
        expect(attachesTo(text), `${area}: ${reaching.id}`).toBe(expected);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
