/**
 * Pure geometry helpers for the hotspot authoring tool. Kept separate from
 * lib/hotspot/pointInPolygon.ts (which this feature must not modify) even
 * though centroid/area here are computed to match its internal `centroidOf`
 * convention (plain vertex average, not an area-weighted centroid) — the
 * hit-test tolerance fallback in that module reads a HotspotPolygon's stored
 * `centroid`, so authored data needs to agree with it.
 */

/** Shoelace formula, absolute area of one ring in normalized 0-1 units. */
export function ringArea(ring: number[][]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Total area across every ring (multi-part structures) — rings are assumed non-overlapping. */
export function polygonSetArea(polygons: number[][][]): number {
  return polygons.reduce((sum, ring) => sum + ringArea(ring), 0);
}

/** Plain average of every vertex across every ring — matches pointInPolygon.ts's centroidOf. */
export function polygonSetCentroid(polygons: number[][][]): [number, number] {
  const allPoints = polygons.flat();
  if (allPoints.length === 0) return [0, 0];
  const [sumX, sumY] = allPoints.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sumX / allPoints.length, sumY / allPoints.length];
}

function segmentsIntersect(a1: number[], a2: number[], b1: number[], b2: number[]): boolean {
  const d = (p: number[], q: number[], r: number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** True if any two non-adjacent edges of the ring cross — a simple self-intersection check. */
export function ringSelfIntersects(ring: number[][]): boolean {
  const n = ring.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i || j === (i + 1) % n || (j + 1) % n === i;
      if (adjacent) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export interface HotspotDraft {
  structureId: string;
  polygons: number[][][];
}

/**
 * Warnings for the CR-007 validation pass: self-intersecting rings, rings
 * with fewer than 3 vertices, out-of-bounds coordinates, and a structure
 * already having another polygon on the same image. Non-blocking — the
 * caller decides whether to let the user export/save anyway.
 */
export function validateHotspot(hotspot: HotspotDraft, othersOnSameImage: HotspotDraft[]): string[] {
  const warnings: string[] = [];

  for (const ring of hotspot.polygons) {
    if (ring.length < 3) warnings.push('A shape has fewer than 3 vertices.');
    if (ringSelfIntersects(ring)) warnings.push('A shape’s edges cross themselves.');
    for (const [x, y] of ring) {
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        warnings.push('A vertex falls outside the image bounds.');
        break;
      }
    }
  }

  const duplicate = othersOnSameImage.some((h) => h.structureId === hotspot.structureId);
  if (duplicate) warnings.push(`${hotspot.structureId} already has a polygon on this image.`);

  return [...new Set(warnings)];
}
