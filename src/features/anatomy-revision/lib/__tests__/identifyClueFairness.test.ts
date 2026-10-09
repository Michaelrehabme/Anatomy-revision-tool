import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES, ALL_IMAGES } from '../../data/seed';
import { areasOf, isLigament, isMuscle } from '../../types/structure';
import { buildIdentifyClue, clueAlsoFits } from '../facts';
import { buildIndexes } from '../indexes';
import { createRng } from '../rng';
import { buildMcqQuestions } from '../questionGenerators/mcq';
import { buildMultiSelectQuestions } from '../questionGenerators/multiSelect';
import { buildClinicalQuestions } from '../questionGenerators/clinical';
import { buildFillBlankQuestions } from '../questionGenerators/fillBlank';

/**
 * Found on a phone, 8 Oct 2026: "Name the structure: attaches to: pelvis" over
 * four ligaments of the pelvis, and "Ligament of head of femur" offered beside
 * "Ligament of the Head of the Femur". The first was a clue true of several
 * answers; the second was one ligament held as two structures.
 */
const label = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

describe('one structure, one name', () => {
  it('holds no two structures whose names or aliases differ only by an article, case or punctuation', () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of ALL_STRUCTURES) {
      for (const key of new Set([s.name, ...s.aliases].map(label))) {
        const other = owners.get(key);
        if (other && other !== s.id) clashes.push(`${other} / ${s.id}: "${key}"`);
        owners.set(key, s.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('writes "of the" into no name, so the same phrase is never spelt two ways', () => {
    expect(ALL_STRUCTURES.filter((s) => /\bof the\b/i.test(s.name)).map((s) => s.name)).toEqual([]);
  });

  it('writes every ligament name in sentence case', () => {
    const capitalised = ALL_STRUCTURES.filter(isLigament).filter((s) => /[\s-][A-Z][a-z]/.test(s.name.replace(/\(.*\)/, '')));
    expect(capitalised.map((s) => s.name)).toEqual([]);
  });
});

describe('a clue question has one right answer', () => {
  const byName = new Map(ALL_STRUCTURES.map((s) => [s.name, s]));
  const areas = [...new Set(ALL_STRUCTURES.flatMap((s) => areasOf(s)))];

  it.each(areas)('offers no wrong answer the clue also describes: %s', (area) => {
    const pool = ALL_STRUCTURES.filter((s) => areasOf(s).includes(area));
    const indexes = buildIndexes(pool);
    for (let seed = 1; seed <= 5; seed++) {
      const questions = buildMcqQuestions(pool, ALL_IMAGES, indexes, createRng(seed), { promptKinds: ['identify'] });
      for (const q of questions.filter((q) => q.id.endsWith('-identify-text'))) {
        const right = byName.get(q.choices[q.correctIndex])!;
        const alsoRight = q.choices.filter((c, i) => i !== q.correctIndex && clueAlsoFits(right, byName.get(c)!));
        expect(alsoRight, q.prompt).toEqual([]);
      }
    }
  });

  it('does not ask a ligament by a bone list its neighbours share', () => {
    const hip = ALL_STRUCTURES.filter((s) => areasOf(s).includes('hip'));
    const questions = buildMcqQuestions(hip, ALL_IMAGES, buildIndexes(hip), createRng(1), { promptKinds: ['identify'] });
    expect(questions.some((q) => q.prompt === 'Name the structure: attaches to: pelvis')).toBe(false);
    // Still asked, from its pictures.
    expect(questions.some((q) => q.id.startsWith('mcq-inferior-pubic-ligament-identify-image-'))).toBe(true);
  });

  it('describes where a ligament runs rather than listing its bones', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    expect(buildIdentifyClue(byId.get('transverse-acetabular-ligament')!)).toMatch(/^Bridges the acetabular notch/);
    // One sentence, not the whole description.
    expect(buildIdentifyClue(byId.get('ischiofemoral-ligament')!)).not.toContain('It limits');
  });

  it('counts a ligament reaching the same bones, in any order or among others, as fitting a bone-list clue', () => {
    const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
    const inferiorPubic = byId.get('inferior-pubic-ligament')!;
    expect(buildIdentifyClue(inferiorPubic)).toBe('attaches to: pelvis');
    expect(clueAlsoFits(inferiorPubic, byId.get('obturator-membrane')!)).toBe(true);
    expect(clueAlsoFits(inferiorPubic, byId.get('sacrotuberous-ligament')!)).toBe(true);
    expect(clueAlsoFits(inferiorPubic, byId.get('anterior-cruciate-ligament')!)).toBe(false);
  });
});

/**
 * The same fault in the questions about facts, found by sweeping every
 * generator the day the ligament ones were fixed.
 */
describe('a fact question has no second right answer either', () => {
  const byName = new Map(ALL_STRUCTURES.map((s) => [s.name, s]));
  const indexes = buildIndexes(ALL_STRUCTURES);

  it('asks for a nerve by its name, never by which part of a muscle it reaches', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const questions = buildMcqQuestions(ALL_STRUCTURES, ALL_IMAGES, indexes, createRng(seed), { promptKinds: ['nerve'] });
      expect(questions.length).toBeGreaterThan(100);
      for (const q of questions) {
        expect(q.choices.filter((c) => /\((?:long|short|adductor|hamstring|lateral|medial|1st|2nd)/i.test(c)), q.prompt).toEqual([]);
        expect(new Set(q.choices).size, q.prompt).toBe(q.choices.length);
      }
    }
  });

  it('never marks a muscle wrong for a nerve that supplies part of it', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of buildMultiSelectQuestions(ALL_STRUCTURES, indexes, createRng(seed))) {
        if (!q.id.startsWith('multiselect-nerve-')) continue;
        const nerve = q.prompt.replace('Select ALL muscles innervated by the ', '').replace(/\.$/, '').toLowerCase();
        const wrong = q.choices.filter((_, i) => !q.correctIndices.includes(i));
        for (const name of wrong) {
          const muscle = byName.get(name)!;
          const supplied = isMuscle(muscle) && muscle.nerve.some((n) => n.name.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim() === nerve);
          expect(supplied, `${name} offered as a wrong answer to: ${q.prompt}`).toBe(false);
        }
      }
    }
  });

  it("does not offer a structure's other special test as a wrong answer", () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of buildClinicalQuestions(ALL_STRUCTURES, createRng(seed))) {
        if (q.promptKind !== 'special-test') continue;
        const own = ALL_STRUCTURES.find((s) => s.id === q.structureId)!.specialTests!.map((t) => t.name);
        expect(q.choices.filter((c, i) => i !== q.correctIndex && own.includes(c)), q.prompt).toEqual([]);
      }
    }
  });

  it('does not offer one of a muscle\'s own sites as a wrong origin or insertion', () => {
    const questions = buildMcqQuestions(ALL_STRUCTURES, ALL_IMAGES, indexes, createRng(2), { promptKinds: ['origin', 'insertion'] });
    const adductorMagnus = questions.find((q) => q.id === 'mcq-adductor-magnus-insertion')!;
    expect(adductorMagnus.choices.filter((c, i) => i !== adductorMagnus.correctIndex && /linea aspera/i.test(c))).toEqual([]);
  });
});

describe('a fill-in-the-blank says what it is about', () => {
  const questions = buildFillBlankQuestions(ALL_STRUCTURES, createRng(1));

  it('names the bone or landmark every sentence was written on', () => {
    expect(questions.length).toBeGreaterThan(250);
    for (const q of questions) expect(q.subject, q.id).toBeTruthy();
  });

  it('asks one sentence once, with a box for each thing that fills it', () => {
    const trochanter = questions.filter((q) => q.structureId === 'greater-trochanter' && q.after.trim() === 'insertion');
    expect(trochanter).toHaveLength(1);
    expect(trochanter[0].answers).toEqual(['Gluteus medius', 'Gluteus minimus', 'Piriformis']);
    // And no two questions on one structure read the same.
    const seen = new Set<string>();
    for (const q of questions) {
      const key = `${q.structureId}|${q.before.trim()}|${q.after.trim()}`.toLowerCase();
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('does not blank a word the name above it supplies', () => {
    expect(questions.filter((q) => q.structureId === 'deltoid-tuberosity' && q.answer === 'Deltoid')).toEqual([]);
  });
});
