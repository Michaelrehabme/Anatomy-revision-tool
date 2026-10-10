import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES, AUTHORED_STRUCTURES } from '../../data/seed';
import { buildAreaFacts, buildStructureIndex, joinLoadedAreas } from '../../data/content/split';
import { linkImages } from '../linkImages';
import { describePlate } from '../plateDescription';
import { buildLocateQuestions } from '../questionGenerators/locate';
import {
  createDescribedRegionBuilder,
  isDescribedRegionQuestion,
  isPluralName,
  type DescribedRegionGap,
  type DescribedRegionQuestion,
} from '../questionGenerators/describedRegion';
import { AREAS } from '../../types/region';
import {
  areasOf,
  isBone,
  isJoint,
  isLandmark,
  isLigament,
  isMuscle,
  reviewedAttachmentIds,
  type AnatomyStructure,
} from '../../types/structure';

/**
 * THE DESCRIBED-REGION QUESTION, HELD TO THE SEED over every locate question
 * the app can ask (docs/accessibility-locate.md, option B).
 *
 * The generator's promises are that it invents nothing, that the right option
 * is the only true one, that an option cannot be picked out by its shape, and
 * that the structure's own name does not hand over the answer. None of those
 * can be trusted to a few examples: they are checked here against all of
 * them, by reading each option back into the seed independently of the code
 * that wrote it.
 */

const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const locate = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);
const builder = createDescribedRegionBuilder({ loaded: ALL_STRUCTURES });
const results = locate.map((q) => ({ q, built: builder.build(q) }));
const built = results.filter((r): r is { q: (typeof locate)[number]; built: DescribedRegionQuestion } => isDescribedRegionQuestion(r.built));
const gaps = results.filter((r) => !isDescribedRegionQuestion(r.built));

const plain = (name: string) => name.replace(/ \(grouped\)$/, '');
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * "Origin: a; b. Insertion: c." read back into its labels and what stands
 * under each. Left as one string per label: a seed value may itself contain
 * "; ", so splitting on it would not give the values back.
 */
function parse(option: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const m of option.matchAll(/(Origin|Insertion|Attaches to|Part of|Attached here|Articulates|Formed by|Articulations): (.*?)\.(?= (?:Origin|Insertion|Attaches to|Part of|Attached here|Articulates|Formed by|Articulations): |$)/g)) {
    parts.set(m[1], m[2]);
  }
  return parts;
}

/** The structures of a category whose seed values, under these labels, print as exactly this option. */
function sourcesOf(option: string, pool: readonly AnatomyStructure[]): AnatomyStructure[] {
  const said = parse(option);
  return pool.filter((s) => {
    const seed = seedValues(s);
    return [...said].every(([label, text]) => (seed.get(label) ?? []).join('; ') === text);
  });
}

/** Everything the seed holds under each label for a structure, as the generator would print it. */
function seedValues(s: AnatomyStructure): Map<string, string[]> {
  const clean = (values: readonly string[]) => values.map((v) => v.trim().replace(/\.$/, ''));
  const names = (ids: readonly string[]) => ids.map((id) => plain(byId.get(id)!.name));
  const out = new Map<string, string[]>();
  if (isMuscle(s)) {
    out.set('Origin', clean(s.origin));
    out.set('Insertion', clean(s.insertion));
  } else if (isLigament(s)) out.set('Attaches to', names(reviewedAttachmentIds(s)));
  else if (isLandmark(s)) {
    out.set('Part of', s.parentBoneId ? names([s.parentBoneId]) : []);
    out.set('Attached here', clean(s.attachments));
    out.set('Articulates', clean(s.articulations ?? []));
  } else if (isJoint(s)) out.set('Formed by', names(s.articulatingStructureIds));
  else if (isBone(s)) out.set('Articulations', clean(s.articulations));
  return out;
}

describe('described-region questions: coverage', () => {
  it('covers 574 of the 595 locate questions, in every family', () => {
    expect(locate).toHaveLength(595);
    expect(built).toHaveLength(574);
    const perCategory = (rows: { q: { category: string } }[]) =>
      Object.fromEntries(['muscle', 'ligament', 'landmark', 'joint', 'bone'].map((c) => [c, rows.filter((r) => r.q.category === c).length]));
    expect(perCategory(results)).toEqual({ muscle: 124, ligament: 151, landmark: 202, joint: 34, bone: 84 });
    expect(perCategory(built)).toEqual({ muscle: 124, ligament: 149, landmark: 192, joint: 34, bone: 75 });
  });

  it('and the twenty-one it does not are these, each for a reason the list route then covers', () => {
    const why = new Map<string, DescribedRegionGap>();
    for (const { q, built: reason } of gaps) why.set(q.targetStructureId, reason as DescribedRegionGap);
    expect(Object.fromEntries([...why].sort(([a], [b]) => a.localeCompare(b)))).toEqual({
      // The seed holds no attachment for it at all.
      'external-intercostal-membrane': 'no-data',
      pedicle: 'no-data',
      // All the seed holds is in the name: "Neck of Fibula" is part of the fibula.
      'glenoid-labrum': 'name-gives-it-away',
      'intervertebral-disc': 'name-gives-it-away',
      'neck-of-fibula': 'name-gives-it-away',
      'phalanges-distal-foot': 'name-gives-it-away',
      'phalanges-distal-hand': 'name-gives-it-away',
      'phalanges-middle-foot': 'name-gives-it-away',
      'phalanges-middle-hand': 'name-gives-it-away',
      'surgical-neck-humerus': 'name-gives-it-away',
      'vertebral-body': 'name-gives-it-away',
    });
    expect(gaps).toHaveLength(21);
  });
});

describe('described-region questions and the long description of the plate', () => {
  const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
  const structuresById = byId;

  it('while the question is open, the description gives none of what the words ask for', () => {
    for (const q of locate) {
      const open = describePlate({ image: imagesById.get(q.imageId)!, subjectId: q.targetStructureId, conceal: 'place', imagesById, structuresById });
      expect(open, q.id).not.toMatch(/Origin:|Insertion:|It attaches to|Attached here:|Articulates:|It forms:|formed by|It is part of/);
    }
  });

  it('once answered, it says everything the right option said', () => {
    for (const { q, built: b } of built) {
      const full = describePlate({ image: imagesById.get(q.imageId)!, subjectId: q.targetStructureId, imagesById, structuresById }).toLowerCase();
      const seed = seedValues(byId.get(b.structureId)!);
      for (const [label, text] of parse(b.choices[b.correctIndex])) {
        for (const value of seed.get(label) ?? []) {
          if (text.includes(value)) expect(full, `${q.id}: ${value}`).toContain(value.toLowerCase());
        }
      }
    }
  });
});

describe('described-region questions: every one of them', () => {
  it('has four different options and says which is right', () => {
    for (const { built: b } of built) {
      expect(b.choices, b.locateQuestionId).toHaveLength(4);
      expect(new Set(b.choices).size, b.locateQuestionId).toBe(4);
      expect(b.correctIndex).toBeGreaterThanOrEqual(0);
      expect(b.correctIndex).toBeLessThan(4);
      expect(builder.describe(b.structureId)).toBe(b.choices[b.correctIndex]);
    }
  });

  it('asks about the structure by name, with a verb that agrees', () => {
    for (const { built: b } of built) {
      const s = byId.get(b.structureId)!;
      const name = plain(s.name);
      const verb = isPluralName(name) ? 'sit' : 'sits';
      expect(b.prompt).toBe(`Which of these describes where ${isMuscle(s) ? '' : 'the '}${name} ${verb}?`);
    }
    expect(isPluralName('Dorsal intercarpal ligaments')).toBe(true);
    expect(isPluralName('Thoracic Vertebrae (T1–T12)')).toBe(true);
    expect(isPluralName('Lumbricals (Hand)')).toBe(true);
    // Latin singulars that end in s.
    for (const singular of ['Biceps Brachii', 'Gracilis', 'Pelvis', 'Talus', 'Pubic Symphysis', 'Annular ligament of radius', 'Lateral meniscus']) {
      expect(isPluralName(singular), singular).toBe(false);
    }
  });

  it('states nothing the seed does not hold: every value of the right option is the structure\'s own', () => {
    for (const { built: b } of built) {
      const seed = seedValues(byId.get(b.structureId)!);
      const said = parse(b.choices[b.correctIndex]);
      expect(said.size, b.choices[b.correctIndex]).toBeGreaterThan(0);
      for (const [label, text] of said) {
        // What is printed is the structure's own values, in their order, with
        // at most some left out (the ones its name would give away).
        const kept = (seed.get(label) ?? []).filter((value) => text.includes(value));
        expect(kept.join('; '), `${b.structureId} ${label}`).toBe(text);
      }
    }
  });

  it('and every wrong option is, whole, another structure of the same category\'s own', () => {
    // Each wrong option must be exactly what the seed holds for SOME structure
    // under the labels shown — not a mixture, and not an edit.
    for (const { q, built: b } of built) {
      const labels = [...parse(b.choices[b.correctIndex]).keys()];
      const others = ALL_STRUCTURES.filter((s) => s.category === q.category && s.id !== b.structureId);
      b.choices.forEach((choice, i) => {
        if (i === b.correctIndex) return;
        expect([...parse(choice).keys()], choice).toEqual(labels);
        expect(sourcesOf(choice, others).length, `${b.structureId}: "${choice}" is not any structure's own description`).toBeGreaterThan(0);
      });
    }
  });

  it('no wrong option is true of the asked structure', () => {
    for (const { q, built: b } of built) {
      const seed = seedValues(byId.get(b.structureId)!);
      const labels = [...parse(b.choices[b.correctIndex]).keys()];
      const others = ALL_STRUCTURES.filter((s) => s.category === q.category && s.id !== b.structureId);
      b.choices.forEach((choice, i) => {
        if (i === b.correctIndex) return;
        // True of it would mean: every value under every label shown is one of its own.
        for (const source of sourcesOf(choice, others)) {
          const theirs = seedValues(source);
          const allTrue = labels.every((label) => {
            const own = (seed.get(label) ?? []).map(norm);
            return (theirs.get(label) ?? []).every((v) => own.some((o) => o === norm(v) || ` ${o} `.includes(` ${norm(v)} `)));
          });
          expect(allTrue, `${b.structureId}: "${choice}" is true of it`).toBe(false);
        }
      });
    }
  });

  it('cannot be answered from the name: no option contains a word that is distinctly the structure\'s', () => {
    // Independently of the generator's own rule: a word of the name that is a
    // structure's whole name (humerus), or that few structures' names carry.
    const wordsOf = (text: string) => norm(text).split(' ').filter((w) => w.length >= 4);
    const counts = new Map<string, number>();
    const whole = new Set<string>();
    for (const s of ALL_STRUCTURES) {
      const own = new Set(wordsOf(plain(s.name)));
      for (const w of own) counts.set(w, (counts.get(w) ?? 0) + 1);
      if (wordsOf(plain(s.name)).length === 1) whole.add(wordsOf(plain(s.name))[0]);
    }
    const leaks: string[] = [];
    for (const { built: b } of built) {
      const name = byId.get(b.structureId)!.name;
      // Bone names are the sharpest case: "Part of: Tibia" under "Medial Condyle of Tibia".
      const telling = wordsOf(name).filter((w) => whole.has(w) && counts.get(w)! > 1);
      for (const choice of b.choices) {
        if (wordsOf(choice).some((w) => telling.includes(w))) leaks.push(`${name}: ${choice}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('cannot be answered by shape: same labels, similar length, and the right one is not the long one', () => {
    let longest = 0;
    let shortest = 0;
    const position = [0, 0, 0, 0];
    for (const { built: b } of built) {
      const own = b.choices[b.correctIndex].length;
      const lengths = b.choices.map((c) => c.length);
      for (const length of lengths) {
        expect(Math.max(length, own) / Math.min(length, own), b.locateQuestionId).toBeLessThanOrEqual(2.6);
      }
      if (lengths.every((l, i) => i === b.correctIndex || l < own)) longest += 1;
      if (lengths.every((l, i) => i === b.correctIndex || l > own)) shortest += 1;
      position[b.correctIndex] += 1;
    }
    // One in four by chance. "Pick the longest" and "pick the shortest" must
    // both do no better than a little over that, and neither be a way to rule
    // an option out.
    expect(longest / built.length).toBeGreaterThan(0.1);
    expect(longest / built.length).toBeLessThan(0.32);
    expect(shortest / built.length).toBeGreaterThan(0.1);
    expect(shortest / built.length).toBeLessThan(0.32);
    // And the right answer is in every position about as often.
    for (const count of position) {
      expect(count / built.length).toBeGreaterThan(0.18);
      expect(count / built.length).toBeLessThan(0.32);
    }
  });

  it('is the same question every time it is built, and does not depend on what was built before it', () => {
    const again = createDescribedRegionBuilder({ loaded: [...ALL_STRUCTURES].reverse() });
    for (const { q, built: b } of built.slice(0, 120)) {
      const second = again.build(q);
      expect(isDescribedRegionQuestion(second) && [...second.choices].sort()).toEqual([...b.choices].sort());
      expect(builder.build(q)).toEqual(b);
    }
  });

  it('never offers the attachments of a ligament nobody has reviewed', () => {
    const unreviewed: AnatomyStructure[] = ALL_STRUCTURES.map((s) => (s.id === 'coracohumeral-ligament' ? { ...s, needsReview: true } : s));
    const cautious = createDescribedRegionBuilder({ loaded: unreviewed });
    expect(cautious.build({ id: 'x', targetStructureId: 'coracohumeral-ligament' })).toBe('no-data');
    expect(cautious.describe('coracohumeral-ligament')).toBeNull();
  });
});

describe('described-region questions: from one area\'s facts', () => {
  // The app as it will be once facts are served per area
  // (docs/CONTENT-SERVER-STATUS.md): the bundled index, and one area's payload
  // joined back on, all passed through JSON so nothing is shared by reference.
  const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const index = linkImages(wire(buildStructureIndex(AUTHORED_STRUCTURES)), ALL_IMAGES);
  const areaFacts = wire(buildAreaFacts(AUTHORED_STRUCTURES));

  it('builds from the loaded area alone, and never describes a structure that is not loaded', () => {
    let total = 0;
    let covered = 0;
    for (const area of AREAS) {
      const loaded = joinLoadedAreas(index, [areaFacts[area]]);
      const loadedIds = new Set(loaded.map((s) => s.id));
      const oneArea = createDescribedRegionBuilder({ loaded, index });
      for (const q of locate) {
        if (!areasOf(byId.get(q.targetStructureId)!).includes(area)) continue;
        expect(loadedIds.has(q.targetStructureId)).toBe(true);
        total += 1;
        const b = oneArea.build(q);
        if (!isDescribedRegionQuestion(b)) continue;
        covered += 1;
        b.choices.forEach((choice, i) => {
          if (i === b.correctIndex) return;
          // Every wrong option is the description of a structure in the loaded area.
          expect(sourcesOf(choice, loaded).length, `${area} ${q.targetStructureId}: "${choice}"`).toBeGreaterThan(0);
        });
      }
    }
    // 661 because a structure in two areas is asked in each. Fewer are covered
    // than with everything loaded — an area with two bones cannot supply three
    // wrong descriptions of a bone — and those fall back to the list.
    expect(total).toBe(661);
    expect(covered).toBe(487);
  });

  it('names a bone from another area through the index, with no facts loaded for it', () => {
    // A wrist ligament attaches to the radius, which is an elbow bone.
    const loaded = joinLoadedAreas(index, [areaFacts['wrist-hand']]);
    const oneArea = createDescribedRegionBuilder({ loaded, index });
    const withRadius = loaded.find((s) => isLigament(s) && s.attachmentStructureIds.includes('radius'))!;
    expect(oneArea.describe(withRadius.id)).toContain('Radius');
  });
});
