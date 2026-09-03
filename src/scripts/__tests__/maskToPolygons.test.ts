import { describe, it, expect } from 'vitest';
import { binariseAlpha, maskToPolygons, subtractOccluders } from '../lib/maskToPolygons';
import { hitTest } from '../../features/anatomy-revision/lib/hotspot/pointInPolygon';

const W = 100;
const H = 100;

function blank(): Uint8Array {
  return new Uint8Array(W * H);
}

function fillRect(mask: Uint8Array, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) mask[y * W + x] = 1;
  }
  return mask;
}

/** Tracing options tuned for these small synthetic shapes. */
const OPTS = { minComponentPx: 20, epsilon: 1, maxVertices: 60 };

describe('binariseAlpha', () => {
  it('treats alpha above the threshold as foreground and everything else as background', () => {
    const rgba = Buffer.alloc(4 * 4);
    rgba[3] = 0; // fully transparent
    rgba[7] = 128; // exactly at the threshold — excluded
    rgba[11] = 129;
    rgba[15] = 255;

    expect(Array.from(binariseAlpha(rgba, 2, 2))).toEqual([0, 0, 1, 1]);
  });
});

describe('maskToPolygons', () => {
  it('traces a single filled square as one part with the right area and centroid', () => {
    const mask = fillRect(blank(), 25, 25, 75, 75);
    const result = maskToPolygons(mask, W, H, OPTS);

    expect(result.polygons).toHaveLength(1);
    expect(result.area).toBeCloseTo(0.25, 1);
    expect(result.centroid[0]).toBeCloseTo(0.5, 1);
    expect(result.centroid[1]).toBeCloseTo(0.5, 1);
  });

  it('emits one polygon per disconnected component', () => {
    // Bilateral muscles trace this way for real — supraspinatus is two
    // near-equal components in the source corpus.
    const mask = fillRect(blank(), 10, 10, 30, 30);
    fillRect(mask, 70, 70, 90, 90);

    const result = maskToPolygons(mask, W, H, OPTS);

    expect(result.polygons).toHaveLength(2);
    expect(result.area).toBeCloseTo(0.08, 1);
  });

  it('discards holes rather than emitting them as extra rings', () => {
    // pointInAnyPolygon ORs the rings together, so an emitted hole would add
    // its area to the hit region instead of subtracting it.
    const mask = fillRect(blank(), 20, 20, 80, 80);
    fillRect(mask, 40, 40, 60, 60).fill(0, 0, 0);
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) mask[y * W + x] = 0;
    }

    const result = maskToPolygons(mask, W, H, OPTS);

    expect(result.polygons).toHaveLength(1);
    // The full outer square (0.36), not the outer minus the hole (0.32).
    expect(result.area).toBeCloseTo(0.36, 1);
  });

  it('drops speckle below minComponentPx', () => {
    const mask = fillRect(blank(), 25, 25, 75, 75);
    fillRect(mask, 5, 5, 8, 8); // 9px fleck

    const result = maskToPolygons(mask, W, H, OPTS);

    expect(result.polygons).toHaveLength(1);
  });

  it('returns an empty result for an empty mask', () => {
    const result = maskToPolygons(blank(), W, H, OPTS);

    expect(result.polygons).toEqual([]);
    expect(result.area).toBe(0);
  });
});

describe('subtractOccluders', () => {
  it('removes pixels already claimed by a shallower structure', () => {
    const covered = blank();
    const superficial = fillRect(blank(), 20, 20, 60, 60);
    const deep = fillRect(blank(), 40, 40, 80, 80);

    const first = subtractOccluders(superficial, covered);
    const second = subtractOccluders(deep, covered);

    expect(first.visiblePx).toBe(40 * 40);
    expect(second.originalPx).toBe(40 * 40);
    // The deep square loses its overlapping 20x20 corner.
    expect(second.visiblePx).toBe(40 * 40 - 20 * 20);
  });

  it('reports zero visible pixels for a fully occluded structure', () => {
    const covered = blank();
    subtractOccluders(fillRect(blank(), 10, 10, 90, 90), covered);
    const buried = subtractOccluders(fillRect(blank(), 30, 30, 50, 50), covered);

    expect(buried.originalPx).toBe(20 * 20);
    expect(buried.visiblePx).toBe(0);
  });

  it('makes the superficial structure win a click in the overlap region', () => {
    // Without subtraction the deep structure keeps its full silhouette, and
    // hitTest's smallest-area-wins rule hands the overlap to the WRONG
    // structure — the exact failure this pipeline exists to prevent.
    const covered = blank();
    const superficialMask = fillRect(blank(), 10, 10, 90, 90);
    const deepMask = fillRect(blank(), 30, 30, 70, 70);

    const superficial = maskToPolygons(
      subtractOccluders(superficialMask, covered).visible,
      W, H, OPTS,
    );
    const deep = maskToPolygons(subtractOccluders(deepMask, covered).visible, W, H, OPTS);

    const candidates = [
      { structureId: 'superficial', polygons: superficial.polygons, area: superficial.area },
      { structureId: 'deep', polygons: deep.polygons, area: deep.area },
    ];

    expect(deep.polygons).toEqual([]);
    expect(hitTest([0.5, 0.5], candidates)?.structureId).toBe('superficial');
  });
});
