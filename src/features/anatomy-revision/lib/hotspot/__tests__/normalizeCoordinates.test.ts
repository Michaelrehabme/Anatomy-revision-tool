import { describe, it, expect } from 'vitest';
import { normalizePointerEvent } from '../normalizeCoordinates';

function rectAt(left: number, top: number, width: number, height: number) {
  return { getBoundingClientRect: () => ({ left, top, width, height }) };
}

describe('normalizePointerEvent', () => {
  it('maps a click at the top-left corner to [0, 0]', () => {
    const element = rectAt(100, 200, 800, 400);
    expect(normalizePointerEvent({ clientX: 100, clientY: 200 }, element)).toEqual([0, 0]);
  });

  it('maps a click at the bottom-right corner to [1, 1]', () => {
    const element = rectAt(100, 200, 800, 400);
    expect(normalizePointerEvent({ clientX: 900, clientY: 600 }, element)).toEqual([1, 1]);
  });

  it('maps a click at the center to [0.5, 0.5] regardless of the box size', () => {
    const element = rectAt(0, 0, 1600, 900);
    expect(normalizePointerEvent({ clientX: 800, clientY: 450 }, element)).toEqual([0.5, 0.5]);
  });

  it('is independent of zoom scale, since a CSS transform changes the reported bounding rect', () => {
    // A stage div scaled 3x by CSS transform reports a 3x larger bounding
    // rect from getBoundingClientRect() — normalization must still resolve
    // to the same fractional position, which is exactly what the hotspot
    // editor's pan/zoom relies on (see CanvasEditor.tsx).
    const unscaled = rectAt(0, 0, 800, 400);
    const scaled = rectAt(-800, -400, 2400, 1200); // same box, zoomed 3x around its center
    const p1 = normalizePointerEvent({ clientX: 200, clientY: 100 }, unscaled);
    const pointAtSameFractionWhenScaled = normalizePointerEvent({ clientX: -200, clientY: -100 }, scaled);
    expect(pointAtSameFractionWhenScaled).toEqual(p1);
  });

  it('clamps out-of-bounds clicks to the [0,1] range', () => {
    const element = rectAt(0, 0, 100, 100);
    expect(normalizePointerEvent({ clientX: -50, clientY: 500 }, element)).toEqual([0, 1]);
  });
});
