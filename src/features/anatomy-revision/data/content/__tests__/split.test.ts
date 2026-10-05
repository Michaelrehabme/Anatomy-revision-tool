import { describe, it, expect } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES, AUTHORED_STRUCTURES } from '../../seed';
import { linkImages } from '../../../lib/linkImages';
import { AREAS } from '../../../types/region';
import { areasOf, isHeld } from '../../../types/structure';
import {
  DERIVED_INDEX_FIELDS,
  SERVED_FACT_FIELDS,
  STRUCTURE_FACT_FIELDS,
  STRUCTURE_FACT_FIELDS_NOT_SERVED,
  STRUCTURE_INDEX_FIELDS,
} from '../../../types/structureIndex';
import { requiredFactKinds } from '../../../lib/factMastery';
import { buildAreaFacts, buildStructureIndex, joinFacts, joinLoadedAreas, toFacts, toIndexEntry } from '../split';
import { buildVocabulary } from '../vocabulary';

/**
 * The cut between what is bundled and what is served
 * (docs/DESIGN-CONTENT-BEHIND-SERVER.md, step 3).
 *
 * Three ways it can go wrong, and each is a different kind of bad: a fact
 * left in the index is paid content in the bundle; a fact missing from an
 * area is a question that silently stops being asked; a fact in an area the
 * structure does not belong to is content served to someone who did not pay
 * for it. Run over the whole seed rather than a fixture, because the seed is
 * the thing being cut.
 */

const index = buildStructureIndex(AUTHORED_STRUCTURES);
const areas = buildAreaFacts(AUTHORED_STRUCTURES);

/** JSON's view of a value: what survives being written to a file and read back. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A structure as the app can ever hold it once facts are served: without the fields served to nobody. */
function asServed<T extends object>(structure: T): T {
  const copy = { ...structure } as Record<string, unknown>;
  for (const field of STRUCTURE_FACT_FIELDS_NOT_SERVED) delete copy[field];
  return copy as T;
}

describe('the bundled index', () => {
  it('holds every structure once, in seed order', () => {
    expect(index.map((e) => e.id)).toEqual(AUTHORED_STRUCTURES.map((s) => s.id));
    expect(new Set(index.map((e) => e.id)).size).toBe(index.length);
  });

  it('carries no fact field on any entry', () => {
    const allowed = new Set<string>([...STRUCTURE_INDEX_FIELDS, ...DERIVED_INDEX_FIELDS]);
    const facts = new Set<string>(STRUCTURE_FACT_FIELDS);
    for (const entry of index) {
      const keys = Object.keys(entry);
      expect(keys.filter((k) => facts.has(k)), entry.id).toEqual([]);
      expect(keys.filter((k) => !allowed.has(k)), entry.id).toEqual([]);
    }
  });

  it('carries every index field its structure has, unchanged', () => {
    for (const [i, structure] of AUTHORED_STRUCTURES.entries()) {
      const source = structure as unknown as Record<string, unknown>;
      const entry = index[i] as unknown as Record<string, unknown>;
      for (const field of STRUCTURE_INDEX_FIELDS) {
        expect(entry[field], `${structure.id}.${field}`).toEqual(source[field]);
      }
    }
  });

  // The key check above cannot see a fact smuggled inside an index field. A
  // description is the fact every structure has, is long, and is not the name
  // of anything, so its absence from the written text is a fair canary. (An
  // origin would not be: "Ischial tuberosity" is an origin AND a landmark.)
  it('does not contain the text of any description', () => {
    const text = JSON.stringify(index);
    const leaked = AUTHORED_STRUCTURES.filter((s) => s.description.length > 20 && text.includes(JSON.stringify(s.description)));
    expect(leaked.map((s) => s.id)).toEqual([]);
  });

  it('flags a description without holding it', () => {
    for (const [i, structure] of AUTHORED_STRUCTURES.entries()) {
      expect(index[i].hasDescription, structure.id).toBe(structure.description.length > 0);
    }
  });

  // Mastery levels are worked out for structures whose facts are not on the
  // device (a free account's progress screen, a lapsed subscriber's history,
  // the summary sent to an educator). The index must answer for them exactly
  // as the facts would, or those levels are silently wrong.
  it('says which kinds of fact each structure must be mastered on, exactly as its facts would', () => {
    let withKinds = 0;
    for (const [i, structure] of AUTHORED_STRUCTURES.entries()) {
      const fromFacts = requiredFactKinds(structure);
      expect(index[i].factKinds, structure.id).toEqual(fromFacts);
      // Read back off the entry alone — no facts anywhere near it.
      expect(requiredFactKinds(wire(index[i])), structure.id).toEqual(fromFacts);
      if (fromFacts.length) withKinds += 1;
    }
    expect(withKinds).toBeGreaterThan(200);
  });

  it('names kinds of fact and never a fact: no artery, nerve or origin text', () => {
    const kinds = new Set(index.flatMap((e) => e.factKinds ?? []));
    expect([...kinds].sort()).toEqual(
      ['action', 'blood-supply', 'blood-supply-assisting', 'blood-supply-rating', 'insertion', 'nerve', 'origin'].sort(),
    );
  });

  it('is cut before the pictures are linked, and links to exactly what the app has today', () => {
    // Linked image ids are derived from the images at load; written into the
    // index they were a megabyte. So the index holds the authored ids only...
    expect(index.reduce((n, e) => n + e.imageIds.length, 0)).toBe(
      AUTHORED_STRUCTURES.reduce((n, s) => n + s.imageIds.length, 0),
    );
    // ...and linking it gives every structure the image ids the seed gives it.
    const linked = linkImages(wire(index), ALL_IMAGES);
    expect(linked.map((e) => e.imageIds)).toEqual(ALL_STRUCTURES.map((s) => s.imageIds));
  });
});

describe('the area payloads', () => {
  it('exist for all nine areas', () => {
    expect(Object.keys(areas).sort()).toEqual([...AREAS].sort());
    for (const area of AREAS) expect(areas[area].area).toBe(area);
  });

  it('put every structure in exactly the areas areasOf() gives it', () => {
    for (const structure of AUTHORED_STRUCTURES) {
      const found = AREAS.filter((area) => areas[area].structures.some((f) => f.id === structure.id));
      expect(found, structure.id).toEqual(AREAS.filter((area) => areasOf(structure).includes(area)));
    }
  });

  it('hold a structure once per area, never twice', () => {
    for (const area of AREAS) {
      const ids = areas[area].structures.map((f) => f.id);
      expect(new Set(ids).size, area).toBe(ids.length);
    }
  });

  it('carry every served fact field of every structure, unchanged, in each of its areas', () => {
    let checked = 0;
    for (const structure of AUTHORED_STRUCTURES) {
      const source = structure as unknown as Record<string, unknown>;
      for (const area of areasOf(structure)) {
        const facts = areas[area].structures.find((f) => f.id === structure.id) as Record<string, unknown>;
        for (const field of SERVED_FACT_FIELDS) {
          expect(facts[field], `${area}/${structure.id}.${field}`).toEqual(source[field]);
          if (source[field] !== undefined) checked += 1;
        }
      }
    }
    // Guards the loop itself: a typo that made it compare nothing would pass.
    expect(checked).toBeGreaterThan(AUTHORED_STRUCTURES.length * 3);
  });

  // Decision 4 (docs/CONTENT-SERVER-STATUS.md): the author's notes and the
  // source record are served to nobody, because no screen shows them.
  it('carry no authoring notes and no source record', () => {
    expect([...STRUCTURE_FACT_FIELDS_NOT_SERVED].sort()).toEqual(['notes', 'source']);
    expect(SERVED_FACT_FIELDS.length).toBe(STRUCTURE_FACT_FIELDS.length - STRUCTURE_FACT_FIELDS_NOT_SERVED.length);
    const authored = AUTHORED_STRUCTURES.filter((s) => s.notes || s.source).length;
    expect(authored).toBeGreaterThan(100);
    for (const area of AREAS) {
      for (const facts of areas[area].structures) {
        expect('notes' in facts || 'source' in facts, `${area}/${facts.id}`).toBe(false);
      }
    }
  });

  // `source.grade` is the one thing in those two fields that could ever
  // decide what is asked: a structure graded 'held' must be kept out of
  // questions (isHeld). None is, and nothing calls isHeld. If one appears,
  // a build that loads facts per area would not know — so serve `source`
  // (empty STRUCTURE_FACT_FIELDS_NOT_SERVED) or carry the grade in the index
  // before this is made to pass.
  it('leave out nothing that decides a question: no structure is held', () => {
    expect(AUTHORED_STRUCTURES.filter(isHeld).map((s) => s.id)).toEqual([]);
  });

  it('carry nothing but the id and served fact fields', () => {
    const allowed = new Set<string>(['id', ...SERVED_FACT_FIELDS]);
    for (const area of AREAS) {
      for (const facts of areas[area].structures) {
        expect(Object.keys(facts).filter((k) => !allowed.has(k)), `${area}/${facts.id}`).toEqual([]);
      }
    }
  });

  it('leave no structure without an area to be served from', () => {
    expect(AUTHORED_STRUCTURES.filter((s) => areasOf(s).length === 0).map((s) => s.id)).toEqual([]);
  });
});

describe('joining an entry back to its facts', () => {
  it('gives back every seed structure exactly, less the fields served to nobody, after a trip through JSON', () => {
    for (const structure of AUTHORED_STRUCTURES) {
      const joined = joinFacts(wire(toIndexEntry(structure)), wire(toFacts(structure)));
      expect(joined, structure.id).toEqual(wire(asServed(structure)));
    }
  });

  it('leaves no stand-in field on a joined structure', () => {
    const joined = joinFacts(wire(toIndexEntry(AUTHORED_STRUCTURES[0])), wire(toFacts(AUTHORED_STRUCTURES[0])));
    for (const field of DERIVED_INDEX_FIELDS) expect(field in joined, field).toBe(false);
    expect(requiredFactKinds(joined)).toEqual(requiredFactKinds(AUTHORED_STRUCTURES[0]));
  });

  it('refuses facts that belong to another structure', () => {
    const [a, b] = AUTHORED_STRUCTURES;
    expect(() => joinFacts(toIndexEntry(a), toFacts(b))).toThrow(/was given the facts of/);
  });

  it('rebuilds the whole seed from the index and all nine areas', () => {
    const joined = joinLoadedAreas(wire(index), wire(AREAS.map((area) => areas[area])));
    expect(joined).toEqual(wire(AUTHORED_STRUCTURES.map(asServed)));
  });

  it('gives only the structures of the areas that are loaded, in index order', () => {
    for (const area of AREAS) {
      const joined = joinLoadedAreas(index, [areas[area]]);
      expect(joined.map((s) => s.id), area).toEqual(
        AUTHORED_STRUCTURES.filter((s) => areasOf(s).includes(area)).map((s) => s.id),
      );
    }
  });

  it('joins a structure shared by two loaded areas once', () => {
    const spine = joinLoadedAreas(index, [areas['cervical-spine'], areas['thoracic-spine'], areas['lumbar-spine']]);
    expect(new Set(spine.map((s) => s.id)).size).toBe(spine.length);
  });
});

describe('the distractor vocabulary', () => {
  const vocabulary = buildVocabulary(AUTHORED_STRUCTURES);
  const lists: [string, string[]][] = [
    ['nerves', vocabulary.nerves],
    ['actions', vocabulary.actions],
    ...Object.entries(vocabulary.arteries).flatMap(([area, byRegion]) =>
      Object.entries(byRegion).map(([region, names]): [string, string[]] => [`arteries.${area}.${region}`, names]),
    ),
  ];

  it('is flat lists of strings, sorted and without repeats', () => {
    for (const [name, list] of lists) {
      expect(list.length, name).toBeGreaterThan(0);
      expect(list.every((v) => typeof v === 'string' && v.length > 0), name).toBe(true);
      expect([...new Set(list)], name).toEqual(list);
      expect([...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), name).toEqual(list);
    }
  });

  // "Unkeyed" is the property that makes it safe to bundle: a list of nerves
  // is not a fact, a nerve beside the muscle it supplies is.
  it('names no structure: no id appears as a key or beside a value', () => {
    const text = JSON.stringify(vocabulary);
    const ids = AUTHORED_STRUCTURES.map((s) => s.id).filter((id) => id.includes('-'));
    const actions = new Set(vocabulary.actions);
    // An action tag is kebab-case too, and a few share their spelling with
    // nothing; a structure id that is ALSO an action tag would be a
    // coincidence worth knowing about, so it is not excused here.
    expect(ids.filter((id) => text.includes(`"${id}"`) && !actions.has(id))).toEqual([]);
  });

  it('holds every value a question could want from an area that is not loaded', () => {
    const nerves = new Set(vocabulary.nerves);
    const actionTags = new Set(vocabulary.actions);
    for (const s of AUTHORED_STRUCTURES) {
      if (s.category === 'muscle') {
        for (const n of s.nerve) expect(nerves.has(n.name), `${s.id} nerve`).toBe(true);
        for (const a of s.actions) expect(actionTags.has(a), `${s.id} action`).toBe(true);
      }
      for (const artery of [s.bloodSupply?.primary, ...(s.bloodSupply?.assisting ?? [])]) {
        if (!artery) continue;
        for (const area of areasOf(s)) expect(vocabulary.arteries[area][s.region], `${s.id} artery`).toContain(artery);
      }
    }
  });

  it('lists arteries under every area, and only under areas that have a structure listing them', () => {
    expect(Object.keys(vocabulary.arteries).sort()).toEqual([...AREAS].sort());
    for (const area of AREAS) {
      const listed = new Set(Object.values(vocabulary.arteries[area]).flat());
      const authored = new Set(
        AUTHORED_STRUCTURES.filter((s) => areasOf(s).includes(area)).flatMap((s) => [
          ...(s.bloodSupply?.primary ? [s.bloodSupply.primary] : []),
          ...(s.bloodSupply?.assisting ?? []),
        ]),
      );
      expect([...listed].sort(), area).toEqual([...authored].sort());
    }
  });

  // Decision 5: three lists the design asked for were built and never read.
  it('holds only the lists a generator reads', () => {
    expect(Object.keys(vocabulary).sort()).toEqual(['actions', 'arteries', 'nerves']);
  });

  it('holds no origin, insertion or description', () => {
    const values = new Set(lists.flatMap(([, list]) => list));
    for (const s of AUTHORED_STRUCTURES) {
      expect(values.has(s.description), s.id).toBe(false);
      if (s.category === 'muscle') {
        for (const text of [...s.origin, ...s.insertion, s.actionText]) expect(values.has(text), s.id).toBe(false);
      }
    }
  });
});
