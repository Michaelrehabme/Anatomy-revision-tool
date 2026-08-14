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
