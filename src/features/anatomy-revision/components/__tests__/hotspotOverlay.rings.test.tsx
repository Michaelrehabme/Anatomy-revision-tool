import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HotspotOverlay } from '../LocateStructureSession/HotspotOverlay';
import { PASS_FRACTION, RING_COUNT } from '../../lib/hotspot/accuracy';
import type { HotspotPolygon } from '../../types/image';

/**
 * The bug these pin: the overlay used to draw ONE flat polygon covering the
 * whole target, which is 2.5x the landmark. The zone that actually passes is
 * the inner 40% of that, and it was never drawn — so a student could tap well
 * inside the green, be told "not quite", and have nothing to learn from.
 */

const radius = 0.1;
const point: HotspotPolygon = {
  structureId: 'femoral-neck',
  polygons: [[[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]]],
  area: 0.04,
  centroid: [0.5, 0.5],
  targetRadius: radius,
};
const ridge: HotspotPolygon = {
  ...point,
  structureId: 'linea-aspera',
  targetAxis: [[0.3, 0.5], [0.7, 0.5]],
};

const face = (hotspot: HotspotPolygon) =>
  render(
    <HotspotOverlay
      hotspots={[hotspot]}
      highlightStructureId={hotspot.structureId}
      clickPoint={[0.5, 0.5]}
      clickWasCorrect
    />,
  ).container;

describe('the target face', () => {
  it('draws every ring, not one flat blob', () => {
    const bands = face(point).querySelectorAll('circle[data-band-width]');
    expect(bands.length).toBe(RING_COUNT + 1); // ten rings plus the pass rim
  });

  it('spans exactly the scored radius at its outermost band', () => {
    const widths = [...face(point).querySelectorAll('circle[data-band-width]')].map((el) =>
      Number(el.getAttribute('data-band-width')),
    );
    expect(Math.max(...widths)).toBeCloseTo(2 * radius);
  });

  /**
   * The one that matters. The drawn pass boundary must sit where the grading
   * changes its mind, or the overlay is lying again in a new way.
   */
  it('marks the pass boundary at the radius the scoring actually uses', () => {
    const rim = face(point).querySelector('[data-pass-boundary]');
    expect(rim).not.toBeNull();
    // The rim is laid down slightly wider and then overpainted, so what shows
    // is its outer edge: the pass radius, within the hairline's own width.
    expect(Number(rim!.getAttribute('data-band-width')) / 2).toBeCloseTo(radius * PASS_FRACTION, 2);
  });

  it('draws a linear landmark as a stroked spine, not a circle', () => {
    const container = face(ridge);
    expect(container.querySelectorAll('circle[data-band-width]').length).toBe(0);
    const bands = container.querySelectorAll('path[data-band-width]');
    expect(bands.length).toBe(RING_COUNT + 1);
    // A round-capped stroke of width 2r about the spine IS the capsule.
    expect(bands[0].getAttribute('stroke-linecap')).toBe('round');
    expect(bands[0].getAttribute('d')).toBe('M 0.3 0.5 L 0.7 0.5');
  });

  /**
   * A reveal with no tap answers "where is it", not "how close were you". It
   * used to show the full 2.5x target here too, which answers "where is the
   * greater trochanter" with a disc two and a half times too big.
   */
  it('shows only the pass zone when there was no tap to score', () => {
    const container = render(
      <HotspotOverlay hotspots={[point]} highlightStructureId={point.structureId} />,
    ).container;
    const widths = [...container.querySelectorAll('[data-band-width]')].map((el) =>
      Number(el.getAttribute('data-band-width')),
    );
    expect(widths).toContain(2 * radius * PASS_FRACTION);
    expect(container.querySelectorAll('[data-pass-boundary]').length).toBe(0);
  });

  it('leaves a shape hotspot as an outline', () => {
    const outline: HotspotPolygon = { ...point, targetRadius: undefined };
    const container = face(outline);
    expect(container.querySelectorAll('[data-target-face]').length).toBe(0);
    expect(container.querySelectorAll('polygon').length).toBe(1);
  });
});
