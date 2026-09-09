import { describe, it, expect } from 'vitest';
import { structureNameVariants, swapFibularPeroneal } from '../nameVariants';
import { isAnswerMatch } from '../answerMatching';
import { ALL_STRUCTURES } from '../../data/seed';

describe('swapFibularPeroneal', () => {
  it('swaps both conventions in both directions, keeping capitalisation', () => {
    expect(swapFibularPeroneal('Superficial fibular nerve')).toBe('Superficial peroneal nerve');
    expect(swapFibularPeroneal('Common peroneal nerve')).toBe('Common fibular nerve');
    expect(swapFibularPeroneal('Peroneus Longus')).toBe('Fibularis Longus');
    expect(swapFibularPeroneal('Fibularis tertius muscle')).toBe('Peroneus tertius muscle');
  });

  it('matches fibularis whole rather than through the shorter rule', () => {
    // "fibularis" -> "fibular" + "is" would give "peronealis", which is not a
    // word in either convention.
    expect(swapFibularPeroneal('fibularis longus')).toBe('peroneus longus');
  });

  it('leaves names containing neither word alone', () => {
    expect(swapFibularPeroneal('Tibialis anterior')).toBeNull();
    expect(swapFibularPeroneal('Median nerve')).toBeNull();
  });
});

describe('structureNameVariants', () => {
  it('accepts the alias without its trailing "muscle"', () => {
    // The aliases are authored Z-Anatomy style, and typed grading tolerates
    // one character — so "fibularis longus" used to fail against an alias
    // that exists precisely to accept it.
    const variants = structureNameVariants('Peroneus Longus', ['Fibularis longus muscle']);
    expect(variants).toContain('Fibularis longus');
  });

  it('grades every peroneal muscle under either convention', () => {
    for (const id of ['peroneus-longus', 'peroneus-brevis', 'peroneus-tertius']) {
      const s = ALL_STRUCTURES.find((x) => x.id === id)!;
      const accepted = structureNameVariants(s.name, s.aliases);
      const peroneus = s.name.toLowerCase();
      expect(isAnswerMatch(peroneus, accepted)).toBe(true);
      expect(isAnswerMatch(peroneus.replace('peroneus', 'fibularis'), accepted)).toBe(true);
    }
  });

  it('does not let one muscle answer for another', () => {
    const brevis = structureNameVariants('Peroneus Brevis', ['Fibularis brevis muscle']);
    expect(isAnswerMatch('fibularis longus', brevis)).toBe(false);
    expect(isAnswerMatch('peroneus longus', brevis)).toBe(false);
  });
});
