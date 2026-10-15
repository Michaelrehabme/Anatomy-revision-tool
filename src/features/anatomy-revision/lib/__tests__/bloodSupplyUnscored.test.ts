import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { ASKED_FACT_KINDS, BLOOD_SUPPLY_SCORED, BLOOD_SUPPLY_TAUGHT, type QuestionType } from '../../types/question';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildBloodSupplyFlashcard } from '../questionGenerators/flashcards';
import { requiredFactKinds } from '../factMastery';

/**
 * Blood supply is not marked (owner's decision, 12 October 2026), and while
 * it is being sourced it is not in the question pool at all (15 October). What
 * that has to mean everywhere at once: nothing scored asks it, mastery does not
 * wait on it, and no card or explanation states it. The card builder is kept,
 * tested here, for when it is sourced.
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

  it('is in no card and no explanation while it is unsourced (15 October 2026)', () => {
    expect(BLOOD_SUPPLY_TAUGHT).toBe(false);
    const all = session(['flashcard', 'mcq', 'identify-typed']);
    expect(all.filter((q) => q.id.endsWith('-blood-supply-card'))).toEqual([]);
    const shown = all.map((q) =>
      q.type === 'flashcard' ? `${q.front.text ?? ''}
${q.back.text}` : 'explanation' in q ? String(q.explanation ?? '') : '',
    );
    // What the blood supply data would add: the line on a card's back, and the
    // card of its own. Authored descriptions that mention a vessel in passing
    // (Guyon's canal, the scaphoid's retrograde supply) are prose about the
    // structure, sourced with it, and stay.
    expect(shown.filter((text) => /Blood supply \(|Main artery:/.test(text))).toEqual([]);
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
