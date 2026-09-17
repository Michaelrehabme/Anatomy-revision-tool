import type { HotspotPolygon } from '../../types/image';
import { pointInAnyPolygon } from './pointInPolygon';

/**
 * Scores how close a tap landed, archery-style, for targets whose shape the
 * app knows precisely enough to grade precision against.
 *
 * WHY ONLY SOME HOTSPOTS. A muscle or a bone has an outline, and tapping
 * inside it is simply right — "how close to the middle of the sartorius" is
 * not a question anyone asks. A bony landmark is different: the greater
 * trochanter is a region of the femur, and how close you were IS the answer.
 * Those carry the target fields on HotspotPolygon and everything else does
 * not.
 *
 * THREE SHAPES OF LANDMARK, one scale:
 *
 *   a POINT   — `targetRadius` about `centroid`: ten concentric rings.
 *   a LINE    — `targetAxis`, a polyline spine: the same ten rings measured
 *               perpendicular to it, so the bands are nested capsules rather
 *               than circles and a crest passes along its whole length.
 *   a SURFACE — a traced outline with `targetCore`: no centre to measure
 *               from, so scoring is which of the two shapes contains the tap.
 *
 * A landmark the picture shows twice — the pedicles, seen from above — adds
 * `targetTwins`, one more spine per side. A tap is measured to whichever is
 * nearer, because the left pedicle is as right an answer as the right one.
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

/**
 * The pass boundary as a fraction of `targetRadius` — the same fact as
 * PASS_SCORE, in the units the OVERLAY needs: it draws the pass zone as a
 * band of this half-width, and a drawn zone that disagreed with the scored
 * one would be a picture that lies about the grading. Derived rather than
 * typed, so the two can never drift: a score of 7 needs fewer than four of
 * the ten rings' worth of distance.
 */
export const PASS_FRACTION = (RING_COUNT - PASS_SCORE + 1) / RING_COUNT;

/** True when this hotspot is a point-or-line target and can be scored by distance. */
export function isAccuracyTarget(hotspot: Pick<HotspotPolygon, 'targetRadius'>): boolean {
  return typeof hotspot.targetRadius === 'number' && hotspot.targetRadius > 0;
}

/** Whether a scored tap counts as finding the landmark. */
export function isAccuratePass(score: number | null): boolean {
  return score !== null && score >= PASS_SCORE;
}

/**
 * Distance from a point to a SEGMENT, not to the infinite line through it.
 * Clamping the projection is what makes a spine a capsule rather than an
 * endless band: a tap far off the end of a crest misses, however well it
 * lines up with the crest's direction.
 */
export function pointSegmentDistance(
  p: readonly number[],
  a: readonly number[],
  b: readonly number[],
): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  // A zero-length segment is a point; projecting onto it would divide by zero.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const dx = p[0] - (a[0] + t * vx);
  const dy = p[1] - (a[1] + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Every spine this target is scored against: its own, plus one per twin.
 * A point target's spine is its centroid alone — one entry, one point — so
 * callers never need to branch on which shape they were handed. The overlay
 * draws a band about each of these, which is why it is exported.
 */
export function targetSpines(
  hotspot: Pick<HotspotPolygon, 'centroid' | 'targetAxis' | 'targetTwins'>,
): number[][][] {
  // An axis of fewer than two points carries no direction, so it is the
  // centroid by another name. Treating it as such is the back-compat lock:
  // every landmark published before axes existed scores exactly as it did.
  const own = hotspot.targetAxis && hotspot.targetAxis.length > 1 ? hotspot.targetAxis : [hotspot.centroid];
  const twins = (hotspot.targetTwins ?? []).filter((spine) => spine.length > 0);
  return [own, ...twins];
}

/** Distance to the nearest point of the nearest spine. */
export function distanceToTarget(
  point: [number, number],
  hotspot: Pick<HotspotPolygon, 'centroid' | 'targetAxis' | 'targetTwins'>,
): number {
  let best = Infinity;
  for (const spine of targetSpines(hotspot)) {
    if (spine.length === 1) {
      best = Math.min(best, pointSegmentDistance(point, spine[0], spine[0]));
      continue;
    }
    // Every segment, not just the ends: a bent spine's elbow belongs to both
    // of the segments that meet there, and a `min` over endpoints alone would
    // score one arm of an L and miss the other.
    for (let i = 1; i < spine.length; i++) {
      best = Math.min(best, pointSegmentDistance(point, spine[i - 1], spine[i]));
    }
  }
  return best;
}

/**
 * 10 for dead centre down to 1 at the outer ring, and 0 outside the target.
 * Returns null for a hotspot that is not a distance target, so a caller
 * cannot accidentally score a muscle's outline as though it were a bullseye —
 * see scoreRegion for the shape that has an outline instead.
 */
export function scoreAccuracy(
  point: [number, number],
  hotspot: Pick<HotspotPolygon, 'centroid' | 'targetRadius' | 'targetAxis' | 'targetTwins'>,
): number | null {
  const radius = hotspot.targetRadius;
  if (typeof radius !== 'number' || radius <= 0) return null;

  const distance = distanceToTarget(point, hotspot);
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

/**
 * Scores a tap on a landmark that is a traced SURFACE — an iliac crest, a
 * sacral ala — where there is no centre to measure from.
 *
 * The outline had to be grown to become tappable, so the shape carries two:
 * `targetCore` is the landmark itself and `polygons` is the hitbox around it.
 * Inside the core is full marks; inside the hitbox but outside the core is a
 * bare pass, which is the same thing the rings say about the halo.
 *
 * Null when there is no core. An outline with nothing to compare against
 * would otherwise score every tap inside it 10 — a claim about precision the
 * shape cannot support.
 */
export function scoreRegion(
  point: [number, number],
  hotspot: Pick<HotspotPolygon, 'polygons' | 'targetCore'>,
): number | null {
  const core = hotspot.targetCore;
  if (!core?.length) return null;
  if (pointInAnyPolygon(point, core)) return RING_COUNT;
  return pointInAnyPolygon(point, hotspot.polygons) ? PASS_SCORE : 0;
}
