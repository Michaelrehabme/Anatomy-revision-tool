import { describe, expect, it } from 'vitest';
import { isAccuracyTarget, isAccuratePass, scoreAccuracy, PASS_SCORE, RING_COUNT } from '../accuracy';
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
});
