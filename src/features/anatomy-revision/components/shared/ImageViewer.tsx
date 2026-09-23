import {
  useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent,
} from 'react';
import type { AnatomyImageAsset } from '../../types/image';
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
  /** Stops turning and picking — the answer is in. */
  locked?: boolean;
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
 */
export function ImageViewer({ image, frames, overlay, onPick, locked, resetKey, className }: ImageViewerProps) {
  const zoomerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const frameList = frames && frames.length > 1 ? frames : [image];
  // TWO AXES. The turntable frames go round; tilted frames (a foot seen from
  // above or below) sit on a ladder of their own. Turning left or right walks
  // the ring; tilting up or down climbs the ladder, and coming back to level
  // returns to the ring frame the student tilted away from.
  const ring = frameList.filter((f) => rotationTilt(f.id) === 0);
  const tiltFrames = frameList.filter((f) => rotationTilt(f.id) !== 0);
  const tiltLevels = [...new Set([0, ...tiltFrames.map((f) => rotationTilt(f.id))])].sort((x, y) => x - y);
  const startRing = () => Math.max(0, ring.findIndex((f) => f.id === image.id));
  const [ringIndex, setRingIndex] = useState(startRing);
  const [tilt, setTilt] = useState(() => rotationTilt(image.id));
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  useEffect(() => {
    setRingIndex(startRing());
    setTilt(rotationTilt(image.id));
    setView({ z: 1, tx: 0, ty: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey ?? image.id]);

  const current = (tilt === 0 ? ring[ringIndex] : tiltFrames.find((f) => rotationTilt(f.id) === tilt)) ?? image;
  const canTurn = ring.length > 1 && !locked && tilt === 0;
  const canTilt = tiltFrames.length > 0 && !locked;
  const tiltAt = tiltLevels.indexOf(tilt);

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
    setRingIndex((i) => (i + step + ring.length) % ring.length);
  };
  /** One rung up (+1) or down (-1) the tilt ladder, stopping at either end. */
  const tiltBy = (step: number) => {
    if (!canTilt) return;
    setTilt((t) => {
      const at = tiltLevels.indexOf(t);
      return tiltLevels[Math.min(tiltLevels.length - 1, Math.max(0, at + step))];
    });
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
    if (!onPick || locked || !zoomerRef.current) return;
    onPick(normalizePointerEvent(e, zoomerRef.current), current);
  };

  const zoomed = view.z > 1.001;
  const controlButton = 'rounded bg-sf/90 px-2 py-1 text-xs shadow-sm border border-line hover:bg-sf';
  const pickable = onPick && !locked;

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
        role={pickable ? 'button' : undefined}
        aria-label={current.slideTitle ?? 'Anatomy image'}
      >
        <div
          ref={zoomerRef}
          className="absolute inset-0"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, transformOrigin: '0 0' }}
        >
          <img src={current.filePath} alt={current.slideTitle ?? 'Anatomy structure'} className="h-full w-full object-cover" draggable={false} />
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
        {tiltFrames.length > 0 && (
          <>
            <button type="button" className={controlButton} aria-label="Tilt up" disabled={!canTilt || tiltAt >= tiltLevels.length - 1} onClick={() => tiltBy(1)}>▲ tilt</button>
            <button type="button" className={controlButton} aria-label="Tilt down" disabled={!canTilt || tiltAt <= 0} onClick={() => tiltBy(-1)}>▼ tilt</button>
          </>
        )}

        <span className="min-w-0 flex-1 truncate text-[11px] tabular-nums" style={{ color: 'var(--ink3)' }}>
          {frameList.length > 1
            ? tilt === 0
              ? `${angleLabel(current)} · ${ringIndex + 1}/${ring.length}`
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
      </div>
      <AttributionBadge image={current} />
    </figure>
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
