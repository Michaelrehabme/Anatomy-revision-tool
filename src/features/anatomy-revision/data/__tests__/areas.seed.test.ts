import { describe, it, expect } from 'vitest';
import { ALL_STRUCTURES } from '../seed';
import { areasOf } from '../../types/structure';
import type { Category } from '../../types/structure';
import { AREAS, AREA_LABELS, SPINE_AREAS } from '../../types/region';
import type { Area } from '../../types/region';

/**
 * Seed-integrity checks for the area axis (CR-032, which split Back & Core into the
 * three spine levels). Areas are derived from `subregion` and narrowed by an `areas`
 * override, so nothing in the type system can tell you the sacrum ended up filed
 * under the thoracic spine — only a membership table can.
 */
describe('structure areas', () => {
  const byId = new Map(ALL_STRUCTURES.map((s) => [s.id, s]));
  const areasFor = (id: string) => {
    const structure = byId.get(id);
    expect(structure, `${id} is missing from the seed data`).toBeDefined();
    return areasOf(structure!);
  };

  it('gives every structure at least one area, so none is unreachable from the picker', () => {
    const orphans = ALL_STRUCTURES.filter((s) => areasOf(s).length === 0).map((s) => s.id);
    expect(orphans).toEqual([]);
  });

  it('never authors an empty areas override, which would silently hide a structure', () => {
    const empty = ALL_STRUCTURES.filter((s) => s.areas && s.areas.length === 0).map((s) => s.id);
    expect(empty).toEqual([]);
  });

  it('fills every area the picker offers, for every category', () => {
    const categories: Category[] = ['muscle', 'bone', 'landmark', 'joint'];
    for (const area of AREAS) {
      for (const category of categories) {
        const count = ALL_STRUCTURES.filter((s) => s.category === category && areasOf(s).includes(area)).length;
        expect(count, `no ${category} in ${AREA_LABELS[area]}`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * A vertebral part with no level of its own is studied at every level — asked to
   * point out a pedicle, a student should meet the question in a cervical, thoracic
   * and lumbar session alike. Same for the muscles that run the length of the column.
   */
  it.each([
    'vertebral-body',
    'pedicle',
    'lamina',
    'spinous-process',
    'intervertebral-disc',
    'intervertebral-joint',
    'facet-joint',
    'iliocostalis',
    'multifidus',
    'interspinales',
  ])('puts the level-agnostic %s in all three spine areas', (id) => {
    expect(areasFor(id)).toEqual(SPINE_AREAS);
  });

  it.each([
    'atlas-c1',
    'axis-c2',
    'c7-vertebra',
    'cervical-vertebrae',
    'dens-odontoid-process',
    'atlantoaxial-joint',
    'atlanto-occipital-joint',
    'sternocleidomastoid',
    'scalene-anterior',
    'splenius-capitis',
    'longus-colli',
  ])('files %s under the cervical spine alone', (id) => {
    expect(areasFor(id)).toEqual(['cervical-spine']);
  });

  it.each([
    'thoracic-vertebrae',
    'ribs',
    'sternum',
    'superior-costal-facet',
    'transverse-costal-facet',
    'xiphoid-process',
    'first-rib',
    'costovertebral-joint',
    'sternocostal-joint',
    'diaphragm',
    'external-intercostals',
  ])('files %s under the thoracic spine alone', (id) => {
    expect(areasFor(id)).toEqual(['thoracic-spine']);
  });

  it.each([
    'lumbar-vertebrae',
    'sacrum',
    'coccyx',
    'l4-vertebra',
    'l5-vertebra',
    'l5-s1-junction',
    'pars-interarticularis',
    'sacral-promontory',
    'sacral-hiatus',
    'coccygeal-cornua',
    'rectus-abdominis',
    'quadratus-lumborum',
    'transversus-abdominis',
  ])('files %s under the lumbar spine alone', (id) => {
    expect(areasFor(id)).toEqual(['lumbar-spine']);
  });

  it('keeps the sacroiliac joint with the hip, where it is examined', () => {
    // Anatomically a spine structure; revised as part of the hip/pelvis complex.
    expect(areasFor('sacroiliac-joint')).toEqual(['hip']);
  });

  it('leaves the limbs on exactly one area each', () => {
    const limbAreas: Area[] = ['shoulder', 'elbow', 'wrist-hand', 'hip', 'knee', 'ankle-foot'];
    const spanningLimb = ALL_STRUCTURES.filter(
      (s) => areasOf(s).length > 1 && areasOf(s).some((a) => limbAreas.includes(a)),
    ).map((s) => s.id);
    expect(spanningLimb).toEqual([]);
  });
});
