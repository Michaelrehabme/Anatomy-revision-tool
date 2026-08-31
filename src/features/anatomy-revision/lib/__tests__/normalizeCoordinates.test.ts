import { describe, it, expect } from 'vitest';
import { normalizePointerEvent } from '../hotspot/normalizeCoordinates';

function element(left: number, top: number, width: number, height: number) {
  return { getBoundingClientRect: () => ({ left, top, width, height }) };
}

describe('normalizePointerEvent', () => {
  it('maps the centre of the rendered box to [0.5, 0.5]', () => {
    const point = normalizePointerEvent({ clientX: 100, clientY: 50 }, element(0, 0, 200, 100));
    expect(point).toEqual([0.5, 0.5]);
  });

  it('accounts for the element offset within the viewport', () => {
    const point = normalizePointerEvent({ clientX: 340, clientY: 220 }, element(300, 200, 80, 40));
    expect(point).toEqual([0.5, 0.5]);
  });

  it('maps the corners to [0, 0] and [1, 1]', () => {
    const box = element(10, 20, 100, 200);
    expect(normalizePointerEvent({ clientX: 10, clientY: 20 }, box)).toEqual([0, 0]);
    expect(normalizePointerEvent({ clientX: 110, clientY: 220 }, box)).toEqual([1, 1]);
  });

  it('clamps clicks that land outside the element', () => {
    const box = element(0, 0, 100, 100);
    expect(normalizePointerEvent({ clientX: -40, clientY: -10 }, box)).toEqual([0, 0]);
    expect(normalizePointerEvent({ clientX: 500, clientY: 900 }, box)).toEqual([1, 1]);
  });

  it('normalizes against the RENDERED box, not the image, so the caller owns the 1:1 guarantee', () => {
    // A 1400x1400 image letterboxed into a 400x200 box would report [0.5, 0.5]
    // here for a click at the box centre even though that is not the image
    // centre. HotspotImage avoids this by sizing its wrapper from the asset's
    // width/height via CSS aspect-ratio — hence the seed data must carry them.
    const point = normalizePointerEvent({ clientX: 200, clientY: 100 }, element(0, 0, 400, 200));
    expect(point).toEqual([0.5, 0.5]);

    const offCentre = normalizePointerEvent({ clientX: 300, clientY: 100 }, element(0, 0, 400, 200));
    expect(offCentre).toEqual([0.75, 0.5]);
  });
});
