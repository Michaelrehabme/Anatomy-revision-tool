/**
 * Pure polygon geometry shared by the mask->hotspot converter
 * (src/scripts/masksToHotspots.ts) and the dev authoring tool, so a polygon's
 * stored `area` is always produced by the same code path regardless of which
 * one wrote it.
 *
 * `area` drives the smallest-wins overlap rule in pointInPolygon.ts's hitTest,
 * so it must be measured on the FINAL simplified rings — measuring it on the
 * source raster instead would let a simplified polygon claim an area it no
 * longer has, and silently change which structure a click resolves to.
 */

/** Shoelace area of a single closed ring, unsigned. */
export function ringArea(ring: number[][]): number {
  return Math.abs(ringSignedArea(ring));
}

/**
 * Shoelace area keeping its sign: positive for counter-clockwise winding,
 * negative for clockwise. The sign is what makes the centroid formula work,
 * so it is exposed separately rather than folded into ringArea.
 */
export function ringSignedArea(ring: number[][]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/** Total area across every part of a multi-part structure. */
export function polygonsArea(polygons: number[][][]): number {
  return polygons.reduce((total, ring) => total + ringArea(ring), 0);
}

/**
 * Area-weighted centroid across all parts — NOT the mean of the vertices.
 * A vertex mean drifts towards whichever part of the outline was traced at
 * higher resolution, which for a traced muscle silhouette can land outside
 * the shape entirely.
 */
export function polygonsCentroid(polygons: number[][][]): [number, number] {
  let cx = 0;
  let cy = 0;
  let totalArea = 0;

  for (const ring of polygons) {
    if (ring.length < 3) continue;
    const signedArea = ringSignedArea(ring);
    if (Math.abs(signedArea) < 1e-12) continue;

    let rx = 0;
    let ry = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      rx += (ring[j][0] + ring[i][0]) * cross;
      ry += (ring[j][1] + ring[i][1]) * cross;
    }
    rx /= 6 * signedArea;
    ry /= 6 * signedArea;

    cx += rx * signedArea;
    cy += ry * signedArea;
    totalArea += signedArea;
  }

  if (Math.abs(totalArea) < 1e-12) return boundingBoxCentre(polygons);
  return [cx / totalArea, cy / totalArea];
}

function boundingBoxCentre(polygons: number[][][]): [number, number] {
  const points = polygons.flat();
  if (points.length === 0) return [0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Douglas-Peucker simplification of an OPEN polyline. Keeps both endpoints.
 * Iterative rather than recursive: a traced 1400px outline can exceed 5000
 * points, deep enough to blow the stack on a degenerate input.
 */
export function douglasPeucker(points: number[][], epsilon: number): number[][] {
  if (points.length <= 2) return [...points];

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last <= first + 1) continue;

    let maxDistance = -1;
    let maxIndex = first;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > epsilon) {
      keep[maxIndex] = 1;
      stack.push([first, maxIndex], [maxIndex, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

function perpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Degenerate segment: fall back to straight-line distance from the endpoint.
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  return Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

export interface SimplifyRingOptions {
  epsilon: number;
  maxVertices?: number;
  minVertices?: number;
}

/**
 * Simplifies a CLOSED ring. A closed ring has no endpoints for Douglas-Peucker
 * to anchor on, and anchoring on an arbitrary vertex lets the simplifier cut
 * straight across the shape near that seam. So the ring is split at its two
 * most distant points and each half is simplified as an open polyline.
 *
 * If the result still exceeds maxVertices, epsilon is raised by binary search
 * rather than by a fixed multiplier, which keeps the vertex budget tight
 * without over-smoothing shapes that were already close to the limit.
 */
export function simplifyRing(ring: number[][], options: SimplifyRingOptions): number[][] {
  const { epsilon, maxVertices = 150, minVertices = 8 } = options;
  if (ring.length <= minVertices) return [...ring];

  const simplify = (eps: number): number[][] => {
    const startIndex = lexicographicallySmallestIndex(ring);
    const rotated = [...ring.slice(startIndex), ...ring.slice(0, startIndex)];
    const splitIndex = farthestPointIndex(rotated, rotated[0]);
    if (splitIndex <= 0 || splitIndex >= rotated.length - 1) {
      return douglasPeucker(rotated, eps);
    }

    const first = douglasPeucker(rotated.slice(0, splitIndex + 1), eps);
    const second = douglasPeucker(rotated.slice(splitIndex), eps);
    // Drop the shared vertex at the join and the duplicated start point.
    return [...first, ...second.slice(1, -1)];
  };

  let result = simplify(epsilon);
  if (result.length <= maxVertices) return result;

  // Grow the upper bound until it actually meets the budget before bisecting —
  // a fixed multiple of epsilon is not enough when epsilon starts very small
  // relative to the shape.
  let low = epsilon;
  let high = epsilon * 2;
  let highResult: number[][] | null = null;
  for (let i = 0; i < 40; i++) {
    const candidate = simplify(high);
    if (candidate.length <= maxVertices) {
      highResult = candidate;
      break;
    }
    low = high;
    high *= 2;
  }

  // Nothing in range met the budget (a ring of near-duplicate points); take the
  // best available rather than returning something worse than the input.
  if (!highResult) return result;
  result = highResult;

  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    const candidate = simplify(mid);
    if (candidate.length > maxVertices) {
      low = mid;
    } else {
      high = mid;
      result = candidate;
    }
  }

  return result;
}

function lexicographicallySmallestIndex(ring: number[][]): number {
  let best = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i][0] < ring[best][0] || (ring[i][0] === ring[best][0] && ring[i][1] < ring[best][1])) {
      best = i;
    }
  }
  return best;
}

function farthestPointIndex(ring: number[][], from: number[]): number {
  let best = 0;
  let bestDistance = -1;
  for (let i = 1; i < ring.length; i++) {
    const distance = Math.hypot(ring[i][0] - from[0], ring[i][1] - from[1]);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}
