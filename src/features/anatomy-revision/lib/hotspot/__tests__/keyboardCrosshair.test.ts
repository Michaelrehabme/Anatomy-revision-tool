import { describe, expect, it } from 'vitest';
import {
  COARSE_STEP,
  CROSSHAIR_START,
  FINE_STEP,
  PAN_MARGIN,
  crosshairClientPoint,
  isCrosshairKey,
  moveCrosshair,
  type Crosshair,
  type CrosshairKey,
  type StageView,
} from '../keyboardCrosshair';
import { MIN_TAPPABLE_WIDTH } from '../../questionGenerators/locate';
import { TAP_SLACK } from '../pointInPolygon';
import { normalizePointerEvent } from '../normalizeCoordinates';

const stage = { width: 400, height: 300 };
const flat: StageView = { z: 1, tx: 0, ty: 0 };

/** Press a key n times from a starting state. */
function press(key: CrosshairKey, n: number, from: { crosshair: Crosshair; view: StageView }, coarse = false) {
  let at = from;
  for (let i = 0; i < n; i++) at = moveCrosshair(at.crosshair, at.view, stage, key, coarse);
  return at;
}

describe('the keyboard crosshair: movement', () => {
  it('starts in the middle of the stage', () => {
    expect(CROSSHAIR_START).toEqual({ x: 0.5, y: 0.5 });
  });

  it('moves one fine step per arrow key, the same distance on screen in every direction', () => {
    const start = { crosshair: CROSSHAIR_START, view: flat };
    const right = press('ArrowRight', 1, start).crosshair;
    const down = press('ArrowDown', 1, start).crosshair;
    expect(right.x * stage.width - 200).toBeCloseTo(FINE_STEP * stage.width);
    expect(right.y).toBe(0.5);
    // Measured in pixels, not in fractions of each side: the stage is not square.
    expect(down.y * stage.height - 150).toBeCloseTo(FINE_STEP * stage.width);
    expect(down.x).toBe(0.5);
    expect(press('ArrowLeft', 1, start).crosshair.x).toBeLessThan(0.5);
    expect(press('ArrowUp', 1, start).crosshair.y).toBeLessThan(0.5);
  });

  it('moves ten times as far with Shift', () => {
    const start = { crosshair: CROSSHAIR_START, view: flat };
    const coarse = press('ArrowRight', 1, start, true).crosshair.x - 0.5;
    const fine = press('ArrowRight', 1, start).crosshair.x - 0.5;
    expect(coarse / fine).toBeCloseTo(COARSE_STEP / FINE_STEP);
    expect(COARSE_STEP / FINE_STEP).toBe(10);
  });

  it('cannot step over the narrowest target a locate question may ask for', () => {
    // The narrowest target, plus the slack it is graded with either side.
    expect(FINE_STEP).toBeLessThan(MIN_TAPPABLE_WIDTH + 2 * TAP_SLACK);
    expect(FINE_STEP).toBeLessThanOrEqual(TAP_SLACK);
  });

  it('knows its own keys and no others', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) expect(isCrosshairKey(key)).toBe(true);
    for (const key of ['Enter', ' ', 'Tab', 'a', 'Home', 'toString']) expect(isCrosshairKey(key)).toBe(false);
  });
});

describe('the keyboard crosshair: clamping', () => {
  it('stops at each edge of the stage at 1x and never leaves it', () => {
    const start = { crosshair: CROSSHAIR_START, view: flat };
    expect(press('ArrowRight', 40, start, true).crosshair.x).toBe(1);
    expect(press('ArrowLeft', 40, start, true).crosshair.x).toBe(0);
    expect(press('ArrowDown', 40, start, true).crosshair.y).toBe(1);
    expect(press('ArrowUp', 40, start, true).crosshair.y).toBe(0);
    // ...and the picture has not moved under it.
    expect(press('ArrowRight', 40, start, true).view).toEqual(flat);
  });

  it('does not move a stage that has no size yet', () => {
    const moved = moveCrosshair(CROSSHAIR_START, flat, { width: 0, height: 0 }, 'ArrowRight', false);
    expect(moved).toEqual({ crosshair: CROSSHAIR_START, view: flat });
  });
});

describe('the keyboard crosshair: a zoomed picture', () => {
  // 2x, showing the top-left quarter of the picture.
  const zoomed: StageView = { z: 2, tx: 0, ty: 0 };

  it('pushes the picture along near the edge instead of running out of stage', () => {
    const at = press('ArrowRight', 40, { crosshair: CROSSHAIR_START, view: zoomed }, true);
    // The picture has slid as far as it can: its right edge is at the stage's.
    expect(at.view.tx).toBe(stage.width - stage.width * 2);
    // And only then did the crosshair run on to the edge.
    expect(at.crosshair.x).toBe(1);
  });

  it('holds the crosshair inside the margin while there is picture left to pan', () => {
    const at = press('ArrowRight', 9, { crosshair: CROSSHAIR_START, view: zoomed }, true);
    expect(at.view.tx).toBeLessThan(0);
    expect(at.view.tx).toBeGreaterThan(stage.width - stage.width * 2);
    expect(at.crosshair.x).toBeCloseTo(1 - PAN_MARGIN);
  });

  it('never pans past the picture, in any direction', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const) {
      const at = press(key, 60, { crosshair: CROSSHAIR_START, view: { z: 3, tx: -400, ty: -300 } }, true);
      expect(at.view.tx).toBeLessThanOrEqual(0);
      expect(at.view.tx).toBeGreaterThanOrEqual(stage.width - stage.width * 3);
      expect(at.view.ty).toBeLessThanOrEqual(0);
      expect(at.view.ty).toBeGreaterThanOrEqual(stage.height - stage.height * 3);
      expect(at.crosshair.x).toBeGreaterThanOrEqual(0);
      expect(at.crosshair.x).toBeLessThanOrEqual(1);
      expect(at.crosshair.y).toBeGreaterThanOrEqual(0);
      expect(at.crosshair.y).toBeLessThanOrEqual(1);
    }
  });

  it('can reach every corner of the picture at 4x from the keyboard alone', () => {
    const corner = (h: CrosshairKey, v: CrosshairKey) => {
      let at = { crosshair: CROSSHAIR_START, view: { z: 4, tx: -600, ty: -450 } };
      at = press(h, 80, at, true);
      at = press(v, 80, at, true);
      // The point of the picture under the crosshair, the way a tap is normalised.
      const rect = { left: at.view.tx, top: at.view.ty, width: stage.width * 4, height: stage.height * 4 };
      return normalizePointerEvent(crosshairClientPoint(at.crosshair, { left: 0, top: 0, ...stage }), { getBoundingClientRect: () => rect });
    };
    expect(corner('ArrowLeft', 'ArrowUp')).toEqual([0, 0]);
    expect(corner('ArrowRight', 'ArrowUp')).toEqual([1, 0]);
    expect(corner('ArrowLeft', 'ArrowDown')).toEqual([0, 1]);
    expect(corner('ArrowRight', 'ArrowDown')).toEqual([1, 1]);
  });

  it('a step covers less of the picture the further in the student has zoomed', () => {
    const picturePoint = (at: { crosshair: Crosshair; view: StageView }) => (at.crosshair.x * stage.width - at.view.tx) / (stage.width * at.view.z);
    const at1 = { crosshair: CROSSHAIR_START, view: flat };
    const at4 = { crosshair: CROSSHAIR_START, view: { z: 4, tx: -600, ty: -450 } };
    const step1 = picturePoint(press('ArrowRight', 1, at1)) - picturePoint(at1);
    const step4 = picturePoint(press('ArrowRight', 1, at4)) - picturePoint(at4);
    expect(step1).toBeCloseTo(FINE_STEP);
    expect(step4).toBeCloseTo(FINE_STEP / 4);
  });
});

describe('the keyboard crosshair: where it taps', () => {
  it('is the screen point it is drawn at, wherever the stage is on the page', () => {
    expect(crosshairClientPoint({ x: 0.25, y: 0.5 }, { left: 100, top: 40, width: 400, height: 300 })).toEqual({ clientX: 200, clientY: 190 });
    expect(crosshairClientPoint({ x: 1, y: 1 }, { left: 100, top: 40, width: 400, height: 300 })).toEqual({ clientX: 500, clientY: 340 });
  });
});
