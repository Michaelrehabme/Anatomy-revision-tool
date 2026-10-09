import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES } from '../../data/seed';
import { AREAS } from '../../types/region';
import { areasOf } from '../../types/structure';
import type { FactMastery } from '../../types/attempt';
import type { OinaQuestion } from '../../types/question';
import { buildBloodSupplyRatingMcqs, choiceName, RATING_CHOICES, vesselKey } from '../questionGenerators/bloodSupply';
import { buildOinaQuestions } from '../questionGenerators/oina';
import { generateRevisionSet } from '../questionGenerators/generateSet';
import { buildIndexes } from '../indexes';
import { acceptedVariantsFor, gradeTypedSlots } from '../oinaAnswer';
import { createRng } from '../rng';

const supplied = ALL_STRUCTURES.filter((s) => s.bloodSupply);
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const indexes = buildIndexes(ALL_STRUCTURES);

/** Every word of the shorter name (brackets opened) appears in the longer: the generator's own overlap rule, restated. */
function sameVessel(a: string, b: string): boolean {
  const w = (x: string) => new Set(vesselKey(x.replace(/[()]/g, ' ')).split(' ').filter(Boolean));
  const k = (x: string) => new Set(vesselKey(x).split(' ').filter(Boolean));
  const sub = (p: Set<string>, q: Set<string>) => p.size > 0 && [...p].every((t) => q.has(t));
  return sub(k(a), w(b)) || sub(k(b), w(a));
}

function fact(structureId: string, promptKind: FactMastery['promptKind'], typed: boolean, bare: boolean): FactMastery {
  return {
    userId: 'u',
    structureId,
    promptKind,
    attemptsTotal: 5,
    attemptsCorrect: 5,
    streak: 0,
    missStreak: 0,
    lastCorrect: true,
    lastAttemptAt: '2026-09-29T00:00:00.000Z',
    typed,
    bare,
  };
}

function bloodQuestions(factMastery: FactMastery[] = []): OinaQuestion[] {
  return buildOinaQuestions(supplied, ALL_STRUCTURES, indexes, createRng(7), {
    promptKinds: ['blood-supply', 'blood-supply-assisting'],
    factMastery,
  });
}

describe('the reviewed blood supply in the seed', () => {
  it('covers the 233 accepted structures and never a landmark', () => {
    expect(supplied.length).toBe(233);
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

describe('blood supply on the fact track: the choose stage', () => {
  const selects = bloodQuestions().filter((q) => q.format === 'select');

  it('asks every reviewed structure with a named artery for its primary, and for its assisting arteries where it has any', () => {
    const primaries = selects.filter((q) => q.promptKind === 'blood-supply');
    const assisting = selects.filter((q) => q.promptKind === 'blood-supply-assisting');
    expect(primaries.length).toBeGreaterThan(200);
    expect(assisting.length).toBeGreaterThan(150);
    for (const q of primaries) if (q.format === 'select') expect(q.correctIndices).toHaveLength(1);
  });

  it('never offers as wrong an artery of the structure itself, or of anything sharing its area', () => {
    for (const q of selects) {
      if (q.format !== 'select') continue;
      const s = byId.get(q.structureId)!;
      const b = s.bloodSupply!;
      const mine = new Set(areasOf(s));
      const nearby = supplied
        .filter((o) => areasOf(o).some((a) => mine.has(a)))
        .flatMap((o) => [o.bloodSupply!.primary, ...o.bloodSupply!.assisting].filter(Boolean) as string[]);
      const wrong = q.choices.filter((_, i) => !q.correctIndices.includes(i));
      expect(wrong.length).toBeGreaterThanOrEqual(2);
      for (const w of wrong) {
        expect([b.primary!, ...b.assisting].some((o) => sameVessel(w, o)), `${q.id}: ${w}`).toBe(false);
        expect(nearby.some((n) => choiceName(n) === w), `${q.id}: ${w}`).toBe(false);
      }
      // At most seven choices, unless the correct set alone needs more room:
      // every correct artery must be offered, plus at least two to rule out.
      expect(q.choices.length, q.id).toBeLessThanOrEqual(Math.max(7, q.correctIndices.length + 2));
      // Plain names, so the long answer is never the right one by length alone.
      for (const c of q.choices) expect(c).not.toMatch(/\(/);
    }
  });

  it('never offers the primary as a wrong answer among the assisting arteries', () => {
    for (const q of selects) {
      if (q.format !== 'select' || q.promptKind !== 'blood-supply-assisting') continue;
      const b = byId.get(q.structureId)!.bloodSupply!;
      expect(q.choices).not.toContain(choiceName(b.primary!));
    }
  });
});

describe('blood supply on the fact track: typed with hints, then without', () => {
  const deltoid = byId.get('deltoid')!;
  const hinted = bloodQuestions([fact('deltoid', 'blood-supply-assisting', true, false), fact('deltoid', 'blood-supply', true, false)]);
  const bare = bloodQuestions([fact('deltoid', 'blood-supply-assisting', true, true), fact('deltoid', 'blood-supply', true, true)]);
  const typedFor = (qs: OinaQuestion[], kind: string) =>
    qs.find((q) => q.structureId === 'deltoid' && q.promptKind === kind && q.format === 'typed');

  it('gives one box per assisting artery, hints on the first typed stage and none after', () => {
    const withHints = typedFor(hinted, 'blood-supply-assisting');
    const withoutHints = typedFor(bare, 'blood-supply-assisting');
    if (withHints?.format !== 'typed' || withoutHints?.format !== 'typed') throw new Error('expected typed questions');
    expect(withHints.slots).toHaveLength(deltoid.bloodSupply!.assisting.length);
    expect(withHints.hints).toBe('full');
    expect(withoutHints.hints).toBe('none');
  });

  it('accepts the plain name, the name without "artery", and the full authored name', () => {
    const q = typedFor(hinted, 'blood-supply');
    if (q?.format !== 'typed') throw new Error('expected a typed question');
    for (const answer of ['thoracoacromial artery', 'thoracoacromial', 'Thoracoacromial artery (deltoid and acromial branches)']) {
      expect(gradeTypedSlots([answer], q.slots).allCorrect, answer).toBe(true);
    }
    expect(gradeTypedSlots(['suprascapular artery'], q.slots).allCorrect).toBe(false);
  });

  it('keeps position words strict: superior medial is not superior lateral', () => {
    const owner = supplied.find((s) =>
      [s.bloodSupply!.primary, ...s.bloodSupply!.assisting].some((a) => /superior lateral genicular/i.test(a ?? '')),
    );
    if (!owner) return;
    const raw = [owner.bloodSupply!.primary!, ...owner.bloodSupply!.assisting].find((a) => /superior lateral genicular/i.test(a))!;
    const qs = buildOinaQuestions([owner], ALL_STRUCTURES, indexes, createRng(1), {
      promptKinds: ['blood-supply', 'blood-supply-assisting'],
      forceFormat: 'typed',
    });
    const slot = qs.flatMap((q) => (q.format === 'typed' ? q.slots : [])).find((sl) => sl.accepted[0] === raw);
    if (!slot) throw new Error('expected a slot for the artery');
    expect(gradeTypedSlots(['superior medial genicular artery'], [slot]).allCorrect).toBe(false);
    expect(gradeTypedSlots(['superior lateral genicular artery'], [slot]).allCorrect).toBe(true);
  });
});

describe('"How rich" stays multiple choice', () => {
  const ratings = buildBloodSupplyRatingMcqs(supplied);

  it('is asked for every reviewed structure on a fixed Rich/Moderate/Poor scale', () => {
    expect(ratings).toHaveLength(233);
    for (const q of ratings) {
      expect(q.choices).toEqual(['Rich', 'Moderate', 'Poor']);
      expect(RATING_CHOICES[q.correctIndex].rating).toBe(byId.get(q.structureId)!.bloodSupply!.rating);
    }
    const supra = ratings.find((q) => q.structureId === 'supraspinatus')!;
    expect(supra.choices[supra.correctIndex]).toBe('Poor');
    expect(supra.explanation).toMatch(/poorly supplied part/i);
  });

  it('turns up in an ordinary multiple-choice session, and the arteries do not', () => {
    const set = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, { entitledAreas: AREAS, types: ['mcq'], mode: 'practice', areas: ['knee'], seed: 3 });
    expect(set.some((q) => q.promptKind === 'blood-supply-rating')).toBe(true);
    expect(set.some((q) => q.promptKind === 'blood-supply' || q.promptKind === 'blood-supply-assisting')).toBe(false);
  });
});

describe('artery grading is exact', () => {
  const slot = (name: string) => ({ label: 'Artery', accepted: acceptedVariantsFor('blood-supply', name), strict: true });

  it('does not let a named branch pass for its parent artery', () => {
    expect(gradeTypedSlots(['radial recurrent artery'], [slot('Radial artery')]).allCorrect).toBe(false);
    expect(gradeTypedSlots(['ulnar recurrent'], [slot('Ulnar artery')]).allCorrect).toBe(false);
    expect(gradeTypedSlots(['posterior tibial recurrent artery'], [slot('Posterior tibial artery')]).allCorrect).toBe(false);
  });

  it('still accepts the artery with or without the word "artery", and a slip of spelling', () => {
    expect(gradeTypedSlots(['radial'], [slot('Radial artery')]).allCorrect).toBe(true);
    expect(gradeTypedSlots(['Radial artery'], [slot('Radial artery')]).allCorrect).toBe(true);
    expect(gradeTypedSlots(['thoracoacromial arterty'], [slot('Thoracoacromial artery (deltoid and acromial branches)')]).allCorrect).toBe(true);
  });
});
