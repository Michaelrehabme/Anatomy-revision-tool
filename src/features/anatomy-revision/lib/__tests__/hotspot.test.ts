import { describe, it, expect } from 'vitest';
import { pointInPolygon, hitTest } from '../hotspot/pointInPolygon';

const SQUARE = [
  [0.1, 0.1],
  [0.5, 0.1],
  [0.5, 0.5],
  [0.1, 0.5],
];

describe('pointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(pointInPolygon([0.3, 0.3], SQUARE)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(pointInPolygon([0.9, 0.9], SQUARE)).toBe(false);
  });

  it('returns false for a point just outside an edge', () => {
    expect(pointInPolygon([0.05, 0.3], SQUARE)).toBe(false);
  });
});

describe('hitTest', () => {
  const BIG = { structureId: 'deltoid', polygons: [SQUARE], area: 0.16 };
  const SMALL = {
    structureId: 'supraspinatus',
    polygons: [
      [
        [0.2, 0.2],
        [0.3, 0.2],
        [0.3, 0.3],
        [0.2, 0.3],
      ],
    ],
    area: 0.01,
  };

  it('resolves to the smallest-area structure when polygons overlap', () => {
    const result = hitTest([0.25, 0.25], [BIG, SMALL]);
    expect(result?.structureId).toBe('supraspinatus');
  });

  it('resolves to the only matching structure when polygons do not overlap at the point', () => {
    const result = hitTest([0.45, 0.45], [BIG, SMALL]);
    expect(result?.structureId).toBe('deltoid');
  });

  it('returns null when no polygon contains the point and tolerance is default', () => {
    const result = hitTest([0.9, 0.9], [BIG, SMALL]);
    expect(result).toBeNull();
  });

  it('falls back to tolerance radius around the centroid when enabled', () => {
    // Just outside the SMALL square's right edge (x=0.3), close enough to
    // its centroid (0.25, 0.25) to fall within a 3x tolerance radius.
    const result = hitTest([0.32, 0.25], [SMALL], 3);
    expect(result?.structureId).toBe('supraspinatus');
  });
});
