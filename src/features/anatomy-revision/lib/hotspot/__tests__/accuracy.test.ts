import { describe, expect, it } from 'vitest';
import {
  distanceToTarget,
  isAccuracyTarget,
  isAccuratePass,
  pointSegmentDistance,
  scoreAccuracy,
  scoreRegion,
  PASS_FRACTION,
  PASS_SCORE,
  RING_COUNT,
} from '../accuracy';
import { ALL_IMAGES } from '../../../data/seed';

const target = { centroid: [0.5, 0.5] as [number, number], targetRadius: 0.1 };

describe('scoreAccuracy', () => {
  it('scores 10 dead centre and 0 outside the target', () => {
    expect(scoreAccuracy([0.5, 0.5], target)).toBe(10);
    // Just outside, not exactly on the rim: a point ON a ring boundary is
    // decided by floating point (0.5 + 0.1 is not 0.6), which is immaterial for
    // taps that come from pixel positions but makes a brittle assertion.
    expect(scoreAccuracy([0.5 + 0.1001, 0.5], target)).toBe(0);
    expect(scoreAccuracy([0.9, 0.9], target)).toBe(0);
  });

  it('gives every ring a score, and never 0 while still inside', () => {
    const seen = new Set<number>();
    for (let i = 0; i < RING_COUNT; i++) {
      // The middle of ring i, so a rounding slip cannot land it in a neighbour.
      const d = (target.targetRadius * (i + 0.5)) / RING_COUNT;
      const score = scoreAccuracy([0.5 + d, 0.5], target);
      expect(score).toBeGreaterThan(0);
      seen.add(score!);
    }
    expect(seen.size).toBe(RING_COUNT);
  });

  it('scores by distance, not direction', () => {
    // Mid-ring, for the same reason: on a boundary the four directions can
    // round to either side of it.
    const d = 0.045;
    const scores = [
      scoreAccuracy([0.5 + d, 0.5], target),
      scoreAccuracy([0.5 - d, 0.5], target),
      scoreAccuracy([0.5, 0.5 + d], target),
      scoreAccuracy([0.5, 0.5 - d], target),
    ];
    expect(new Set(scores).size).toBe(1);
  });

  /**
   * The pass mark is not a preference. The target is 2.5x the landmark's own
   * radius, so the landmark ends at 40% of the way out — which is the edge of
   * ring 7. A tap on the landmark must pass and one just beyond it must not,
   * or the score stops meaning "you found it".
   */
  it('passes exactly at the edge of the landmark, not the edge of the target', () => {
    const landmarkEdge = target.targetRadius * 0.4;
    expect(isAccuratePass(scoreAccuracy([0.5 + landmarkEdge * 0.98, 0.5], target))).toBe(true);
    expect(isAccuratePass(scoreAccuracy([0.5 + landmarkEdge * 1.05, 0.5], target))).toBe(false);
    expect(PASS_SCORE).toBe(7);
  });

  it('refuses to score a hotspot that is a shape rather than a point', () => {
    expect(scoreAccuracy([0.5, 0.5], { centroid: [0.5, 0.5] })).toBeNull();
    expect(scoreAccuracy([0.5, 0.5], { centroid: [0.5, 0.5], targetRadius: 0 })).toBeNull();
    expect(isAccuratePass(null)).toBe(false);
  });
});

/**
 * A linear landmark — a crest, a ridge — is a capsule: the same ten rings,
 * measured from a spine instead of from a point. These are the cases that
 * separate it from the circle it replaced.
 */
describe('scoreAccuracy along an axis', () => {
  // A horizontal ridge across the middle of the image.
  const ridge = {
    centroid: [0.5, 0.5] as [number, number],
    targetRadius: 0.05,
    targetAxis: [
      [0.2, 0.5],
      [0.8, 0.5],
    ],
  };

  it('scores 10 all along the spine, not only at the middle', () => {
    for (const x of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      expect(scoreAccuracy([x, 0.5], ridge), `x=${x}`).toBe(10);
    }
  });

  it('scores by perpendicular distance, so the whole ridge passes', () => {
    const justInside = ridge.targetRadius * PASS_FRACTION * 0.95;
    for (const x of [0.22, 0.5, 0.78]) {
      expect(isAccuratePass(scoreAccuracy([x, 0.5 + justInside], ridge)), `x=${x}`).toBe(true);
    }
    const justOutside = ridge.targetRadius * PASS_FRACTION * 1.1;
    expect(isAccuratePass(scoreAccuracy([0.5, 0.5 + justOutside], ridge))).toBe(false);
  });

  /**
   * The point of clamping the projection: a capsule, not an endless band. A tap
   * far off the end of the crest must miss, however well-aligned it is.
   */
  it('falls off radially past either end', () => {
    expect(scoreAccuracy([0.8 + ridge.targetRadius * 0.5, 0.5], ridge)).toBeGreaterThan(0);
    expect(scoreAccuracy([0.8 + ridge.targetRadius * 1.5, 0.5], ridge)).toBe(0);
    expect(scoreAccuracy([0.2 - ridge.targetRadius * 1.5, 0.5], ridge)).toBe(0);
  });

  it('scores the elbow of a bent spine, not just its segments’ ends', () => {
    // An L. A `min` that forgot a segment would score one arm and miss the other.
    const bent = {
      centroid: [0.5, 0.5] as [number, number],
      targetRadius: 0.05,
      targetAxis: [
        [0.3, 0.3],
        [0.6, 0.3],
        [0.6, 0.7],
      ],
    };
    expect(scoreAccuracy([0.45, 0.3], bent)).toBe(10); // along the first arm
    expect(scoreAccuracy([0.6, 0.3], bent)).toBe(10); // the elbow itself
    expect(scoreAccuracy([0.6, 0.55], bent)).toBe(10); // along the second arm
    // Inside the L's corner but off both arms.
    expect(scoreAccuracy([0.35, 0.65], bent)).toBe(0);
  });

  /**
   * The back-compat lock. Every landmark shipped before axes existed must score
   * exactly as it did, or this change silently re-grades the whole atlas.
   */
  it('treats a missing, empty or single-point axis as the centroid', () => {
    const cases = [
      { ...target },
      { ...target, targetAxis: [] },
      { ...target, targetAxis: [[0.5, 0.5]] },
    ];
    for (const d of [0, 0.02, 0.045, 0.08, 0.2]) {
      const expected = scoreAccuracy([0.5 + d, 0.5], target);
      for (const hotspot of cases) {
        expect(scoreAccuracy([0.5 + d, 0.5], hotspot), `d=${d}`).toBe(expected);
      }
    }
  });
});

/**
 * A traced region cannot use the rings — there is no centre to measure from —
 * but it still has to tell a tap ON the landmark from one in the margin the
 * outline had to be grown by to become tappable.
 */
describe('scoreAccuracy with a twin', () => {
  // The pedicle, seen from above: one either side of the midline.
  const paired = {
    centroid: [0.3, 0.5] as [number, number],
    targetRadius: 0.1,
    targetTwins: [[[0.7, 0.5]]],
  };

  it('scores the other side exactly as it scores its own', () => {
    expect(scoreAccuracy([0.3, 0.5], paired)).toBe(10);
    expect(scoreAccuracy([0.7, 0.5], paired)).toBe(10);
    expect(scoreAccuracy([0.7, 0.535], paired)).toBe(scoreAccuracy([0.3, 0.535], paired));
  });

  it('still fails a tap between the two', () => {
    expect(scoreAccuracy([0.5, 0.5], paired)).toBe(0);
  });

  it('measures to the nearer side', () => {
    expect(distanceToTarget([0.68, 0.5], paired)).toBeCloseTo(0.02, 10);
  });

  it('twins a line as a line', () => {
    const crests = {
      centroid: [0.3, 0.5] as [number, number],
      targetRadius: 0.05,
      targetAxis: [[0.3, 0.2], [0.3, 0.8]],
      targetTwins: [[[0.7, 0.2], [0.7, 0.8]]],
    };
    expect(scoreAccuracy([0.7, 0.75], crests)).toBe(10);
    expect(scoreAccuracy([0.5, 0.5], crests)).toBe(0);
  });
});

describe('scoreRegion', () => {
  const square = (x0: number, y0: number, x1: number, y1: number) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const region = {
    polygons: [square(0.2, 0.2, 0.8, 0.8)],
    targetCore: [square(0.4, 0.4, 0.6, 0.6)],
  };

  it('gives full marks on the landmark and a pass in the margin', () => {
    expect(scoreRegion([0.5, 0.5], region)).toBe(RING_COUNT);
    expect(scoreRegion([0.3, 0.3], region)).toBe(PASS_SCORE);
    expect(isAccuratePass(scoreRegion([0.3, 0.3], region))).toBe(true);
  });

  it('fails a tap outside the hitbox', () => {
    expect(scoreRegion([0.05, 0.05], region)).toBe(0);
    expect(isAccuratePass(scoreRegion([0.05, 0.05], region))).toBe(false);
  });

  /**
   * Without this an outline with no core would score every tap inside it 10,
   * which is a claim about precision the shape cannot support.
   */
  it('refuses to score an outline that carries no core', () => {
    expect(scoreRegion([0.5, 0.5], { polygons: region.polygons })).toBeNull();
    expect(scoreRegion([0.5, 0.5], { polygons: region.polygons, targetCore: [] })).toBeNull();
  });
});

describe('pointSegmentDistance', () => {
  it('measures to the nearest point on the segment', () => {
    expect(pointSegmentDistance([0.5, 0.6], [0, 0.5], [1, 0.5])).toBeCloseTo(0.1);
  });

  it('measures to an endpoint once past it, not to the infinite line', () => {
    expect(pointSegmentDistance([1.3, 0.5], [0, 0.5], [1, 0.5])).toBeCloseTo(0.3);
    expect(pointSegmentDistance([-0.3, 0.5], [0, 0.5], [1, 0.5])).toBeCloseTo(0.3);
  });

  it('handles a zero-length segment without dividing by zero', () => {
    expect(pointSegmentDistance([0.3, 0.4], [0, 0], [0, 0])).toBeCloseTo(0.5);
  });
});

describe('the shipped hotspots', () => {
  it('marks landmarks as point targets and nothing else', () => {
    const scorable = ALL_IMAGES.flatMap((img) =>
      (img.hotspots ?? []).filter(isAccuracyTarget).map(() => img.id),
    );
    expect(scorable.length).toBeGreaterThan(0);
    expect(scorable.every((id) => id.startsWith('landmark-'))).toBe(true);
  });

  it('keeps every landmark target inside its own image', () => {
    for (const image of ALL_IMAGES) {
      for (const hotspot of image.hotspots ?? []) {
        if (!isAccuracyTarget(hotspot)) continue;
        const [x, y] = hotspot.centroid;
        // A centre outside the frame would make the whole target unreachable.
        expect(x, image.id).toBeGreaterThan(0);
        expect(x, image.id).toBeLessThan(1);
        expect(y, image.id).toBeGreaterThan(0);
        expect(y, image.id).toBeLessThan(1);
      }
    }
  });

  /**
   * The overlay draws a ring band as a round-capped STROKE, whose width is one
   * number for both axes — so a target only reads as circular while the image
   * is square. Every landmark panel is 1400x1400 today; this is the assertion
   * that notices if one ever is not.
   */
  it('renders every scorable target on a square image', () => {
    for (const image of ALL_IMAGES) {
      if (!(image.hotspots ?? []).some(isAccuracyTarget)) continue;
      expect(image.width, image.id).toBe(image.height);
    }
  });
});

describe('the shape of a landmark target', () => {
  const landmarkHotspots = ALL_IMAGES.filter((image) => image.id.startsWith('landmark-')).flatMap(
    (image) => (image.hotspots ?? []).map((hotspot) => ({ id: image.id, hotspot })),
  );

  /**
   * NOT A RATCHET ANY MORE. Twenty-three targets used to run off the edge of
   * their own picture, because the renderer framed on the landmark's CENTRE
   * and then only checked that the centre had landed inside — so the femoral
   * neck shipped with 40% of its target above the top edge and no bone above
   * it. The renderer now fits the whole target before it will publish a view,
   * so this is an invariant rather than a budget: none, ever.
   */
  it('keeps every scorable target completely inside its own picture', () => {
    for (const { id, hotspot } of landmarkHotspots) {
      if (!isAccuracyTarget(hotspot)) continue;
      const r = hotspot.targetRadius!;
      const spine = hotspot.targetAxis?.length ? hotspot.targetAxis : [hotspot.centroid];
      for (const [x, y] of spine) {
        expect(x - r, id).toBeGreaterThanOrEqual(0);
        expect(x + r, id).toBeLessThanOrEqual(1);
        expect(y - r, id).toBeGreaterThanOrEqual(0);
        expect(y + r, id).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * A landmark that is a SHAPE carries a traced outline and no radius, which is
   * what routes it through point-in-polygon instead of the archery rings. A
   * radius that survived alongside an outline would score a tap on the iliac
   * crest by its distance from one arbitrary point of it.
   */
  it('gives a traced region an outline and no radius', () => {
    const regions = landmarkHotspots.filter(({ hotspot }) => !isAccuracyTarget(hotspot));
    expect(regions.length).toBeGreaterThan(0);
    for (const { id, hotspot } of regions) {
      expect(hotspot.targetRadius, id).toBeUndefined();
      expect(hotspot.polygons.length, id).toBeGreaterThan(0);
      expect(hotspot.area, id).toBeGreaterThan(0);
    }
  });

  /**
   * THIS MEASURES THE HALO, NOT THE SCORING ZONE — which is why it is a budget
   * and not a failure. `targetRadius` is 2.5x the landmark, so a correct 8mm
   * target on a 50mm-wide crop of the coccyx fills 40% of the picture and trips
   * this. Checked against the spec, every one of these has a pass zone exactly
   * equal to the landmark's real size.
   *
   * It is still worth pinning, because a large halo is a fair signal that the
   * landmark is a flat SURFACE drawn as a circle — a sacral ala, an
   * infraspinous fossa — and those want a traced region. The count can only
   * fall as they get one.
   */
  const LARGE_HALO_FRACTION = 0.2;
  const AWAITING_A_REGION = 28;

  it('does not grow the number of landmarks still drawn as an outsized circle', () => {
    const large = landmarkHotspots.filter(
      ({ hotspot }) => (hotspot.targetRadius ?? 0) > LARGE_HALO_FRACTION,
    );
    expect(large.length).toBeLessThanOrEqual(AWAITING_A_REGION);
  });

  // The check that actually matters — is any pass zone LARGER than the
  // landmark it stands for — cannot be made here: it needs the spec's radius
  // in metres and the render's frame size, neither of which reaches the seed.
  // publishLandmarks.ts counts it instead, and prints the tally every run.
  // It is currently zero.
});
