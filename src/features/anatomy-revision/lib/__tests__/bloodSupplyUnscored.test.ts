import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { ASKED_FACT_KINDS, BLOOD_SUPPLY_SCORED, type QuestionType } from '../../types/question';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildBloodSupplyFlashcard } from '../questionGenerators/flashcards';
import { requiredFactKinds } from '../factMastery';

/**
 * Blood supply is taught and not marked (owner's decision, 12 October 2026).
 * What that has to mean everywhere at once: nothing scored asks it, mastery
 * does not wait on it, and it is still there to learn from as a card.
 */
describe('blood supply while it is unscored', () => {
  const session = (types: QuestionType[]) =>
    generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { types, entitledAreas: AREAS, mode: 'practice', seed: 3 });

  it('is switched off, and the fact track offers the four muscle facts alone', () => {
    expect(BLOOD_SUPPLY_SCORED).toBe(false);
    expect([...ASKED_FACT_KINDS]).toEqual(['origin', 'insertion', 'nerve', 'action']);
  });

  it('is asked by no scored format', () => {
    const scored = session(['mcq', 'oina', 'multi-select', 'identify-typed', 'locate', 'fill-blank']).filter(
      (q) => q.type !== 'flashcard',
    );
    expect(scored.length).toBeGreaterThan(1000);
    expect(scored.filter((q) => q.promptKind.startsWith('blood-supply'))).toEqual([]);
  });

  it('is required for the mastery of no structure', () => {
    const waiting = ALL_STRUCTURES.filter((s) => requiredFactKinds(s).some((kind) => kind.startsWith('blood-supply')));
    expect(waiting).toEqual([]);
  });

  it('is a flashcard for every structure that has cards and a named artery, landmarks apart', () => {
    const cards = session(['flashcard']).filter((q) => q.id.endsWith('-blood-supply-card'));
    const expected = ALL_STRUCTURES.filter((s) => s.eligibility.flashcard && s.category !== 'landmark' && s.bloodSupply?.primary);
    expect(expected.length).toBeGreaterThan(200);
    expect(cards.map((q) => q.structureId).sort()).toEqual(expected.map((s) => s.id).sort());
  });

  it('puts the arteries and the poorly supplied part on the card, and never the unsourced rating', () => {
    const acl = ALL_STRUCTURES.find((s) => s.id === 'anterior-cruciate-ligament')!;
    const card = buildBloodSupplyFlashcard(acl)!;
    const back = card.type === 'flashcard' ? card.back.text : '';
    expect(back).toContain(`Main artery: ${acl.bloodSupply!.primary}`);
    expect(back).toContain('Poorly supplied part:');
    expect(back).not.toMatch(/\b(rich|moderate|poor)\b(?!ly)/i);
  });
});
