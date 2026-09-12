import type { HotspotPolygon } from '../../types/image';

/**
 * Scores how close a tap landed, archery-style, for targets that are a point
 * rather than a shape.
 *
 * WHY ONLY SOME HOTSPOTS. A muscle or a bone has an outline, and tapping inside
 * it is simply right — "how close to the middle of the sartorius" is not a
 * question anyone asks. A bony landmark has no outline: the greater trochanter
 * is a region of the femur, and its hotspot is a circle placed on it, sized
 * from the landmark's real dimensions. For those, how close you were IS the
 * answer, so they carry `targetRadius` and everything else does not.
 *
 * TEN EQUAL RINGS, as on a target face. The inner 40% of the radius is the
 * landmark itself and scores 7 to 10; the rest is the near-miss halo. That is
 * why 7 is the pass mark and not an arbitrary number: it is the edge of the
 * landmark, and it falls exactly where a target face changes from red to blue.
 */

/** Rings, as in archery: ten equal bands out to the edge of the target. */
export const RING_COUNT = 10;

/**
 * Scores 7 and above mean the tap was on the landmark rather than near it.
 * The target is 2.5x the landmark's radius (see publishLandmarks.ts), so the
 * landmark occupies the inner 4 rings.
 */
export const PASS_SCORE = 7;

/** True when this hotspot is a point target and can be scored for accuracy. */
export function isAccuracyTarget(hotspot: Pick<HotspotPolygon, 'targetRadius'>): boolean {
  return typeof hotspot.targetRadius === 'number' && hotspot.targetRadius > 0;
}

/**
 * 10 for dead centre down to 1 at the outer ring, and 0 outside the target.
 * Returns null for a hotspot that is not a point target, so a caller cannot
 * accidentally score a muscle's outline as though it were a bullseye.
 */
export function scoreAccuracy(
  point: [number, number],
  hotspot: Pick<HotspotPolygon, 'centroid' | 'targetRadius'>,
): number | null {
  const radius = hotspot.targetRadius;
  if (typeof radius !== 'number' || radius <= 0) return null;

  const dx = point[0] - hotspot.centroid[0];
  const dy = point[1] - hotspot.centroid[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance >= radius) return 0;

  // A point landing EXACTLY on a ring boundary falls whichever way floating
  // point rounds it. That is left alone rather than nudged: taps come from
  // pixel positions, so they never land that close to an edge, and an epsilon
  // here would only move the ambiguity somewhere less obvious.
  const ring = radius / RING_COUNT;
  // Math.floor, so the very edge of a ring belongs to the lower score — the
  // same convention as a target face, where the line counts as the higher ring
  // only if the arrow actually breaks it.
  return Math.max(1, RING_COUNT - Math.floor(distance / ring));
}

/** Whether a scored tap counts as finding the landmark. */
export function isAccuratePass(score: number | null): boolean {
  return score !== null && score >= PASS_SCORE;
}
