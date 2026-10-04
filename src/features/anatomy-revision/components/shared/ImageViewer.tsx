import {
  useEffect, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent,
} from 'react';
import type { AnatomyImageAsset, ImageVariantKind } from '../../types/image';
import { getImageVariantChoice, setImageVariantChoice } from '../../lib/preferences';
import { normalizePointerEvent } from '../../lib/hotspot/normalizeCoordinates';
import { rotationAngle, rotationTilt } from '../../lib/rotationFrames';
import { AttributionBadge } from './AttributionBadge';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** Under this many pixels of movement a pointer gesture is a click, not a drag. */
const DRAG_THRESHOLD_PX = 8;
/** One frame of rotation per this many pixels of sideways drag. */
const PX_PER_FRAME = 48;

export interface ImageViewerProps {
  /** The opening frame, and the whole picture when there is no set to turn. */
  image: AnatomyImageAsset;
  /** Every angle of the same picture, `image` included, in angle order. */
  frames?: AnatomyImageAsset[];
  /** Drawn over the picture INSIDE the transformed box, so it zooms with it. */
  overlay?: (current: AnatomyImageAsset) => ReactNode;
  /** A tap on the picture, in normalised image coordinates. Omit for read-only. */
  onPick?: (point: [number, number], current: AnatomyImageAsset) => void;
  /** Zoom and frame reset when this changes; pass the question's id. */
  resetKey?: string;
  className?: string;
}

/**
 * The picture, and the two things a student can do to it: turn it, and move in.
 *
 * WHY THIS IS SHARED. A clinician looking at a real specimen walks round it and
 * leans in, and the app should not make that a privilege of one question type.
 * Zoom and rotation were built for locate and lived inside HotspotImage, so
 * identify and MCQ — which show the SAME plates — rendered them as flat
 * pictures. A structure you cannot turn towards you is one you have to identify
 * from whichever side the renderer happened to pick.
 *
 * The picture and its overlay sit in ONE transformed box, and
 * normalizePointerEvent reads that box's rendered rect — a transformed element
 * reports its transformed bounds — so a normalised tap is right at any
 * magnification without any inverse maths.
 *
 * The outer box is sized by CSS aspect-ratio from the asset's own width and
 * height so the <img> fills it 1:1. That is what keeps those coordinates
 * correct; object-fit: contain would letterbox and corrupt them.
 *
 * THE SECOND RENDER. Some frames were rendered twice through one camera — a
 * ligament under the femur with the femur ghosted and with it gone, a ligament
 * between two carpals with the bones see-through and solid (types/image.ts,
 * ImageVariant). Where a set has such frames a switch sits beside the other
 * controls. It changes ONLY which file the <img> shows: the frame, the zoom,
 * the pan and the place in the turntable are untouched, so the picture does
 * not jump, and `overlay` and `onPick` are still handed the default frame, so
 * a tap is graded against the same hotspots whichever render is on screen.
 * The default is the ghosted render; the choice is remembered per kind of
 * variant (lib/preferences.ts), because someone who prefers the femur gone
 * prefers it gone on the next knee question too.
 */

/** What the two states of the switch are called, default first. */
const VARIANT_LABELS: Record<ImageVariantKind, [string, string]> = {
  hidden: ['ghosted', 'hidden'],
  solid: ['see-through', 'solid'],
};
export function ImageViewer({ image, frames, overlay, onPick, resetKey, className }: ImageViewerProps) {
  const zoomerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const frameList = frames && frames.length > 1 ? frames : [image];
  // TWO AXES. The turntable frames go round; tilted frames (a foot seen from
  // above or below) sit on a ladder of their own. Turning left or right walks
  // the ring; tilting up or down climbs the ladder, and coming back to level
  // returns to the ring frame the student tilted away from.
  const ring = frameList.filter((f) => rotationTilt(f.id) === 0);
  const tiltFrames = frameList.filter((f) => rotationTilt(f.id) !== 0);
  // The level is a rung only if there is a level frame to stand on: the
  // meniscotibial ligaments are published from above alone, and a rung with
  // nothing on it would tilt the student back to the frame they opened on.
  const tiltLevels = [...new Set([...(ring.length ? [0] : []), ...tiltFrames.map((f) => rotationTilt(f.id))])].sort((x, y) => x - y);
  const startRing = () => Math.max(0, ring.findIndex((f) => f.id === image.id));
  const [ringIndex, setRingIndex] = useState(startRing);
  const [tilt, setTilt] = useState(() => rotationTilt(image.id));
  // A TILTED RUNG CAN BE A RING OF ITS OWN. The foot has one frame at each
  // tilt, so tilted there was nothing to turn. The knee seen from above has
  // six at 45 degrees, and they turn like any other ring. This is the angle
  // the student is at on a tilted rung; the level ring keeps its own index,
  // so coming back to level still returns to the frame they tilted away from.
  const [tiltAngle, setTiltAngle] = useState<number | null>(() => (rotationTilt(image.id) !== 0 ? rotationAngle(image.id) : null));
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  useEffect(() => {
    setRingIndex(startRing());
    setTilt(rotationTilt(image.id));
    setTiltAngle(rotationTilt(image.id) !== 0 ? rotationAngle(image.id) : null);
    setView({ z: 1, tx: 0, ty: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey ?? image.id]);

  /** The frames on one tilted rung, in angle order. */
  const rung = (level: number) =>
    tiltFrames.filter((f) => rotationTilt(f.id) === level).sort((a, b) => (rotationAngle(a.id) ?? 0) - (rotationAngle(b.id) ?? 0));
  /** The frame on a rung nearest an angle, going round the circle. */
  const nearestOn = (frames: AnatomyImageAsset[], angle: number) =>
    frames.reduce<AnatomyImageAsset | undefined>((best, f) => {
      const gap = (x: AnatomyImageAsset) => {
        const d = Math.abs((rotationAngle(x.id) ?? 0) - angle) % 360;
        return Math.min(d, 360 - d);
      };
      return !best || gap(f) < gap(best) ? f : best;
    }, undefined);
  const levelFrames = tilt === 0 ? ring : rung(tilt);
  const facing = tiltAngle ?? rotationAngle(ring[ringIndex]?.id ?? image.id) ?? 0;
  const current = (tilt === 0 ? ring[ringIndex] : nearestOn(levelFrames, facing)) ?? image;
  const levelIndex = Math.max(0, levelFrames.findIndex((f) => f.id === current.id));
  const canTurn = levelFrames.length > 1;
  const canTilt = tiltLevels.length > 1;
  const tiltAt = tiltLevels.indexOf(tilt);

  // The second render: which kind this set has, whether it is switched on, and
  // whether the frame on screen has one.
  const setVariant = frameList.find((f) => f.variant)?.variant;
  const [variantOn, setVariantOn] = useState<boolean>(() => (setVariant ? getImageVariantChoice(setVariant.kind) : false));
  useEffect(() => {
    setVariantOn(setVariant ? getImageVariantChoice(setVariant.kind) : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVariant?.kind]);
  const chooseVariant = (on: boolean) => {
    if (!setVariant) return;
    setVariantOn(on);
    setImageVariantChoice(setVariant.kind, on);
  };
  const shownPath = variantOn && current.variant ? current.variant.filePath : current.filePath;

  const gesture = useRef<null | {
    kind: 'pan' | 'turn' | 'pinch';
    x: number; y: number; tx: number; ty: number; z: number;
    moved: boolean; turned: number; tilted?: number; dist?: number; mid?: [number, number];
  }>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const suppressClick = useRef(false);

  /** Keep the picture covering the stage: no gaps at the edges, zoom within bounds. */
  const clamp = (v: { z: number; tx: number; ty: number }) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return v;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    return {
      z,
      tx: Math.min(0, Math.max(r.width - r.width * z, v.tx)),
      ty: Math.min(0, Math.max(r.height - r.height * z, v.ty)),
    };
  };
  const zoomAt = (factor: number, cx: number, cy: number) =>
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      const k = z / v.z;
      // The point under the pointer stays under the pointer.
      return clamp({ z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k });
    });
  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = stageRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const [x, y] = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
  };

  const turn = (step: number) => {
    if (!canTurn) return;
    if (tilt === 0) {
      setRingIndex((i) => (i + step + ring.length) % ring.length);
      return;
    }
    const n = levelFrames.length;
    const next = levelFrames[(((levelIndex + step) % n) + n) % n];
    setTiltAngle(rotationAngle(next.id));
  };
  /** One rung up (+1) or down (-1) the tilt ladder, stopping at either end. */
  const tiltBy = (step: number) => {
    if (!canTilt) return;
    const at = tiltLevels.indexOf(tilt);
    const to = tiltLevels[Math.min(tiltLevels.length - 1, Math.max(0, at + step))];
    if (to === tilt) return;
    // Leaving the level ring, the tilted rung is entered facing the way the
    // student was facing; a rung with one frame has only that one to offer.
    if (tilt === 0) setTiltAngle(null);
    setTilt(to);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-controls]')) return;
    pointers.current.set(e.pointerId, local(e));
    stageRef.current?.setPointerCapture(e.pointerId);
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { kind: view.z > 1.001 ? 'pan' : 'turn', x: pts[0][0], y: pts[0][1], tx: view.tx, ty: view.ty, z: view.z, moved: false, turned: 0, tilted: 0 };
    } else if (pts.length === 2) {
      gesture.current = {
        kind: 'pinch', x: 0, y: 0, tx: view.tx, ty: view.ty, z: view.z, moved: true, turned: 0, tilted: 0,
        dist: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
        mid: [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2],
      };
    }
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    if (g.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2 || !g.dist || !g.mid) return;
      const dist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.z * dist) / g.dist));
      const k = z / g.z;
      const mid: [number, number] = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      setView(clamp({ z, tx: mid[0] - (g.mid[0] - g.tx) * k, ty: mid[1] - (g.mid[1] - g.ty) * k }));
      return;
    }
    const [x, y] = pointers.current.get(e.pointerId)!;
    const dx = x - g.x;
    const dy = y - g.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) g.moved = true;
    if (!g.moved) return;
    if (g.kind === 'pan') {
      setView(clamp({ z: g.z, tx: g.tx + dx, ty: g.ty + dy }));
    } else if (canTilt && Math.abs(dy) > Math.abs(dx)) {
      // Dragging down pulls the top of the specimen towards you: tilt up.
      const step = Math.round(dy / PX_PER_FRAME);
      if (step !== g.tilted) {
        tiltBy(step - (g.tilted ?? 0));
        g.tilted = step;
      }
    } else if (canTurn) {
      const step = Math.round(dx / PX_PER_FRAME);
      if (step !== g.turned) {
        turn(step - g.turned);
        g.turned = step;
      }
    }
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.moved) suppressClick.current = true;
    if (pointers.current.size === 0 || gesture.current?.kind === 'pinch') gesture.current = null;
  };

  const handleClick = (e: ReactPointerEvent<HTMLDivElement> | { clientX: number; clientY: number; target: EventTarget }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest?.('[data-controls]')) return;
    if (!onPick || !zoomerRef.current) return;
    onPick(normalizePointerEvent(e, zoomerRef.current), current);
  };

  const zoomed = view.z > 1.001;
  const controlButton = 'rounded bg-sf/90 px-2 py-1 text-xs shadow-sm border border-line hover:bg-sf';
  const pickable = !!onPick;

  return (
    <figure className={className}>
      <div
        ref={stageRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full overflow-hidden rounded-lg border border-line bg-sf select-none ${
          pickable ? (zoomed ? 'cursor-grab' : 'cursor-crosshair') : zoomed ? 'cursor-grab' : ''
        }`}
        style={{
          aspectRatio: current.width && current.height ? `${current.width} / ${current.height}` : undefined,
          touchAction: 'none',
        }}
        // A labelled group, so the name is actually read out. Not role="img":
        // that makes everything inside presentational, hiding the zoom and
        // turn controls from a screen reader (docs/ACCESSIBILITY-AUDIT-2026-09-28.md).
        role={pickable ? 'button' : 'group'}
        aria-label={current.slideTitle ?? 'Anatomy image'}
      >
        <div
          ref={zoomerRef}
          className="absolute inset-0"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, transformOrigin: '0 0' }}
        >
          <img src={shownPath} alt={current.slideTitle ?? 'Anatomy structure'} className="h-full w-full object-cover" draggable={false} />
          {overlay?.(current)}
        </div>

      </div>

      {/*
        CONTROLS SIT UNDER THE PICTURE, NOT ON IT.
        They were floated over the corners, where they covered the anatomy and
        the angle caption ran across the structure being asked about — on a
        phone the picture is the whole screen, so every control was in the way
        of the thing to be identified. Below it they cost a row of height and
        obscure nothing.
      */}
      <div
        data-controls
        className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5"
        style={{ color: 'var(--ink)' }}
      >
        {frameList.length > 1 && (
          <>
            <button type="button" className={controlButton} aria-label="Rotate left" disabled={!canTurn} onClick={() => turn(-1)}>◀ rotate</button>
            <button type="button" className={controlButton} aria-label="Rotate right" disabled={!canTurn} onClick={() => turn(1)}>rotate ▶</button>
          </>
        )}
        {tiltLevels.length > 1 && (
          <>
            <button type="button" className={controlButton} aria-label="Tilt up" disabled={!canTilt || tiltAt >= tiltLevels.length - 1} onClick={() => tiltBy(1)}>▲ tilt</button>
            <button type="button" className={controlButton} aria-label="Tilt down" disabled={!canTilt || tiltAt <= 0} onClick={() => tiltBy(-1)}>▼ tilt</button>
          </>
        )}

        <span className="min-w-0 flex-1 truncate text-[11px] tabular-nums" style={{ color: 'var(--ink3)' }}>
          {frameList.length > 1
            ? levelFrames.length > 1
              ? `${angleLabel(current)} · ${levelIndex + 1}/${levelFrames.length}`
              : angleLabel(current)
            : ''}
        </span>

        {/* Scroll or pinch does the same; these are for those who prefer buttons. */}
        <button type="button" className={controlButton} aria-label="Zoom out" onClick={() => { const r = stageRef.current!.getBoundingClientRect(); zoomAt(1 / 1.5, r.width / 2, r.height / 2); }}>−</button>
        <span className="px-0.5 text-[11px] tabular-nums" style={{ color: 'var(--ink3)' }}>{view.z.toFixed(1)}×</span>
        <button type="button" className={controlButton} aria-label="Zoom in" onClick={() => { const r = stageRef.current!.getBoundingClientRect(); zoomAt(1.5, r.width / 2, r.height / 2); }}>+</button>
        {zoomed && (
          <button type="button" className={controlButton} aria-label="Reset zoom" onClick={() => setView({ z: 1, tx: 0, ty: 0 })}>↺</button>
        )}
        {setVariant && (
          <VariantSwitch
            subject={setVariant.subject}
            labels={VARIANT_LABELS[setVariant.kind]}
            on={variantOn}
            // A frame the second render was not published for stays on the
            // default, and says so by greying the switch rather than hiding it:
            // a control that vanishes as the picture turns reads as a fault.
            available={!!current.variant}
            onChange={chooseVariant}
          />
        )}
      </div>
      <AttributionBadge image={current} />
    </figure>
  );
}

/**
 * "Femur: ghosted | hidden" — the switch between a frame's two renders.
 *
 * A radio group, because it is a choice between two named states and not an
 * on/off: "pressed" would have to mean one of them, and neither word says
 * which. One tab stop, arrow keys move the choice, as a native radio group
 * does. On a touch screen each option is at least 44px tall; with a mouse it
 * matches the other controls in the row.
 */
function VariantSwitch({ subject, labels, on, available, onChange }: {
  subject: string;
  labels: [string, string];
  on: boolean;
  available: boolean;
  onChange: (on: boolean) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const handleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!available) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = !on;
    onChange(next);
    refs.current[next ? 1 : 0]?.focus();
  };
  const selected = available ? (on ? 1 : 0) : 0;
  return (
    <div
      role="radiogroup"
      aria-label={subject}
      aria-disabled={available ? undefined : true}
      onKeyDown={handleKey}
      // A row of its own, under rotate and zoom. Squeezed into theirs it cost
      // the angle caption its room — "Anterior · 0° · 1/6" became "Ant…" on
      // the identify screen, where the picture is 450px wide.
      className="flex basis-full items-center gap-1.5"
      title={available ? undefined : 'Only one version of this view was rendered'}
    >
      <span className="text-[11px]" style={{ color: 'var(--ink3)' }}>{subject}:</span>
      {labels.map((label, i) => {
        const checked = selected === i;
        return (
          <button
            key={label}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={!available}
            onClick={() => onChange(i === 1)}
            className="inline-flex items-center justify-center rounded px-2 py-1 text-xs shadow-sm disabled:opacity-50 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] [@media(pointer:coarse)]:px-3"
            style={{
              border: checked ? '1.4px solid var(--acc)' : '1px solid var(--line)',
              background: checked ? 'var(--accs)' : 'var(--sf)',
              color: checked ? 'var(--accd)' : 'var(--ink)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Anterolateral · 60°".
 *
 * At thirty degrees a turntable has twelve frames and only eight names worth
 * having, so two frames share a name and the degrees are what tell them apart —
 * and "turn it another thirty" is how someone actually thinks about walking
 * round a specimen. A picture with no angle keeps the plain name.
 */
function angleLabel(image: AnatomyImageAsset): string {
  const name = image.view[0].toUpperCase() + image.view.slice(1);
  const deg = rotationAngle(image.id);
  const tilt = rotationTilt(image.id);
  if (tilt !== 0) return `${name} · tilted ${tilt > 0 ? 'up' : 'down'} ${Math.abs(tilt)}°`;
  return deg === null ? name : `${name} · ${deg}°`;
}
