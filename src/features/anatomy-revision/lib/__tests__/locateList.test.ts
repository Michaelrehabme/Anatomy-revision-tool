import { describe, expect, it } from 'vitest';
import { ALL_IMAGES, ALL_STRUCTURES, AUTHORED_STRUCTURES } from '../../data/seed';
import { STRUCTURE_INDEX } from '../../data/structureIndex';
import { buildStructureIndex } from '../../data/content/split';
import { linkImages } from '../linkImages';
import { buildLocateQuestions } from '../questionGenerators/locate';
import { buildLocateList, MIN_LIST_NAMES } from '../questionGenerators/locateList';
import { buildLocateRoutes } from '../locateRoutes';
import { areasOf } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { LocateQuestion } from '../../types/question';

/**
 * THE LIST OF NAMES, over every locate question (docs/accessibility-locate.md,
 * option A). 212 of them used to offer a list of one name — the answer. The
 * rule now is that no list is shorter than four, and it is enforced here
 * against all of them rather than trusted to the generator.
 */

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
const locate = buildLocateQuestions(ALL_STRUCTURES, ALL_IMAGES);

const framesOf = (q: LocateQuestion): AnatomyImageAsset[] => [
  imagesById.get(q.imageId)!,
  ...(q.frameImageIds ?? []).map((id) => imagesById.get(id)!),
];
/** What the list was before: every structure any frame carries a hotspot for. */
const onPlate = (q: LocateQuestion) => [...new Set(framesOf(q).flatMap((f) => (f.hotspots ?? []).map((h) => h.structureId)))].filter((id) => byId.has(id));

const lists = locate.map((q) => ({ q, list: buildLocateList(q, framesOf(q), STRUCTURE_INDEX) }));

describe('the list of names a locate question falls back to', () => {
  it('was one name long on 212 of the 595 questions, and under four on 246', () => {
    const sizes = locate.map((q) => onPlate(q).length);
    expect(locate).toHaveLength(595);
    expect(sizes.filter((n) => n === 1)).toHaveLength(212);
    expect(sizes.filter((n) => n < MIN_LIST_NAMES)).toHaveLength(246);
  });

  it('is never shorter than four now, on any locate question', () => {
    expect(MIN_LIST_NAMES).toBe(4);
    const short = lists.filter(({ list }) => list.length < MIN_LIST_NAMES).map(({ q }) => q.id);
    expect(short).toEqual([]);
  });

  it('always holds the answer, once, among names that all differ', () => {
    for (const { q, list } of lists) {
      expect(list.filter((s) => s.id === q.targetStructureId), q.id).toHaveLength(1);
      expect(new Set(list.map((s) => s.name.replace(/ \(grouped\)$/, '').toLowerCase())).size, q.id).toBe(list.length);
    }
  });

  it('is in name order', () => {
    for (const { list } of lists) {
      const names = list.map((s) => s.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('leaves a plate that already shows four or more exactly as it was', () => {
    for (const { q, list } of lists) {
      const before = onPlate(q);
      if (before.length < MIN_LIST_NAMES) continue;
      expect(list.map((s) => s.id).sort()).toEqual([...before].sort());
    }
  });

  it('makes a short list up to exactly four, with the asked structure\'s own category, nearest first', () => {
    let sameArea = 0;
    let added = 0;
    for (const { q, list } of lists) {
      const before = new Set(onPlate(q));
      if (before.size >= MIN_LIST_NAMES) continue;
      expect(list, q.id).toHaveLength(MIN_LIST_NAMES);
      const target = byId.get(q.targetStructureId)!;
      const areas = areasOf(target);
      for (const s of list) {
        if (before.has(s.id)) continue;
        added += 1;
        expect(s.category, q.id).toBe(target.category);
        if (areasOf(s).some((a) => areas.includes(a))) sameArea += 1;
      }
    }
    // The asked structure's area supplies nearly all of them; a category with
    // too few in the area (two bones at the hip) reaches into the region.
    expect(added).toBeGreaterThan(600);
    expect(sameArea / added).toBeGreaterThan(0.9);
  });

  it('does not put the answer in a place a student could learn', () => {
    // Where the answer falls in a four-name list, over the 246 made-up lists.
    const position = [0, 0, 0, 0];
    let padded = 0;
    for (const { q, list } of lists) {
      if (onPlate(q).length >= MIN_LIST_NAMES) continue;
      padded += 1;
      position[list.findIndex((s) => s.id === q.targetStructureId)] += 1;
    }
    expect(padded).toBe(246);
    for (const count of position) {
      expect(count / padded).toBeGreaterThan(0.12);
      expect(count / padded).toBeLessThan(0.4);
    }
  });

  it('offers the same list each time the question is asked', () => {
    for (const { q, list } of lists.slice(0, 150)) {
      expect(buildLocateList(q, framesOf(q), STRUCTURE_INDEX).map((s) => s.id)).toEqual(list.map((s) => s.id));
    }
  });

  it('needs no facts: it is built from the bundled index alone', () => {
    const index = linkImages(JSON.parse(JSON.stringify(buildStructureIndex(AUTHORED_STRUCTURES))), ALL_IMAGES);
    for (const { q, list } of lists) {
      expect(buildLocateList(q, framesOf(q), index).map((s) => s.id)).toEqual(list.map((s) => s.id));
    }
  });
});

describe('the two routes together', () => {
  const structuresById = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));

  it('every locate question can be answered without its picture: in words, or from a list of at least four', () => {
    let inWords = 0;
    for (const q of locate) {
      const routes = buildLocateRoutes(q, framesOf(q), structuresById, STRUCTURE_INDEX);
      if (routes.described) {
        inWords += 1;
        expect(routes.describedAnswer).toBe(routes.described.choices[routes.described.correctIndex]);
      } else {
        expect(routes.describedAnswer).toBeNull();
      }
      expect(routes.list.length, q.id).toBeGreaterThanOrEqual(MIN_LIST_NAMES);
    }
    expect(inWords).toBe(574);
  });
});
