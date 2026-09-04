import { describe, it, expect } from 'vitest';
import {
  ringArea,
  polygonsArea,
  polygonsCentroid,
  douglasPeucker,
  simplifyRing,
} from '../hotspot/polygonGeometry';

const UNIT_SQUARE = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function square(x: number, y: number, size: number): number[][] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
}

function circleRing(cx: number, cy: number, r: number, points: number): number[][] {
  return Array.from({ length: points }, (_, i) => {
    const angle = (2 * Math.PI * i) / points;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

describe('ringArea', () => {
  it('measures the unit square as 1', () => {
    expect(ringArea(UNIT_SQUARE)).toBeCloseTo(1, 10);
  });

  it('is unaffected by winding direction', () => {
    expect(ringArea([...UNIT_SQUARE].reverse())).toBeCloseTo(1, 10);
  });

  it('returns 0 for a degenerate ring with fewer than 3 points', () => {
    expect(ringArea([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('polygonsArea', () => {
  it('sums the area of every part of a multi-part structure', () => {
    // Bilateral muscles genuinely trace as two disjoint components.
    expect(polygonsArea([square(0, 0, 0.1), square(0.5, 0.5, 0.1)])).toBeCloseTo(0.02, 10);
  });
});

describe('polygonsCentroid', () => {
  it('returns the centre of a single square', () => {
    expect(polygonsCentroid([square(0.2, 0.2, 0.4)])).toEqual([
      expect.closeTo(0.4, 10),
      expect.closeTo(0.4, 10),
    ]);
  });

  it('returns the midpoint between two equal disjoint parts', () => {
    const [x, y] = polygonsCentroid([square(0, 0, 0.2), square(0.8, 0.8, 0.2)]);
    expect(x).toBeCloseTo(0.5, 10);
    expect(y).toBeCloseTo(0.5, 10);
  });

  it('weights by area rather than by vertex count', () => {
    // An L-shape traced as one ring. The area-weighted centroid sits at
    // (5/6, 5/6) of the unit L; a naive mean of the six vertices would give
    // (0.833, 0.833) vs vertex-mean (1, 1) — this is exactly where a
    // vertex-average implementation drifts out of the shape.
    const lShape = [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ];
    const [x, y] = polygonsCentroid([lShape]);
    expect(x).toBeCloseTo(5 / 6, 10);
    expect(y).toBeCloseTo(5 / 6, 10);
  });
});

describe('douglasPeucker', () => {
  it('reduces a straight run of collinear points to its two endpoints', () => {
    const line = Array.from({ length: 100 }, (_, i) => [i / 99, 0]);
    expect(douglasPeucker(line, 0.001)).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it('keeps every point when epsilon is 0', () => {
    const zigzag = [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ];
    expect(douglasPeucker(zigzag, 0)).toEqual(zigzag);
  });

  it('drops midpoints that lie on the line between the corners they sit between', () => {
    const withMidpoints = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 1],
    ];
    expect(douglasPeucker(withMidpoints, 0.01)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });
});

describe('simplifyRing', () => {
  it('reduces a finely sampled circle while preserving its area', () => {
    const ring = circleRing(0.5, 0.5, 0.25, 200);
    const simplified = simplifyRing(ring, { epsilon: 0.002, maxVertices: 150 });

    expect(simplified.length).toBeLessThan(60);
    expect(ringArea(simplified)).toBeCloseTo(ringArea(ring), 2);
  });

  it('respects maxVertices by raising epsilon until the budget is met', () => {
    const ring = circleRing(0.5, 0.5, 0.4, 500);
    const simplified = simplifyRing(ring, { epsilon: 0.0001, maxVertices: 24 });

    expect(simplified.length).toBeLessThanOrEqual(24);
  });

  it('leaves a ring already under minVertices untouched', () => {
    const triangle = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    expect(simplifyRing(triangle, { epsilon: 0.5 })).toEqual(triangle);
  });
});
