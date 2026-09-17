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

describe('optional trailing qualifiers', () => {
  const accept = (id: string, typed: string) => {
    const s = ALL_STRUCTURES.find((x) => x.id === id)!;
    return isAnswerMatch(typed, structureNameVariants(s.name, s.aliases));
  };

  it('does not make a student type "(grouped)"', () => {
    expect(accept('phalanges-distal-hand', 'Distal phalanges of the hand')).toBe(true);
    expect(accept('carpals', 'carpals')).toBe(true);
    expect(accept('metatarsals', 'metatarsals')).toBe(true);
  });

  it('does not make a student type "(Hand)" or "(Foot)"', () => {
    expect(accept('abductor-digiti-minimi-hand', 'Abductor digiti minimi')).toBe(true);
    expect(accept('abductor-digiti-minimi-foot', 'abductor digiti minimi')).toBe(true);
    expect(accept('dorsal-interossei-hand', 'Dorsal interossei')).toBe(true);
    expect(accept('lumbricals-hand', 'lumbricals')).toBe(true);
  });

  it('still accepts the full authored name', () => {
    expect(accept('phalanges-distal-hand', 'Distal Phalanges of the Hand (grouped)')).toBe(true);
    expect(accept('abductor-digiti-minimi-hand', 'Abductor Digiti Minimi (Hand)')).toBe(true);
  });

  it('strips a qualifier without opening the name up to a different structure', () => {
    expect(accept('abductor-digiti-minimi-hand', 'flexor digiti minimi')).toBe(false);
    expect(accept('phalanges-distal-hand', 'proximal phalanges of the hand')).toBe(false);
  });
});

describe('"of the hand" and "of the foot" are optional too', () => {
  const accept = (id: string, typed: string) => {
    const s = ALL_STRUCTURES.find((x) => x.id === id)!;
    return isAnswerMatch(typed, structureNameVariants(s.name, s.aliases));
  };

  it('accepts the bare name of a grouped phalanx entry', () => {
    // The user's rule: a student looking at the picture has already answered
    // the hand-or-foot half of "Distal Phalanges of the Hand (grouped)".
    expect(accept('phalanges-distal-hand', 'distal phalanges')).toBe(true);
    expect(accept('phalanges-middle-foot', 'middle phalanges')).toBe(true);
    expect(accept('phalanges-proximal-hand', 'Proximal Phalanges')).toBe(true);
  });

  it('accepts the bare name when the qualifier is a phrase, not brackets', () => {
    expect(accept('interphalangeal-joint-hand', 'interphalangeal joint')).toBe(true);
  });

  it('still refuses a different structure in the same part', () => {
    expect(accept('phalanges-distal-hand', 'middle phalanges')).toBe(false);
    expect(accept('phalanges-distal-hand', 'metacarpals')).toBe(false);
  });

  it('never lets one structure answer for another that is not its twin', () => {
    // The whole safety argument for stripping the qualifier: across the entire
    // dataset, two structures may share a stripped name ONLY when they are the
    // same structure in the hand and in the foot.
    const byForm = new Map<string, string[]>();
    for (const s of ALL_STRUCTURES) {
      for (const form of structureNameVariants(s.name, s.aliases)) {
        const key = form.toLowerCase();
        byForm.set(key, [...new Set([...(byForm.get(key) ?? []), s.id])]);
      }
    }
    const twinned = (ids: string[]) =>
      new Set(ids.map((id) => id.replace(/-(hand|foot)$/, ''))).size === 1;
    const bad = [...byForm.entries()].filter(([, ids]) => ids.length > 1 && !twinned(ids));
    expect(bad.map(([form, ids]) => `${form}: ${ids.join(', ')}`)).toEqual([]);
  });
});
