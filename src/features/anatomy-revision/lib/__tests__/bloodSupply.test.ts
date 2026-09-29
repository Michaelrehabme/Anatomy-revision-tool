import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';
import { buildBloodSupplyMcqs, buildBloodSupplyMultiSelect, choiceName, RATING_CHOICES, vesselKey } from '../questionGenerators/bloodSupply';

/** Every word of the shorter name (brackets opened) appears in the longer: the generator's own overlap rule, restated. */
function sameVessel(a: string, b: string): boolean {
  const w = (x: string) => new Set(vesselKey(x.replace(/[()]/g, ' ')).split(' ').filter(Boolean));
  const [x, y] = [w(a), w(b)];
  const sub = (p: Set<string>, q: Set<string>) => p.size > 0 && [...p].every((t) => q.has(t));
  return sub(new Set(vesselKey(a).split(' ').filter(Boolean)), y) || sub(new Set(vesselKey(b).split(' ').filter(Boolean)), x);
}
import { createRng } from '../rng';
import { generateRevisionSet } from '../questionGenerators/generateSet';

const supplied = ALL_STRUCTURES.filter((s) => s.bloodSupply);
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

describe('the reviewed blood supply in the seed', () => {
  it('covers the 234 accepted structures and never a landmark', () => {
    expect(supplied.length).toBe(234);
    expect(supplied.filter((s) => s.category === 'landmark')).toEqual([]);
  });

  it('never repeats the primary among the assisting arteries', () => {
    for (const s of supplied) {
      const b = s.bloodSupply!;
      if (b.primary) expect(b.assisting.map(vesselKey)).not.toContain(vesselKey(b.primary));
    }
  });

  it('dropped the arteries no quoted source supports', () => {
    expect(byId.get('tibialis-anterior')!.bloodSupply!.assisting).not.toContain('Medial tarsal arteries');
    expect(byId.get('triceps-brachii')!.bloodSupply!.assisting).not.toContain('Middle collateral artery');
  });
});

describe('vesselKey', () => {
  it('treats spelling variants of one vessel as the same', () => {
    expect(vesselKey('Lumbar arteries')).toBe(vesselKey('Lumbar artery (lumbar branch)'));
    expect(vesselKey('Femoral artery (muscular branches)')).toBe(vesselKey('femoral artery'));
    expect(vesselKey('Superior gluteal artery')).not.toBe(vesselKey('Inferior gluteal artery'));
  });
});

describe('blood supply questions', () => {
  const rng = createRng(7);
  const mcqs = buildBloodSupplyMcqs(supplied, ALL_STRUCTURES, rng);
  const selects = buildBloodSupplyMultiSelect(supplied, ALL_STRUCTURES, rng);

  it('asks for the primary supply with four choices, none a synonym of its own arteries', () => {
    const primaries = mcqs.filter((q) => q.promptKind === 'blood-supply');
    expect(primaries.length).toBeGreaterThan(200);
    for (const q of primaries) {
      const b = byId.get(q.structureId)!.bloodSupply!;
      expect(q.choices).toHaveLength(4);
      expect(q.choices[q.correctIndex]).toBe(choiceName(b.primary!));
      const own = [b.primary!, ...b.assisting];
      const wrong = q.choices.filter((_, i) => i !== q.correctIndex);
      for (const w of wrong) expect(own.some((o) => sameVessel(w, o)), `${q.structureId}: ${w}`).toBe(false);
      expect(new Set(q.choices.map(vesselKey)).size).toBe(4);
      // No bracketed detail in a choice, so length never gives the answer away.
      for (const c of q.choices) expect(c).not.toMatch(/\(/);
    }
  });

  it('asks how rich the supply is for every reviewed structure, on a fixed Rich/Moderate/Poor scale', () => {
    const ratings = mcqs.filter((q) => q.promptKind === 'blood-supply-rating');
    expect(ratings).toHaveLength(234);
    for (const q of ratings) {
      expect(q.choices).toEqual(['Rich', 'Moderate', 'Poor']);
      expect(RATING_CHOICES[q.correctIndex].rating).toBe(byId.get(q.structureId)!.bloodSupply!.rating);
    }
    const supra = ratings.find((q) => q.structureId === 'supraspinatus')!;
    expect(supra.choices[supra.correctIndex]).toBe('Poor');
    expect(supra.explanation).toMatch(/poorly supplied part/i);
  });

  it('asks for the assisting arteries by name, never offering the primary as a wrong answer', () => {
    expect(selects.length).toBeGreaterThan(100);
    for (const q of selects) {
      const b = byId.get(q.structureId)!.bloodSupply!;
      const correct = q.correctIndices.map((i) => q.choices[i]);
      for (const c of correct) expect(b.assisting.map(choiceName)).toContain(c);
      expect(q.choices).not.toContain(choiceName(b.primary!));
      const wrong = q.choices.filter((_, i) => !q.correctIndices.includes(i));
      const own = [b.primary!, ...b.assisting];
      for (const w of wrong) expect(own.some((o) => sameVessel(w, o)), `${q.structureId}: ${w}`).toBe(false);
      expect(wrong.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('never offers, as wrong, an artery of anything sharing the structure area, since the lists are not exhaustive', () => {
    for (const q of [...mcqs.filter((m) => m.promptKind === 'blood-supply'), ...selects]) {
      const mine = new Set(areasOf(byId.get(q.structureId)!));
      const neighbours = supplied.filter((s) => s.id !== q.structureId && areasOf(s).some((a) => mine.has(a)));
      const nearby = neighbours.flatMap((s) => [s.bloodSupply!.primary, ...s.bloodSupply!.assisting].filter(Boolean) as string[]);
      const wrong = 'correctIndex' in q ? q.choices.filter((_, i) => i !== q.correctIndex) : q.choices.filter((_, i) => !q.correctIndices.includes(i));
      for (const w of wrong) expect(nearby.some((n) => choiceName(n) === w), `${q.structureId}: ${w}`).toBe(false);
    }
  });

  it('turns up in an ordinary multiple-choice session', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: ['mcq'], mode: 'practice', areas: ['knee'], seed: 3 });
    expect(set.some((q) => q.promptKind === 'blood-supply' || q.promptKind === 'blood-supply-rating')).toBe(true);
  });
});
