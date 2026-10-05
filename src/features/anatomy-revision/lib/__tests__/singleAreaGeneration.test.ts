import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES, AUTHORED_STRUCTURES } from '../../data/seed';
import { buildAreaFacts, buildStructureIndex, joinLoadedAreas } from '../../data/content/split';
import { buildVocabulary } from '../../data/content/vocabulary';
import { linkImages } from '../linkImages';
import { generateRevisionSet, type RevisionSetConfig } from '../questionGenerators/generateSet';
import { buildStarterSet } from '../questionGenerators/starterSet';
import { arteriesOf, choiceName, wrongArteries } from '../questionGenerators/bloodSupply';
import type { DistractorSources } from '../questionGenerators/sources';
import { canonicalNerveNames, humanizeActionTag, stripHeadPrefix } from '../oinaValues';
import { createRng } from '../rng';
import { AREAS, type Area } from '../../types/region';
import { areasOf, JOINT_MOVEMENTS, JOINT_TYPE_LABELS, type AnatomyStructure } from '../../types/structure';
import type { QuestionType, RevisionQuestion } from '../../types/question';

/**
 * QUESTIONS FROM ONE AREA'S FACTS
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 4).
 *
 * Once facts are served per area, a free student holds one area and the
 * generators see only that. These tests build exactly that situation from the
 * seed — the bundled index, the vocabulary, and one area's payload joined back
 * on, all passed through JSON so nothing is shared with the seed by reference
 * — for each of the nine areas, and hold the generators to three things:
 *
 *  1. they still ask what they ask today (the count per kind, within 10%);
 *  2. no wrong answer is a fact from an area that was not loaded, unless it
 *     is one of the vocabulary's bare lists;
 *  3. with EVERYTHING loaded the vocabulary changes nothing at all, which is
 *     the state the app is in while the seed is still bundled.
 */

const ALL_TYPES: QuestionType[] = ['flashcard', 'mcq', 'locate', 'fill-blank', 'identify-typed', 'multi-select', 'oina'];

/** JSON's view of a value: what a fetched payload or a bundled file gives the app. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// The index as the app will hold it: cut before linking, linked at load.
const index = linkImages(wire(buildStructureIndex(AUTHORED_STRUCTURES)), ALL_IMAGES);
const vocabulary = wire(buildVocabulary(AUTHORED_STRUCTURES));
const areaFacts = wire(buildAreaFacts(AUTHORED_STRUCTURES));
const sources: DistractorSources = { index, vocabulary };

const loadedFor = (areas: readonly Area[]): AnatomyStructure[] =>
  joinLoadedAreas(index, areas.map((area) => areaFacts[area]));

/** Everything a session in one area can build, learn cards off so the count is questions only. */
const everything = (area: Area, seed = 21): RevisionSetConfig => ({
  types: ALL_TYPES,
  mode: 'practice',
  areas: [area],
  entitledAreas: [area],
  learnCardAttempts: 0,
  seed,
});

const kindOf = (q: RevisionQuestion) => `${q.type}${'format' in q ? `/${q.format}` : ''}:${q.promptKind}`;

function tally(questions: readonly RevisionQuestion[], key: (q: RevisionQuestion) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(key(q), (counts.get(key(q)) ?? 0) + 1);
  return counts;
}

const withAllLoaded = new Map(AREAS.map((area) => [area, generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, everything(area))]));
const withOneLoaded = new Map(
  AREAS.map((area) => [area, generateRevisionSet(loadedFor([area]), ALL_IMAGES, everything(area), sources)]),
);

/** The choices of a question that are not its answer. */
function wrongChoices(q: RevisionQuestion): string[] {
  if (q.type === 'mcq') return q.choices.filter((_, i) => i !== q.correctIndex);
  if (q.type === 'multi-select' || (q.type === 'oina' && q.format === 'select')) {
    return q.choices.filter((_, i) => !q.correctIndices.includes(i));
  }
  return [];
}

/**
 * Every string a question could show that states a FACT of this structure, in
 * each form a generator shows it: joined, head prefix stripped, canonical,
 * humanised. Names are not here — a name is index, and free to appear.
 */
function factStrings(s: AnatomyStructure): string[] {
  const out: string[] = [];
  if (s.category === 'muscle') {
    out.push(s.origin.join('; '), s.insertion.join('; '), s.actionText);
    out.push(...s.origin.map(stripHeadPrefix), ...s.insertion.map(stripHeadPrefix));
    out.push(s.nerve.map((n) => n.name).join('; '), ...s.nerve.map((n) => n.name), ...canonicalNerveNames(s.nerve));
    out.push(...s.actions, ...s.actions.map(humanizeActionTag));
  }
  if (s.category === 'joint') out.push(JOINT_TYPE_LABELS[s.jointType], ...s.movements);
  if (s.category === 'bone' || s.category === 'landmark') out.push(...s.attachments, ...(s.articulations ?? []));
  if (s.myotome?.length) out.push(s.myotome.join('/'));
  if (s.palpationNotes) out.push(s.palpationNotes);
  if (s.functionalContext) out.push(s.functionalContext);
  out.push(...(s.specialTests ?? []).map((t) => t.name));
  out.push(...arteriesOf(s), ...arteriesOf(s).map(choiceName));
  return out.filter(Boolean);
}

/** What the vocabulary can put on screen, in the forms the generators show it. */
const vocabularyStrings = new Set<string>([
  ...vocabulary.nerves,
  ...vocabulary.nerves.flatMap((name) => canonicalNerveNames([{ name, roots: [] }])),
  ...vocabulary.actions,
  ...vocabulary.actions.map(humanizeActionTag),
  // Not a list of facts: the closed set of movements a joint question offers.
  ...JOINT_MOVEMENTS,
  ...Object.values(vocabulary.arteries).flatMap((byRegion) => Object.values(byRegion).flat()).flatMap((a) => [a, choiceName(a)]),
]);
const names = new Set(index.map((e) => e.name));

/** Fact strings that exist ONLY in areas other than the loaded ones, and are in no bundled list. */
function factsNotServed(loadedAreas: readonly Area[]): Set<string> {
  const loaded = new Set(ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => loadedAreas.includes(a))).flatMap(factStrings));
  const out = new Set<string>();
  for (const s of ALL_STRUCTURES) {
    if (areasOf(s).some((a) => loadedAreas.includes(a))) continue;
    for (const text of factStrings(s)) {
      if (!loaded.has(text) && !vocabularyStrings.has(text) && !names.has(text)) out.add(text);
    }
  }
  return out;
}

describe.each(AREAS)('a session built from the %s facts alone', (area) => {
  const full = withAllLoaded.get(area)!;
  const partial = withOneLoaded.get(area)!;

  it('asks about the same structures', () => {
    expect(new Set(partial.map((q) => q.structureId))).toEqual(new Set(full.map((q) => q.structureId)));
  });

  it('builds each format\'s usual count, within 10%', () => {
    const usual = tally(full, (q) => q.type);
    const got = tally(partial, (q) => q.type);
    for (const type of ALL_TYPES) {
      const expected = usual.get(type) ?? 0;
      expect(Math.abs((got.get(type) ?? 0) - expected), `${type}: usually ${expected}, got ${got.get(type) ?? 0}`).toBeLessThanOrEqual(
        expected * 0.1,
      );
    }
    expect(Math.abs(partial.length - full.length)).toBeLessThanOrEqual(full.length * 0.1);
  });

  it('builds each kind of question\'s usual count, within 10%', () => {
    const usual = tally(full, kindOf);
    const got = tally(partial, kindOf);
    expect([...got.keys()].sort()).toEqual([...usual.keys()].sort());
    for (const [kind, expected] of usual) {
      expect(Math.abs((got.get(kind) ?? 0) - expected), `${kind}: usually ${expected}, got ${got.get(kind) ?? 0}`).toBeLessThanOrEqual(
        expected * 0.1,
      );
    }
  });

  it('offers no fact from an area that is not loaded as a wrong answer', () => {
    const notServed = factsNotServed([area]);
    // Guards the detector: an empty set would pass anything.
    expect(notServed.size).toBeGreaterThan(100);
    const leaks = partial.flatMap((q) => wrongChoices(q).filter((c) => notServed.has(c)).map((c) => `${q.id}: ${c}`));
    expect(leaks).toEqual([]);
  });

  it('draws every wrong answer from the loaded facts, the index or the vocabulary', () => {
    const allowed = new Set([...loadedFor([area]).flatMap(factStrings), ...vocabularyStrings, ...names]);
    // The "how rich" scale is a fixed three-point scale, not a fact of anything.
    for (const label of ['Rich', 'Moderate', 'Poor']) allowed.add(label);
    const strays = partial.flatMap((q) => wrongChoices(q).filter((c) => !allowed.has(c)).map((c) => `${q.id}: ${c}`));
    expect(strays).toEqual([]);
  });

  it('still gives every multiple-choice nerve question four choices', () => {
    const nerve = partial.filter((q) => q.type === 'mcq' && q.promptKind === 'nerve');
    expect(nerve.filter((q) => q.type === 'mcq' && q.choices.length < 4).map((q) => q.id)).toEqual([]);
  });

  it('names a ligament\'s bones from the index when the bone is in another area', () => {
    const slots = (questions: readonly RevisionQuestion[]) =>
      questions.flatMap((q) => (q.type === 'identify-typed' ? [`${q.id}:${(q.attachmentSlots ?? []).map((s) => s.accepted[0]).join('|')}`] : []));
    expect(slots(partial).sort()).toEqual(slots(full).sort());
    const attachment = (questions: readonly RevisionQuestion[]) =>
      questions.flatMap((q) =>
        q.type === 'multi-select' && q.promptKind === 'attachment'
          ? [`${q.id}:${q.correctIndices.map((i) => q.choices[i]).sort().join('|')}`]
          : [],
      );
    expect(attachment(partial).sort()).toEqual(attachment(full).sort());
  });

  it('is deterministic under a seed', () => {
    expect(generateRevisionSet(loadedFor([area]), ALL_IMAGES, everything(area), sources)).toEqual(partial);
  });

  it('builds the same starter set', () => {
    const usual = buildStarterSet(ALL_STRUCTURES, ALL_IMAGES, { areas: [area], seed: 3 });
    const got = buildStarterSet(loadedFor([area]), ALL_IMAGES, { areas: [area], seed: 3 }, sources);
    expect(got.length).toBe(usual.length);
    expect(got.map((q) => q.structureId)).toEqual(usual.map((q) => q.structureId));
  });
});

describe('the leak detector itself', () => {
  // With every area loaded the generators DO reach across areas — a hamstring's
  // wrong origins come from its group-mates at the hip. If the detector could
  // not see that, the "no fact from another area" tests above would be
  // passing because they look at nothing.
  it('sees other areas\' facts in a session built with everything loaded', () => {
    const seen = AREAS.filter((area) => {
      const notServed = factsNotServed([area]);
      return withAllLoaded.get(area)!.some((q) => wrongChoices(q).some((c) => notServed.has(c)));
    });
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe('wrong arteries from the vocabulary', () => {
  const withBlood = ALL_STRUCTURES.filter((s) => s.bloodSupply?.primary && s.category !== 'landmark');

  // THE RULE THAT KEEPS THE QUESTION TRUE (bloodSupply.ts): never offer as
  // wrong an artery that a structure sharing an area with the subject lists.
  // Checked against the WHOLE seed, for a student holding one area — which is
  // the case the area-keyed lists exist for: the femur is asked in a knee-only
  // session, and its hip neighbours' arteries must still be ruled out.
  it('never offers an artery that any neighbour of the subject lists, loaded or not', () => {
    const offences: string[] = [];
    let offered = 0;
    for (const subject of withBlood) {
      const neighbours = new Set(
        ALL_STRUCTURES.filter((s) => areasOf(s).some((a) => areasOf(subject).includes(a)))
          .flatMap(arteriesOf)
          .map(choiceName),
      );
      for (const area of areasOf(subject)) {
        const loaded = loadedFor([area]).filter((s) => s.bloodSupply);
        const wrong = wrongArteries(subject, loaded, arteriesOf(subject), createRng(5), vocabulary.arteries);
        offered += wrong.length;
        for (const name of wrong) if (neighbours.has(name)) offences.push(`${subject.id} (${area} loaded): ${name}`);
      }
    }
    expect(offered).toBeGreaterThan(withBlood.length);
    expect(offences).toEqual([]);
  });

  it('finds at least as many as the loaded dataset would', () => {
    const short: string[] = [];
    for (const subject of withBlood) {
      const usual = wrongArteries(subject, ALL_STRUCTURES.filter((s) => s.bloodSupply), arteriesOf(subject), createRng(5));
      const got = wrongArteries(subject, [], arteriesOf(subject), createRng(5), vocabulary.arteries);
      if (Math.min(got.length, 3) < Math.min(usual.length, 3)) short.push(`${subject.id}: ${got.length} against ${usual.length}`);
    }
    expect(short).toEqual([]);
  });
});

describe('with every area loaded', () => {
  const configs: RevisionSetConfig[] = [
    { types: ALL_TYPES, mode: 'practice', entitledAreas: AREAS, learnCardAttempts: 0, seed: 31 },
    { types: ALL_TYPES, mode: 'practice', areas: ['knee'], entitledAreas: AREAS, count: 20, seed: 32 },
    { types: ALL_TYPES, mode: 'assessment', entitledAreas: AREAS, count: 30, seed: 33 },
    { types: ALL_TYPES, mode: 'adaptive', entitledAreas: AREAS, count: 20, seed: 34 },
  ];

  // The state the app is in today. The vocabulary must not be consulted, or a
  // session would differ from the one the same seed built before it existed.
  it.each(configs)('the sources change nothing ($mode, seed $seed)', (config) => {
    const without = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config);
    const withSources = generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config, { index: ALL_STRUCTURES, vocabulary });
    expect(withSources).toEqual(without);
  });

  it('nine areas joined from their payloads build what the seed builds', () => {
    const joined = loadedFor(AREAS);
    expect(joined.length).toBe(ALL_STRUCTURES.length);
    const config = configs[1];
    expect(generateRevisionSet(joined, ALL_IMAGES, config, sources)).toEqual(
      generateRevisionSet(ALL_STRUCTURES, ALL_IMAGES, config),
    );
  });
});
