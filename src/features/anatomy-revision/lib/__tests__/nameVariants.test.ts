import { describe, it, expect } from 'vitest';
import { structureNameVariants, swapFibularPeroneal } from '../nameVariants';
import { isAnswerMatch, singular } from '../answerMatching';
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
    // The hand's interphalangeal joints are two rows now, so the qualifier
    // being dropped here is "of the Hand" — not which row, which is the answer.
    expect(accept('proximal-interphalangeal-joint-hand', 'proximal interphalangeal joint')).toBe(true);
    expect(accept('distal-interphalangeal-joint-hand', 'distal interphalangeal joint')).toBe(true);
  });

  it('still refuses a different structure in the same part', () => {
    expect(accept('phalanges-distal-hand', 'middle phalanges')).toBe(false);
    expect(accept('phalanges-distal-hand', 'metacarpals')).toBe(false);
  });

  it('never lets one structure answer for another that is not its twin', () => {
    // The whole safety argument for stripping the qualifier: across the entire
    // dataset, two structures may share a stripped name ONLY when they are the
    // same structure in the hand and in the foot.
    // Keyed on the singular of each word, which is what grading compares: a
    // plural must not be another structure's name either.
    const byForm = new Map<string, string[]>();
    for (const s of ALL_STRUCTURES) {
      for (const form of structureNameVariants(s.name, s.aliases)) {
        const key = form.toLowerCase().split(/\s+/).map(singular).join(' ');
        byForm.set(key, [...new Set([...(byForm.get(key) ?? []), s.id])]);
      }
    }
    // The sacrum's superior articular process is a vertebra's, on the sacrum:
    // the same structure where the picture has already said which bone.
    const twinned = (ids: string[]) =>
      new Set(ids.map((id) => id.replace(/-(hand|foot|sacrum)$/, ''))).size === 1;
    const bad = [...byForm.entries()].filter(([, ids]) => ids.length > 1 && !twinned(ids));
    expect(bad.map(([form, ids]) => `${form}: ${ids.join(', ')}`)).toEqual([]);
  });
});

describe('anything in brackets is optional', () => {
  const accept = (id: string, typed: string) => {
    const s = ALL_STRUCTURES.find((x) => x.id === id)!;
    return isAnswerMatch(typed, structureNameVariants(s.name, s.aliases));
  };

  it('does not make a student type the vertebral levels', () => {
    // Found on a phone, 11 Oct 2026: "Thoracic vertebrae" marked wrong.
    expect(accept('thoracic-vertebrae', 'Thoracic vertebrae')).toBe(true);
    expect(accept('lumbar-vertebrae', 'lumbar vertebrae')).toBe(true);
    expect(accept('atlas-c1', 'atlas')).toBe(true);
    expect(accept('thoracic-vertebrae', 'Thoracic Vertebrae (T1–T12)')).toBe(true);
  });

  it('drops a bracket wherever it falls in the name', () => {
    expect(accept('facet-joint', 'facet joint')).toBe(true);
    expect(accept('dens-odontoid-process', 'dens')).toBe(true);
    expect(accept('asis', 'anterior superior iliac spine')).toBe(true);
  });

  it('keeps the bracket that is the answer', () => {
    expect(accept('posterior-meniscotibial-ligament-lateral-meniscus', 'posterior meniscotibial ligament')).toBe(false);
    expect(accept('thoracic-vertebrae', 'lumbar vertebrae')).toBe(false);
  });
});

describe('singular and plural are the same answer', () => {
  const accept = (id: string, typed: string) => {
    const s = ALL_STRUCTURES.find((x) => x.id === id)!;
    return isAnswerMatch(typed, structureNameVariants(s.name, s.aliases));
  };

  it('takes "malleoli" for "malleolus", and the other way round', () => {
    // Found on a phone, 11 Oct 2026, on a plate showing the lateral malleolus.
    expect(accept('lateral-malleolus', 'Lateral malleoli')).toBe(true);
    expect(accept('thoracic-vertebrae', 'thoracic vertebra')).toBe(true);
    expect(accept('vertebral-body', 'vertebral bodies')).toBe(true);
    expect(accept('spinous-process', 'spinous processes')).toBe(true);
    expect(accept('phalanges-distal-hand', 'distal phalanx')).toBe(true);
    expect(accept('carpals', 'carpal')).toBe(true);
  });

  it('does not fold two different words together', () => {
    expect(singular('trapezium')).not.toBe(singular('trapezius'));
    expect(accept('lateral-malleolus', 'medial malleoli')).toBe(false);
  });
});
