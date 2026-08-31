import { describe, it, expect } from 'vitest';
import { ringArea, polygonSetArea, polygonSetCentroid, ringSelfIntersects, validateHotspot } from '../polygonMath';

const SQUARE = [
  [0.1, 0.1],
  [0.5, 0.1],
  [0.5, 0.5],
  [0.1, 0.5],
];

const BOWTIE = [
  [0.1, 0.1],
  [0.5, 0.5],
  [0.5, 0.1],
  [0.1, 0.5],
];

describe('ringArea', () => {
  it('computes the area of a simple square', () => {
    expect(ringArea(SQUARE)).toBeCloseTo(0.16, 5);
  });

  it('returns 0 for fewer than 3 vertices', () => {
    expect(ringArea([[0.1, 0.1], [0.2, 0.2]])).toBe(0);
  });
});

describe('polygonSetArea', () => {
  it('sums areas across multiple rings', () => {
    expect(polygonSetArea([SQUARE, SQUARE])).toBeCloseTo(0.32, 5);
  });
});

describe('polygonSetCentroid', () => {
  it('averages every vertex across every ring', () => {
    const [cx, cy] = polygonSetCentroid([SQUARE]);
    expect(cx).toBeCloseTo(0.3, 5);
    expect(cy).toBeCloseTo(0.3, 5);
  });

  it('returns [0,0] for no points', () => {
    expect(polygonSetCentroid([])).toEqual([0, 0]);
  });
});

describe('ringSelfIntersects', () => {
  it('returns false for a simple convex ring', () => {
    expect(ringSelfIntersects(SQUARE)).toBe(false);
  });

  it('returns true for a bowtie-shaped ring', () => {
    expect(ringSelfIntersects(BOWTIE)).toBe(true);
  });

  it('returns false for fewer than 4 vertices (a triangle can never self-intersect)', () => {
    expect(ringSelfIntersects([[0, 0], [1, 0], [0.5, 1]])).toBe(false);
  });
});

describe('validateHotspot', () => {
  it('returns no warnings for a clean, unique polygon', () => {
    const warnings = validateHotspot({ structureId: 'deltoid', polygons: [SQUARE] }, []);
    expect(warnings).toEqual([]);
  });

  it('flags fewer than 3 vertices', () => {
    const warnings = validateHotspot({ structureId: 'deltoid', polygons: [[[0.1, 0.1], [0.2, 0.2]]] }, []);
    expect(warnings.some((w) => w.includes('fewer than 3'))).toBe(true);
  });

  it('flags a self-intersecting ring', () => {
    const warnings = validateHotspot({ structureId: 'deltoid', polygons: [BOWTIE] }, []);
    expect(warnings.some((w) => w.includes('cross'))).toBe(true);
  });

  it('flags out-of-bounds coordinates', () => {
    const warnings = validateHotspot({ structureId: 'deltoid', polygons: [[[-0.1, 0.1], [0.5, 0.1], [0.5, 0.5]]] }, []);
    expect(warnings.some((w) => w.includes('outside the image bounds'))).toBe(true);
  });

  it('flags a structure that already has a polygon on this image', () => {
    const warnings = validateHotspot(
      { structureId: 'deltoid', polygons: [SQUARE] },
      [{ structureId: 'deltoid', polygons: [SQUARE] }],
    );
    expect(warnings.some((w) => w.includes('already has a polygon'))).toBe(true);
  });
});
