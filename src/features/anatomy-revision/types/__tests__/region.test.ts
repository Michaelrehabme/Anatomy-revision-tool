import { describe, it, expect } from 'vitest';
import {
  AREAS,
  AREAS_BY_SUBREGION,
  AREA_LABELS,
  SPINE_AREAS,
  SUBREGION_LABELS,
  normaliseAreas,
} from '../region';
import type { SubRegion } from '../region';

/**
 * The Area union is what every picker, filter and persisted preference is keyed
 * on, so these guard the two things the type system cannot: that the lookup
 * tables stay complete as areas are added or split, and that a value persisted
 * before a split still resolves to something (CR-032).
 */
describe('area tables', () => {
  it('labels every area the picker offers', () => {
    for (const area of AREAS) {
      expect(AREA_LABELS[area], `no label for ${area}`).toBeTruthy();
    }
  });

  it('gives every subregion at least one area, so no structure can be unreachable', () => {
    for (const subregion of Object.keys(SUBREGION_LABELS) as SubRegion[]) {
      expect(AREAS_BY_SUBREGION[subregion]?.length, `no areas for ${subregion}`).toBeGreaterThan(0);
    }
  });

  it('derives the trunk subregions down the spine, with the level-agnostic one spanning all three', () => {
    expect(AREAS_BY_SUBREGION.neck).toEqual(['cervical-spine']);
    expect(AREAS_BY_SUBREGION.torso).toEqual(['thoracic-spine']);
    expect(AREAS_BY_SUBREGION.spine).toEqual(SPINE_AREAS);
  });

  it('maps every limb subregion to exactly one area', () => {
    for (const subregion of ['shoulder', 'elbow', 'wrist-hand', 'hip', 'knee', 'ankle-foot'] as SubRegion[]) {
      expect(AREAS_BY_SUBREGION[subregion]).toEqual([subregion]);
    }
  });
});

describe('normaliseAreas', () => {
  it('expands a legacy area into the areas that replaced it', () => {
    expect(normaliseAreas(['back-core'])).toEqual(SPINE_AREAS);
  });

  it('keeps the rest of a mixed selection alongside the expansion', () => {
    expect(normaliseAreas(['back-core', 'hip'])).toEqual(['hip', ...SPINE_AREAS]);
  });

  it('returns canonical order without duplicates, however the input was ordered', () => {
    expect(normaliseAreas(['knee', 'shoulder', 'knee'])).toEqual(['shoulder', 'knee']);
    // 'back-core' expands to areas one of which was already picked by hand.
    expect(normaliseAreas(['lumbar-spine', 'back-core'])).toEqual(SPINE_AREAS);
  });

  it('drops anything that is not a real area, and survives junk input', () => {
    expect(normaliseAreas(['hip', 'forearm-hand', 42, null, { hip: true }])).toEqual(['hip']);
    for (const bad of [undefined, null, 'hip', 42, {}, '']) {
      expect(normaliseAreas(bad), JSON.stringify(bad)).toEqual([]);
    }
  });
});
