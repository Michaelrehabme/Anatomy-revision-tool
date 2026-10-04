import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HotspotImage, type HotspotAnswerResult } from '../LocateStructureSession/HotspotImage';
import { ALL_IMAGES } from '../../data/seed';
import { FINE_STEP, COARSE_STEP } from '../../lib/hotspot/keyboardCrosshair';
import { hitTest } from '../../lib/hotspot/pointInPolygon';
import type { AnatomyImageAsset } from '../../types/image';

/**
 * THE KEYBOARD ANSWER IS THE POINTER ANSWER (docs/accessibility-locate.md, C).
 *
 * The crosshair is only an equivalent of the tap if Enter at a point is
 * graded exactly as a click at that point — same structure named, same
 * verdict, same distance, same ring score, same frame — at 1x and zoomed, on
 * a turned plate, on a plate showing its second render, on the carpal gap
 * plate where the targets are gaps between bones, and on a scored landmark.
 * Each case below answers the same question twice, once each way, and
 * compares the two results whole.
 *
 * jsdom lays nothing out, so the stage is given a 400x400 box at (40, 20) —
 * off the origin on purpose, so a route that forgot where the stage is on the
 * page would not agree with the click.
 */
const STAGE = { left: 40, top: 20, size: 400 };

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    // The transformed picture box reports its transformed bounds, as a browser would.
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(el.style.transform ?? '');
    const z = m ? Number(m[3]) : 1;
    const left = STAGE.left + (m ? Number(m[1]) : 0);
    const top = STAGE.top + (m ? Number(m[2]) : 0);
    const size = STAGE.size * z;
    return { left, top, width: size, height: size, right: left + size, bottom: top + size, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  };
  Element.prototype.setPointerCapture = () => {};
  localStorage.clear();
});

const imagesById = new Map(ALL_IMAGES.map((i) => [i.id, i]));
const stageOf = () => screen.getByRole('img').parentElement!.parentElement!;

/** Where the crosshair is on screen, read from the mark itself. */
function crosshairPoint(): { clientX: number; clientY: number } {
  const mark = document.querySelector<SVGElement>('[data-crosshair]')!;
  return {
    clientX: STAGE.left + (parseFloat(mark.style.left) / 100) * STAGE.size,
    clientY: STAGE.top + (parseFloat(mark.style.top) / 100) * STAGE.size,
  };
}

interface Case {
  image: AnatomyImageAsset;
  frames?: AnatomyImageAsset[];
  target: string;
  /** Run after render, by both routes alike: zoom, turn, switch the render. */
  prepare?: () => void;
  /** Arrow keys to press before answering: [key, times, withShift]. */
  keys: [string, number, boolean][];
}

/** Answer by keyboard, then answer a fresh copy by clicking where the crosshair ended up. */
function bothWays({ image, frames, target, prepare, keys }: Case): { keyboard: HotspotAnswerResult; pointer: HotspotAnswerResult } {
  const byKeyboard = vi.fn();
  const first = render(<HotspotImage image={image} frames={frames} targetStructureId={target} onAnswer={byKeyboard} />);
  prepare?.();
  const stage = stageOf();
  stage.focus();
  type(stage, keys);
  const at = crosshairPoint();
  const transform = (screen.getByRole('img').parentElement as HTMLElement).style.transform;
  fireEvent.keyDown(stage, { key: 'Enter' });
  expect(byKeyboard).toHaveBeenCalledTimes(1);
  first.unmount();

  const byPointer = vi.fn();
  const second = render(<HotspotImage image={image} frames={frames} targetStructureId={target} onAnswer={byPointer} />);
  prepare?.();
  // The same view the keyboard left the picture in: the crosshair may have panned it.
  const pointerStage = stageOf();
  pointerStage.focus();
  type(pointerStage, keys);
  expect((screen.getByRole('img').parentElement as HTMLElement).style.transform).toBe(transform);
  fireEvent.click(pointerStage, at);
  expect(byPointer).toHaveBeenCalledTimes(1);
  second.unmount();
  return { keyboard: byKeyboard.mock.calls[0][0], pointer: byPointer.mock.calls[0][0] };
}

/** Press the keys. One step out and back first, so the crosshair is showing even when no key follows. */
function type(stage: HTMLElement, keys: [string, number, boolean][]) {
  fireEvent.keyDown(stage, { key: 'ArrowRight' });
  fireEvent.keyDown(stage, { key: 'ArrowLeft' });
  for (const [key, times, shiftKey] of keys) for (let i = 0; i < times; i++) fireEvent.keyDown(stage, { key, shiftKey });
}

const FINE_PER_COARSE = Math.round(COARSE_STEP / FINE_STEP);

/**
 * The keys from the centre to a point of an unzoomed picture that is ON this
 * structure — strictly inside it and resolved to it, so the case is a plain
 * hit and not a test of the slack. A centroid will not do: a scapula's lies
 * outside its own outline. The point is on the crosshair's own grid, so the
 * keys reach it exactly.
 */
function keysOnto(image: AnatomyImageAsset, structureId: string): [string, number, boolean][] {
  const candidates = image.hotspots!.map((h) => ({ structureId: h.structureId, polygons: h.polygons, area: h.area }));
  const [cx, cy] = image.hotspots!.find((h) => h.structureId === structureId)!.centroid;
  let best: { nx: number; ny: number; d: number } | null = null;
  for (let nx = -100; nx <= 100; nx++) {
    for (let ny = -100; ny <= 100; ny++) {
      const point: [number, number] = [0.5 + nx * FINE_STEP, 0.5 + ny * FINE_STEP];
      if (hitTest(point, candidates)?.structureId !== structureId) continue;
      const d = Math.hypot(point[0] - cx, point[1] - cy);
      if (!best || d < best.d) best = { nx, ny, d };
    }
  }
  if (!best) throw new Error(`no point on ${structureId} in ${image.id}`);
  const steps = (n: number, neg: string, pos: string): [string, number, boolean][] => {
    const key = n < 0 ? neg : pos;
    return [[key, Math.trunc(Math.abs(n) / FINE_PER_COARSE), true], [key, Math.abs(n) % FINE_PER_COARSE, false]];
  };
  return [...steps(best.nx, 'ArrowLeft', 'ArrowRight'), ...steps(best.ny, 'ArrowUp', 'ArrowDown')];
}

describe('a keyboard answer is graded exactly as a pointer answer at the same point', () => {
  it('on an outline target, right and wrong', () => {
    const image = imagesById.get('bone-shoulder-arm-anterior')!;
    const onTarget = bothWays({ image, target: 'scapula', keys: keysOnto(image, 'scapula') });
    expect(onTarget.keyboard).toEqual(onTarget.pointer);
    expect(onTarget.keyboard.correct).toBe(true);

    const onNeighbour = bothWays({ image, target: 'scapula', keys: keysOnto(image, 'humerus') });
    expect(onNeighbour.keyboard).toEqual(onNeighbour.pointer);
    expect(onNeighbour.keyboard.correct).toBe(false);
    expect(onNeighbour.keyboard.structureId).toBe('humerus');
  });

  it('on a scored landmark, ring score and distance included', () => {
    const image = imagesById.get('landmark-acromion-anterior')!;
    const { keyboard, pointer } = bothWays({ image, target: 'acromion', keys: keysOnto(image, 'acromion') });
    expect(keyboard).toEqual(pointer);
    expect(keyboard.correct).toBe(true);
    expect(keyboard.hitDistance).toBeDefined();
    expect(keyboard.accuracy).toBeGreaterThan(0);
    // And a deliberate miss scores the same miss.
    const miss = bothWays({ image, target: 'acromion', keys: [['ArrowDown', 8, true], ['ArrowLeft', 7, true]] });
    expect(miss.keyboard).toEqual(miss.pointer);
    expect(miss.keyboard.correct).toBe(false);
  });

  it('zoomed in and panned by the crosshair itself', () => {
    const image = imagesById.get('bone-shoulder-arm-anterior')!;
    const { keyboard, pointer } = bothWays({
      image,
      target: 'scapula',
      prepare: () => {
        fireEvent.click(screen.getByLabelText('Zoom in'));
        fireEvent.click(screen.getByLabelText('Zoom in'));
      },
      // Far enough to push the picture along under the crosshair.
      keys: [['ArrowRight', 9, true], ['ArrowUp', 6, true], ['ArrowLeft', 3, false]],
    });
    expect(keyboard).toEqual(pointer);
    expect(keyboard.point[0]).toBeGreaterThan(0.5);
  });

  it('on a turned plate: against the frame that is showing', () => {
    const frames = ALL_IMAGES.filter((i) => /^ligament-coracohumeral-ligament-a\d+-context$/.test(i.id));
    expect(frames.length).toBeGreaterThan(2);
    const { keyboard, pointer } = bothWays({
      image: frames[0],
      frames,
      target: 'coracohumeral-ligament',
      prepare: () => fireEvent.click(screen.getByLabelText('Rotate right')),
      keys: [['ArrowLeft', 2, true], ['ArrowUp', 5, false]],
    });
    expect(keyboard).toEqual(pointer);
    expect(keyboard.imageId).toBe(frames[1].id);
  });

  it('on the carpal gap plate, where the targets are gaps between bones', () => {
    const gap = ALL_IMAGES.find((i) => i.id.startsWith('gap-') && (i.hotspots?.length ?? 0) > 1)!;
    expect(gap).toBeDefined();
    const [target, neighbour] = gap.hotspots!;
    const frames = ALL_IMAGES.filter((i) => i.id.startsWith('gap-') && i.id.replace(/-a\d+/, '') === gap.id.replace(/-a\d+/, ''));
    const base = { image: gap, frames: frames.length > 1 ? frames : undefined, target: target.structureId };
    const hit = bothWays({ ...base, keys: keysOnto(gap, target.structureId) });
    expect(hit.keyboard).toEqual(hit.pointer);
    expect(hit.keyboard.correct).toBe(true);
    const next = bothWays({ ...base, keys: keysOnto(gap, neighbour.structureId) });
    expect(next.keyboard).toEqual(next.pointer);
    expect(next.keyboard.correct).toBe(false);
  });

  it('with the second render showing: the same hotspots whichever picture is on screen', () => {
    const withVariant = ALL_IMAGES.find((i) => i.variant && (i.hotspots?.length ?? 0) > 0)!;
    expect(withVariant).toBeDefined();
    const target = withVariant.hotspots![0];
    const cases = [false, true].map((second) =>
      bothWays({
        image: withVariant,
        target: target.structureId,
        prepare: () => {
          if (second) fireEvent.click(screen.getAllByRole('radio')[1]);
        },
        keys: keysOnto(withVariant, target.structureId),
      }),
    );
    for (const { keyboard, pointer } of cases) expect(keyboard).toEqual(pointer);
    expect(cases[0].keyboard).toEqual(cases[1].keyboard);
  });
});

describe('the stage as a keyboard control', () => {
  const image = imagesById.get('bone-shoulder-arm-anterior')!;

  it('is one focus stop, separate from the controls under it, and Tab is left alone', () => {
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={vi.fn()} />);
    const stage = stageOf();
    expect(stage.tabIndex).toBe(0);
    expect(stage.getAttribute('role')).toBe('application');
    expect(stage.contains(screen.getByLabelText('Zoom in'))).toBe(false);
    // No trap: Tab is not one of its keys, so the browser moves focus on.
    expect(fireEvent.keyDown(stage, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(stage, { key: 'Escape' })).toBe(true);
    // Its own keys are taken, so the page does not scroll under them.
    expect(fireEvent.keyDown(stage, { key: 'ArrowDown' })).toBe(false);
    expect(fireEvent.keyDown(stage, { key: ' ' })).toBe(false);
  });

  it('the first answer is the answer: a second Enter does nothing, and the stage stops being a stop', () => {
    const onAnswer = vi.fn();
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={onAnswer} />);
    const stage = stageOf();
    stage.focus();
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'Enter' });
    fireEvent.keyDown(stage, { key: 'Enter' });
    fireEvent.keyDown(stage, { key: ' ' });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(stage.tabIndex).toBe(-1);
    expect(stage.getAttribute('role')).toBe('group');
    expect(document.querySelector('[data-crosshair]')).toBeNull();
  });

  it('a held Enter does not answer twice, and Enter with a modifier is not the stage\'s', () => {
    const onAnswer = vi.fn();
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={onAnswer} />);
    const stage = stageOf();
    stage.focus();
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(stage, { key: 'Enter', repeat: true });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('keys pressed on the controls are theirs: the crosshair does not move and nothing is answered', () => {
    const onAnswer = vi.fn();
    const frames = ALL_IMAGES.filter((i) => /^ligament-coracohumeral-ligament-a\d+-context$/.test(i.id));
    render(<HotspotImage image={frames[0]} frames={frames} targetStructureId="coracohumeral-ligament" onAnswer={onAnswer} />);
    const stage = stageOf();
    stage.focus();
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    const before = crosshairPoint();
    const rotate = screen.getByLabelText('Rotate right');
    rotate.focus();
    fireEvent.keyDown(rotate, { key: 'ArrowRight' });
    fireEvent.keyDown(rotate, { key: 'Enter' });
    fireEvent.keyDown(rotate, { key: ' ' });
    expect(crosshairPoint()).toEqual(before);
    expect(onAnswer).not.toHaveBeenCalled();
    // The button still turns the plate, and the crosshair stays where it was to come back to.
    fireEvent.click(rotate);
    expect((screen.getByRole('img') as HTMLImageElement).src).toContain(frames[1].filePath);
    expect(crosshairPoint()).toEqual(before);
  });

  it('shows its instructions with the crosshair, and always carries them for a screen reader', () => {
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={vi.fn()} />);
    const stage = stageOf();
    const hint = document.querySelector('[data-crosshair-hint]')!;
    expect(stage.getAttribute('aria-describedby')!.split(' ')).toContain(hint.id);
    expect(hint.textContent).toMatch(/Arrow keys move the pointer.*Shift.*Enter or Space answers/);
    expect(hint.className).toContain('sr-only');
    expect(document.querySelector('[data-crosshair]')).toBeNull();
    stage.focus();
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(hint.className).not.toContain('sr-only');
    expect(document.querySelector('[data-crosshair]')).not.toBeNull();
  });

  it('a pointer takes over: the crosshair goes, and Enter then shows it again rather than answering blind', () => {
    const onAnswer = vi.fn();
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={onAnswer} />);
    const stage = stageOf();
    stage.focus();
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(document.querySelector('[data-crosshair]')).toBeNull();
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(onAnswer).not.toHaveBeenCalled();
    expect(document.querySelector('[data-crosshair]')).not.toBeNull();
  });

  it('gives nothing away: no hotspot is focusable or named, before the answer, wherever the crosshair goes', () => {
    render(<HotspotImage image={image} targetStructureId="scapula" onAnswer={vi.fn()} />);
    const stage = stageOf();
    stage.focus();
    const names = ['Scapula', 'Humerus', 'Clavicle'];
    for (const [key, times] of [['ArrowLeft', 12], ['ArrowUp', 9], ['ArrowRight', 20], ['ArrowDown', 15]] as const) {
      for (let i = 0; i < times; i++) {
        fireEvent.keyDown(stage, { key, shiftKey: true });
        // Focus never leaves the stage for something inside it...
        expect(document.activeElement).toBe(stage);
      }
    }
    // ...there is nothing inside it to focus...
    expect(stage.querySelectorAll('[tabindex], button, a[href]')).toHaveLength(0);
    // ...and nothing on it, in it or announced from it names a structure.
    const said = [stage.getAttribute('aria-label'), stage.textContent, ...[...document.querySelectorAll('[aria-live]')].map((n) => n.textContent)].join(' ');
    for (const name of names) expect(said).not.toContain(name);
    expect(document.querySelector('[data-crosshair]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('a picture that takes no tap is not a focus stop at all', async () => {
    const { ImageViewer } = await import('../shared/ImageViewer');
    render(<ImageViewer image={image} />);
    const stage = stageOf();
    expect(stage.hasAttribute('tabindex')).toBe(false);
    expect(stage.getAttribute('role')).toBe('group');
    expect(document.querySelector('[data-crosshair-hint]')).toBeNull();
  });
});
