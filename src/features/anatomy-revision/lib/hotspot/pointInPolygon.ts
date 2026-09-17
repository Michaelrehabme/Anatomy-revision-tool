import { pointSegmentDistance } from './accuracy';

/**
 * Ray-casting point-in-polygon test, ported from the working TS snippet in
 * Downloads/README.md (the masks_to_svg.py pipeline's own documented
 * client-side hit-test). Operates on normalized [0,1] coordinates.
 */
export function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** True if the point falls inside any part of a (possibly multi-part) structure polygon. */
export function pointInAnyPolygon(point: [number, number], polygons: number[][][]): boolean {
  return polygons.some((poly) => pointInPolygon(point, poly));
}

/** Shortest distance from a point to a polygon outline, in normalized units. */
export function distanceToOutline(point: [number, number], polygons: number[][][]): number {
  let nearest = Infinity;
  for (const ring of polygons) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d = pointSegmentDistance(point, ring[j], ring[i]);
      if (d < nearest) nearest = d;
    }
  }
  return nearest;
}

/**
 * How far outside its own outline a tap may land and still count as finding
 * the target, in normalized image units — about 4 CSS pixels of an image the
 * width of a phone, and it scales with zoom because the units do.
 *
 * THE OUTLINE IS THE MUSCLE'S EDGE, NOT THE ANSWER'S EDGE. A student aiming at
 * a narrow strip of muscle points at the middle of what they can see and lands
 * a pixel or two outside a traced boundary that is itself only accurate to
 * about that much. Without slack the app calls that wrong and then reveals the
 * target directly under their finger, which teaches nothing except that the
 * app is fussy.
 */
export const TAP_SLACK = 0.01;

/**
 * Whether a tap found the structure it was asked for.
 *
 * Only the TARGET gets the slack. Widening every candidate instead would let a
 * thin hotspot beside the one you meant steal the tap under the smallest-wins
 * rule, which is the same unfairness pointing the other way. Naming what was
 * tapped stays with hitTest and stays strict.
 */
export function isOnTarget(
  point: [number, number],
  polygons: number[][][],
  slack = TAP_SLACK,
): boolean {
  return pointInAnyPolygon(point, polygons) || distanceToOutline(point, polygons) <= slack;
}

export interface HitTestCandidate {
  structureId: string;
  polygons: number[][][];
  area: number;
}

/**
 * Resolves a normalized click point against a set of hotspot candidates.
 * When multiple structures' polygons overlap at the clicked point (e.g.
 * deltoid overlapping supraspinatus), the smallest-area structure wins —
 * matching the pipeline README's documented behaviour, since the smaller
 * structure is what a student tapping precisely usually means.
 */
export function hitTest(
  point: [number, number],
  candidates: HitTestCandidate[],
  toleranceMultiplier = 1,
): HitTestCandidate | null {
  const hits = candidates.filter((c) => {
    if (pointInAnyPolygon(point, c.polygons)) return true;
    if (toleranceMultiplier <= 1) return false;
    return isWithinTolerance(point, c, toleranceMultiplier);
  });
  if (hits.length === 0) return null;
  return hits.reduce((smallest, c) => (c.area < smallest.area ? c : smallest), hits[0]);
}

/**
 * Forgiving fallback for small/fiddly targets: true if the point is within
 * `toleranceMultiplier`x the polygon's equivalent radius of its centroid.
 * Only consulted when a direct point-in-polygon test misses.
 */
function isWithinTolerance(
  point: [number, number],
  candidate: HitTestCandidate,
  toleranceMultiplier: number,
): boolean {
  const centroid = centroidOf(candidate.polygons);
  if (!centroid) return false;
  const equivalentRadius = Math.sqrt(candidate.area / Math.PI);
  const dx = point[0] - centroid[0];
  const dy = point[1] - centroid[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= equivalentRadius * toleranceMultiplier;
}

function centroidOf(polygons: number[][][]): [number, number] | null {
  const allPoints = polygons.flat();
  if (allPoints.length === 0) return null;
  const [sumX, sumY] = allPoints.reduce(
    ([ax, ay], [x, y]) => [ax + x, ay + y],
    [0, 0],
  );
  return [sumX / allPoints.length, sumY / allPoints.length];
}
