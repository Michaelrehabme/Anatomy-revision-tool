/**
 * The keyboard's pointer on a picture (docs/accessibility-locate.md, option C).
 *
 * A locate question is answered by a tap, and a tap is an endpoint, not a
 * path — so WCAG 2.1.1 gives it no exemption from the keyboard. Until this,
 * the only keyboard route was a list of names, which is a different and
 * easier exercise. The crosshair is the same exercise: the student who can
 * see the plate and cannot use a pointer moves a mark over it with the arrow
 * keys and presses Enter where they would have tapped.
 *
 * WHERE THE CROSSHAIR LIVES. In the STAGE — the box on screen — as a fraction
 * of its width and height, not in the picture. That is what keeps it visible
 * whatever is done to the picture underneath: zoom, pan, another angle, the
 * second render. A mark pinned to the picture would slide out of view the
 * moment the student zoomed, and would have to be found again.
 *
 * AND IT IS NOT GRADED HERE. Enter turns the crosshair into the screen point
 * it sits on (crosshairClientPoint) and hands that to the same code a click
 * runs — the same normalisation against the transformed picture box, the same
 * hit test, the same slack — so a keyboard answer and a pointer answer at one
 * point cannot differ. There is deliberately no hit test in this file.
 *
 * WHAT IT MUST NEVER DO is know what is under it. Nothing here reads a
 * hotspot, snaps to one or names one: a pointer that jumped between
 * structures, or said which it was over, would be the answer read aloud.
 */

/** Where the crosshair is, as a fraction of the stage: [0,0] top left, [1,1] bottom right. */
export interface Crosshair {
  x: number;
  y: number;
}

/** The picture's transform inside the stage, as ImageViewer keeps it. */
export interface StageView {
  z: number;
  tx: number;
  ty: number;
}

export interface StageSize {
  width: number;
  height: number;
}

export const CROSSHAIR_START: Crosshair = { x: 0.5, y: 0.5 };

/**
 * One press of an arrow key, as a fraction of the stage's WIDTH (both axes,
 * so a step is the same distance on screen up as across).
 *
 * The fine step has to be smaller than anything that can be asked for. The
 * narrowest target a locate question may have is MIN_TAPPABLE_WIDTH (0.0075)
 * and it is graded with TAP_SLACK (0.01) either side, 0.0275 in all; a step
 * of 0.005 cannot stride over that, and on a scored landmark it is the
 * difference of one ring at most. Zooming makes it finer still, because the
 * step is measured on screen and the picture is larger under it.
 *
 * Shift is ten times that: twenty presses cross the picture.
 */
export const FINE_STEP = 0.005;
export const COARSE_STEP = 0.05;

/**
 * When the picture is zoomed, the crosshair pushes the picture along once it
 * is this close to the edge of the stage, rather than running to the edge and
 * stopping — otherwise most of a zoomed picture could not be reached from the
 * keyboard at all, since panning is a drag.
 */
export const PAN_MARGIN = 0.12;

export type CrosshairKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const DIRECTIONS: Record<CrosshairKey, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function isCrosshairKey(key: string): key is CrosshairKey {
  return Object.hasOwn(DIRECTIONS, key);
}

/** One axis: move by `delta` px in a stage `size` px long, panning a zoomed picture first near the edge. */
function moveAxis(at: number, delta: number, size: number, offset: number, zoom: number): { at: number; offset: number } {
  let target = at + delta;
  // How far the picture may slide: its far edge may not come inside the stage's.
  const minOffset = size - size * zoom;
  const lo = size * PAN_MARGIN;
  const hi = size * (1 - PAN_MARGIN);
  if (delta > 0 && target > hi) {
    const pan = Math.min(target - hi, offset - minOffset);
    if (pan > 0) {
      offset -= pan;
      target -= pan;
    }
  } else if (delta < 0 && target < lo) {
    const pan = Math.min(lo - target, -offset);
    if (pan > 0) {
      offset += pan;
      target += pan;
    }
  }
  return { at: Math.min(size, Math.max(0, target)), offset };
}

/**
 * The crosshair and the view after one arrow key.
 *
 * At 1x the view never changes and the crosshair stops at the edge of the
 * stage, which is the edge of the picture. Zoomed in, it pushes the picture
 * along inside PAN_MARGIN until the picture's own edge arrives, and only then
 * runs on to the edge of the stage — so every point of the picture can be
 * reached at any zoom, and the crosshair is never off screen.
 */
export function moveCrosshair(
  crosshair: Crosshair,
  view: StageView,
  stage: StageSize,
  key: CrosshairKey,
  coarse: boolean,
): { crosshair: Crosshair; view: StageView } {
  if (stage.width <= 0 || stage.height <= 0) return { crosshair, view };
  const [dx, dy] = DIRECTIONS[key];
  const step = (coarse ? COARSE_STEP : FINE_STEP) * stage.width;
  const x = moveAxis(crosshair.x * stage.width, dx * step, stage.width, view.tx, view.z);
  const y = moveAxis(crosshair.y * stage.height, dy * step, stage.height, view.ty, view.z);
  return {
    crosshair: { x: x.at / stage.width, y: y.at / stage.height },
    view: { z: view.z, tx: x.offset, ty: y.offset },
  };
}

/** The point on screen the crosshair marks — what a click there would report as clientX / clientY. */
export function crosshairClientPoint(
  crosshair: Crosshair,
  stageRect: { left: number; top: number; width: number; height: number },
): { clientX: number; clientY: number } {
  return {
    clientX: stageRect.left + crosshair.x * stageRect.width,
    clientY: stageRect.top + crosshair.y * stageRect.height,
  };
}
